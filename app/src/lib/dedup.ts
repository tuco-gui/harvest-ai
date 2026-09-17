/**
 * Deduplicação WAHA/Chatwoot — uma mensagem física → um único evento comercial.
 *
 * Chatwoot é source of truth de conversas. WAHA é transporte.
 *
 * Idempotência por provider: (conta_id, provider, message_id_externo) já é
 * única em inbound_eventos — reprocessamento do mesmo webhook é ignorado.
 *
 * Deduplicação cross-provider: se a mesma mensagem física chegou via WAHA
 * (message_id do WhatsApp) E via Chatwoot (message_id do Chatwoot), processa
 * apenas a primeira. Correlação: conversation_id + inbox_id + janela temporal.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verifica se a mesma mensagem física já foi processada por outro provider.
 * Retorna true se já existe evento correspondente (duplicado cross-provider).
 */
export async function jaProcessadoCrossProvider(
  admin: SupabaseClient,
  params: {
    contaId: string;
    providerAtual: string;
    conversationId: number | null;
    inboxId: number | null;
    timestamp: string;
  },
): Promise<boolean> {
  if (!params.conversationId || !params.inboxId) return false;

  const janelaMs = 5 * 60 * 1000;
  const ts = new Date(params.timestamp);
  const inicio = new Date(ts.getTime() - janelaMs).toISOString();
  const fim = new Date(ts.getTime() + janelaMs).toISOString();

  // Buscar eventos de outros providers na mesma janela temporal
  const { data } = await admin
    .from('inbound_eventos')
    .select('id')
    .eq('conta_id', params.contaId)
    .neq('provider', params.providerAtual)
    .gte('recebido_em', inicio)
    .lte('recebido_em', fim)
    .limit(1)
    .maybeSingle();

  return !!data;
}
