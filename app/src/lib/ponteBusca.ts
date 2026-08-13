/**
 * Ponte de busca (n8n webhook) — Fase 3B.1.1.
 *
 * Causa raiz do bug reportado: "Testar busca" validava só a CHAVE da SerpAPI
 * (account endpoint), enquanto a busca REAL passa pela PONTE n8n
 * (N8N_WEBHOOK_BUSCA). Chave válida ≠ ponte funcionando. Este módulo centraliza
 * a chamada à ponte para que teste e busca real usem EXATAMENTE o mesmo caminho.
 *
 * Nunca loga a chave nem o payload cru — só status/código sanitizados.
 */
import { registrarLog } from './logOperacional';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ResultadoPonte =
  | { ok: true; dados: { local_results?: unknown[]; error?: string } }
  | { ok: false; status: number; motivo: string };

/**
 * Faz a chamada real à ponte (mesmo caminho da busca de verdade).
 * `modo: 'prova'` faz uma chamada mínima só para checar se a ponte responde
 * (sem depender de resultado de busca); `modo: 'busca'` manda os parâmetros
 * completos do google_maps.
 */
export async function chamarPonte(
  admin: SupabaseClient,
  contaId: string | null,
  ponte: string | undefined,
  params: Record<string, string>,
  opts: { correlationId?: string | null; modo: 'prova' | 'busca' } = { modo: 'busca' },
): Promise<ResultadoPonte> {
  if (!ponte) {
    await registrarLog(admin, {
      componente: 'busca', operacao: opts.modo === 'prova' ? 'testar_ponte' : 'buscar',
      codigo: 'PONTE_AUSENTE', mensagem: 'N8N_WEBHOOK_BUSCA não configurado no servidor.',
      contaId, correlationId: opts.correlationId ?? null,
    });
    return { ok: false, status: 500, motivo: 'Ponte de busca não configurada no servidor.' };
  }

  try {
    let resposta: Response | undefined;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      resposta = await fetch(ponte, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(45_000),
      });
      // 5xx pode ser passageiro no n8n — uma segunda tentativa.
      if (resposta.ok || resposta.status < 500 || tentativa === 2) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!resposta!.ok) {
      await registrarLog(admin, {
        componente: 'busca', operacao: opts.modo === 'prova' ? 'testar_ponte' : 'buscar',
        codigo: `HTTP_${resposta!.status}`,
        mensagem: `Ponte de busca respondeu ${resposta!.status}.`,
        contaId, correlationId: opts.correlationId ?? null,
      });
      return { ok: false, status: resposta!.status, motivo: `A ponte de busca respondeu ${resposta!.status}.` };
    }

    const dados = (await resposta!.json().catch(() => ({}))) as { local_results?: unknown[]; error?: string };
    return { ok: true, dados };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido';
    await registrarLog(admin, {
      componente: 'busca', operacao: opts.modo === 'prova' ? 'testar_ponte' : 'buscar',
      codigo: 'SEM_REDE', mensagem: `Não consegui falar com a ponte de busca: ${msg}`,
      contaId, correlationId: opts.correlationId ?? null,
    });
    return { ok: false, status: 502, motivo: 'Não consegui falar com a ponte de busca.' };
  }
}
