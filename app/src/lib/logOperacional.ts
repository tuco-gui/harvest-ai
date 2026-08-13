/**
 * Log operacional sanitizado (Fase 3B.1.1).
 *
 * Registro mínimo de erros reais para a tela Status/Saúde. NUNCA registra:
 * token, API key, secret, .env, credencial ou payload sensível desnecessário.
 *
 * Persiste em historico_contato com origem='log' (já tem RLS por conta_id) —
 * reuso em vez de tabela nova. O texto é SEMPRE sanitizado: remove qualquer
 * substring que pareça segredo antes de gravar.
 */

const CHAVES_SENSIVEIS = /(api[_-]?key|token|secret|senha|password|authorization|bearer|key\s*=|<API_KEY>|<SECRET>)/i;

/** Remove trechos que pareçam credencial de uma mensagem livre. */
export function sanitizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .replace(/(api[_-]?key|token|secret|senha|password|authorization|bearer)["'\s:=]+[\w\-./+]{8,}/gi, '$1=***')
    .replace(/sk-[A-Za-z0-9]{8,}/g, 'sk-***')
    .replace(/AKIA[0-9A-Z]{8,}/g, 'AKIA***')
    .slice(0, 500);
}

export type ComponenteLog =
  | 'busca' | 'whatsapp' | 'inbound' | 'ia' | 'banco' | 'geral';

export type NivelLog = 'erro' | 'aviso' | 'info';

/**
 * Registra um evento sanitizado. `detalhe` é opcional e já deve vir seguro;
 * `erro` (se for um Error/objeto) tem apenas message/dados públicos extraídos.
 * `contaId` null = super admin / sistema.
 */
export async function registrarLog(
  admin: import('@supabase/supabase-js').SupabaseClient,
  params: {
    componente: ComponenteLog;
    operacao: string;
    nivel?: NivelLog;
    codigo?: string;
    mensagem: string;
    contaId?: string | null;
    correlationId?: string | null;
  },
): Promise<void> {
  const nivel = params.nivel ?? 'erro';
  const texto = sanitizarTexto(params.mensagem);
  if (!texto) return; // nunca grava log vazio

  // Não grava se por acaso passaram um segredo cru no corpo.
  if (CHAVES_SENSIVEIS.test(texto) && !texto.includes('***')) {
    return;
  }

  try {
    await admin
      .from('historico_contato')
      .insert({
        conta_id: params.contaId ?? null,
        telefone: `log:${params.componente}`,
        provider: 'sistema',
        canal: 'log',
        status: nivel,
        origem: 'log',
        motivo_bloqueio: sanitizarTexto(
          `${params.operacao}${params.codigo ? ` [${params.codigo}]` : ''}${params.correlationId ? ` cid:${params.correlationId}` : ''}: ${texto}`,
        ),
      });
  } catch {
    // log nunca deve derrubar o fluxo principal
  }
}
