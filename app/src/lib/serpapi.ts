/**
 * Busca nativa no Google Maps via SerpAPI — chamada DIRETA, sem ponte n8n.
 *
 * Decisão arquitetural (2026-08-13, handoff de reconciliação): o Harvest tem
 * backend próprio (Next.js API routes) e não precisa mais do n8n como salto
 * intermediário para a busca — essa ponte (`N8N_WEBHOOK_BUSCA`) existia por
 * causa do CORS do painel HTML antigo (pré-Next.js). n8n segue aprovado
 * como camada de automação PERIFÉRICA (fora do caminho crítico de busca).
 *
 * A api_key: nunca vai para o browser, nunca é logada, nunca aparece em
 * texto de erro devolvido ao cliente. `chamarSerpApi` monta a URL aqui
 * dentro — quem chama nunca precisa colocar a chave no objeto de params.
 */
import { registrarLog } from './logOperacional.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CodigoErroBusca =
  | 'CREDENCIAL_AUSENTE'
  | 'CREDENCIAL_INVALIDA'
  | 'CREDITOS_ESGOTADOS'
  | 'TIMEOUT'
  | 'ERRO_SERPAPI'
  | 'FALHA_INTERNA';

export type ResultadoBusca =
  | { ok: true; dados: { local_results?: unknown[]; error?: string } }
  | { ok: false; status: number; motivo: string; codigo: CodigoErroBusca };

const CREDITOS_ESGOTADOS_RE = /run\s*out\s*of\s*searches|no\s*more\s*searches|insufficient\s*credits|account\s*has\s*run\s*out/i;
const CREDENCIAL_INVALIDA_RE = /invalid\s*api\s*key/i;

/**
 * Resolução da chave da SerpAPI (bug P0 — inconsistência UI vs backend).
 *
 * Modelo aprovado: a busca é **institucional** (credencial da Figueira, no
 * servidor). O cliente NÃO cadastra chave. Ordem de resolução:
 *
 *   1. `SERPAPI_KEY` (env de runtime do servidor) — credencial institucional.
 *      Prevalece sempre; a UI nunca a exibe.
 *   2. `conta_credenciais.serpapi_key` — BYOK legado por tenant, usado só se
 *      não houver credencial institucional (compatibilidade).
 *   3. nenhuma das duas — recurso indisponível (sanitizado pelo chamador).
 *
 * A chave NUNCA sai do servidor: não entra em resposta, log de erro, nem
 * chega ao browser. A ausência total vira "Busca temporariamente indisponível."
 * — nunca "cadastre sua chave" para um recurso institucional.
 */
export type ResolucaoSerpKey =
  | { fonte: 'institucional'; key: string }
  | { fonte: 'byok'; key: string }
  | { fonte: 'ausente' };

export function resolverChaveSerpapi(cred?: { serpapi_key?: string | null } | null): ResolucaoSerpKey {
  const institucional = (process.env.SERPAPI_KEY ?? '').trim();
  if (institucional) return { fonte: 'institucional', key: institucional };
  const byok = cred?.serpapi_key?.trim();
  if (byok) return { fonte: 'byok', key: byok };
  return { fonte: 'ausente' };
}

/**
 * `modo: 'prova'` faz uma busca mínima só pra confirmar que a chave E a
 * conectividade com a SerpAPI funcionam de verdade (mesmo caminho da busca
 * real — é o que faz "Testar busca" valer alguma coisa). `modo: 'busca'`
 * manda os parâmetros completos do google_maps vindos da rota de busca.
 */
export async function chamarSerpApi(
  admin: SupabaseClient,
  contaId: string | null,
  apiKey: string | null | undefined,
  params: Record<string, string>,
  opts: { correlationId?: string | null; modo: 'prova' | 'busca' } = { modo: 'busca' },
): Promise<ResultadoBusca> {
  const operacao = opts.modo === 'prova' ? 'testar_busca' : 'buscar';

  if (!apiKey) {
    await registrarLog(admin, {
      componente: 'busca', operacao, codigo: 'CREDENCIAL_AUSENTE',
      mensagem: 'Busca chamada sem chave da SerpAPI cadastrada na conta.',
      contaId, correlationId: opts.correlationId ?? null,
    });
    return { ok: false, status: 400, motivo: 'Falta a chave da SerpAPI.', codigo: 'CREDENCIAL_AUSENTE' };
  }

  const url = new URL('https://serpapi.com/search.json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('api_key', apiKey);

  let resposta: Response;
  try {
    resposta = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
    const codigo: CodigoErroBusca = timeout ? 'TIMEOUT' : 'FALHA_INTERNA';
    await registrarLog(admin, {
      componente: 'busca', operacao, codigo,
      mensagem: timeout ? 'SerpAPI não respondeu a tempo (30s).' : 'Falha de rede ao chamar a SerpAPI.',
      contaId, correlationId: opts.correlationId ?? null,
    });
    return {
      ok: false, status: timeout ? 504 : 502, codigo,
      motivo: timeout ? 'A busca demorou demais e foi cancelada. Tente de novo.' : 'Não consegui falar com a SerpAPI.',
    };
  }

  if (!resposta.ok) {
    await registrarLog(admin, {
      componente: 'busca', operacao, codigo: `HTTP_${resposta.status}`,
      mensagem: `SerpAPI respondeu ${resposta.status}.`,
      contaId, correlationId: opts.correlationId ?? null,
    });
    return { ok: false, status: resposta.status, motivo: `A SerpAPI respondeu ${resposta.status}.`, codigo: 'ERRO_SERPAPI' };
  }

  const dados = (await resposta.json().catch(() => ({}))) as { local_results?: unknown[]; error?: string };

  if (dados.error) {
    const credencialInvalida = CREDENCIAL_INVALIDA_RE.test(dados.error);
    const creditosEsgotados = CREDITOS_ESGOTADOS_RE.test(dados.error);
    const codigo: CodigoErroBusca = credencialInvalida
      ? 'CREDENCIAL_INVALIDA'
      : creditosEsgotados ? 'CREDITOS_ESGOTADOS' : 'ERRO_SERPAPI';
    await registrarLog(admin, {
      componente: 'busca', operacao, codigo,
      mensagem: `SerpAPI recusou a busca (${codigo}).`,
      contaId, correlationId: opts.correlationId ?? null,
    });
    return {
      ok: false, status: 400, codigo,
      motivo: credencialInvalida
        ? 'A chave da SerpAPI foi recusada. Confira em Configurações.'
        : creditosEsgotados
          ? 'Os créditos da SerpAPI acabaram neste ciclo.'
          : dados.error,
    };
  }

  // local_results ausente/vazio não é erro — é "sem resultados" (achados=[]
  // na rota chamadora, que já trata array vazio corretamente).
  return { ok: true, dados };
}
