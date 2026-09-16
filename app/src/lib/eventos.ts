/**
 * Dispatcher de eventos do Harvest (thin adapter).
 *
 * Este módulo é o ÚNICO ponto de entrada para emitir eventos de negócio.
 * Ele NÃO é um motor de automações — apenas despacha para:
 *   - Chatwoot (via webhook/adapter) para eventos de conversa
 *   - Twenty (via backend) para movimentação de pipeline
 *   - processarAutomacoes (lib/automacoes.ts) para regras configuráveis
 *
 * Regras:
 *   - NÃO criar novo motor de eventos, fila, state machine ou tabela eventos_harvest
 *   - NÃO duplicar inbound: Chatwoot é source of truth de conversas
 *   - Todo lookup em funil_estagios é por funil_id (tabela não tem conta_id)
 *   - Falha segura: erro aqui NÃO bloqueia a operação que originou o evento
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { processarAutomacoes } from './automacoes';

export type TipoEvento =
  | 'mensagem_recebida'
  | 'mensagem_enviada'
  | 'resposta_positiva'
  | 'resposta_negativa'
  | 'opt_out';

export type EventoNegocio = {
  tipo: TipoEvento;
  contaId: string;
  oportunidadeId: number | null;
  leadId: number | null;
  telefone: string;
  mensagem: string | null;
  agora: string;
  /** Para eventos inbound — ID do inbound_eventos já registrado. */
  eventoInboundId?: number | null;
};

/**
 * Emite um evento de negócio e despacha para os handlers apropriados.
 *
 * Para eventos INBOUND (mensagem_recebida, resposta_positiva, etc.):
 *   → processarAutomacoes (regras configuráveis do funil)
 *
 * Para eventos OUTBOUND (mensagem_enviada):
 *   → processarAutomacoes (regras com gatilho mensagem_enviada)
 *
 * O dispatcher NÃO movimenta o funil direto — ele apenas despacha.
 * Quem decide a movimentação são as automações registradas.
 */
export async function emitirEvento(
  admin: SupabaseClient,
  evento: EventoNegocio,
): Promise<void> {
  console.log(`[eventos] emitir: ${evento.tipo} conta=${evento.contaId} op=${evento.oportunidadeId} tel=${evento.telefone}`);

  // Resolver classificação para eventos inbound
  let classificacao: 'resposta' | 'negativa' | 'optout' = 'resposta';
  if (evento.tipo === 'resposta_negativa') classificacao = 'negativa';
  else if (evento.tipo === 'opt_out') classificacao = 'optout';

  // Despachar para automações (regras configuráveis do funil)
  try {
    await processarAutomacoes(admin, {
      contaId: evento.contaId,
      telefone: evento.telefone,
      mensagem: evento.mensagem,
      leadId: evento.leadId,
      campanhaId: null,
      oportunidadeId: evento.oportunidadeId,
      estagioAtual: null,
      classificacao,
      agora: evento.agora,
      eventoInboundId: evento.eventoInboundId ?? null,
    });
  } catch (e) {
    console.error(`[eventos] falha ao processar automações para ${evento.tipo}:`, e);
  }
}
