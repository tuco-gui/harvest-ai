import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventoInboundNormalizado } from './inboundTipos';
import { classificarMensagem } from './optoutResposta';
import { suprimirTelefone } from './supressao';
import { processarAutomacoes } from './automacoes';

/**
 * Pipeline de inbound (Fase 3B → P1 refatorado).
 *
 * Fluxo obrigatório:
 *   receber → registrar → classificar → processar automações
 *
 * O pipeline NÃO movimenta o funil automaticamente. Toda movimentação
 * CRM (mover estágio, encerrar, atribuir, etc.) é feita por automações
 * configuráveis pelo administrador (lib/automacoes.ts).
 *
 * A única ação mandatória é supressão de opt-out (novo disparo bloqueado),
 * porque isso é proteção legal/operacional, não uma decisão de CRM.
 *
 * Chatwoot é a fonte de verdade de conversas/inboxes. Este pipeline
 * alimenta inbound_eventos (contexto Harvest) — não substitui Chatwoot.
 */

export type ResultadoInbound =
  | { ok: true; ignorado: true; motivo: string }
  | { ok: true; duplicado: true; eventoId: number }
  | { ok: true; eventoId: number; leadId: number | null; campanhaId: number | null }
  | { ok: false; erro: string };

export async function processarEventoInbound(
  admin: SupabaseClient,
  evento: EventoInboundNormalizado,
  contaId: string | null,
): Promise<ResultadoInbound> {
  // Eco do próprio envio do Harvest — não é uma resposta recebida.
  if (evento.fromMe) {
    return { ok: true, ignorado: true, motivo: 'mensagem enviada pelo próprio Harvest (fromMe)' };
  }

  // Conta não resolvida: descarta com segurança.
  if (!contaId) {
    console.error(
      `[inbound] ${evento.provider}: evento ${evento.messageIdExterno} sem conta associada — descartado. tel=${evento.telefone}`,
    );
    return { ok: false, erro: 'conta_nao_resolvida' };
  }

  // Idempotência: mesma (conta, provider, message_id) não processa duas vezes.
  const { data: existente } = await admin
    .from('inbound_eventos')
    .select('id')
    .eq('conta_id', contaId)
    .eq('provider', evento.provider)
    .eq('message_id_externo', evento.messageIdExterno)
    .maybeSingle();
  if (existente) {
    return { ok: true, duplicado: true, eventoId: existente.id };
  }

  // Correlação por telefone normalizado + conta.
  const { data: lead } = await admin
    .from('prospecta_leads')
    .select('id')
    .eq('conta_id', contaId)
    .eq('telefone', evento.telefone)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const leadId: number | null = lead?.id ?? null;

  // Última campanha relevante para este telefone.
  const { data: ultimoContato } = await admin
    .from('historico_contato')
    .select('campanha_id')
    .eq('conta_id', contaId)
    .eq('telefone', evento.telefone)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  const campanhaId: number | null = ultimoContato?.campanha_id ?? null;

  // Classificação (P2): resposta / negativa / optout.
  const classificacao = classificarMensagem(evento.mensagem);

  // --- REGISTRAR ---
  const { data: inserido, error } = await admin
    .from('inbound_eventos')
    .insert({
      conta_id: contaId,
      provider: evento.provider,
      telefone: evento.telefone,
      mensagem: evento.mensagem,
      message_id_externo: evento.messageIdExterno,
      tipo_mensagem: evento.tipoMensagem,
      nome_contato: evento.nomeContato,
      lead_id: leadId,
      campanha_id: campanhaId,
      payload_bruto: evento.payloadBruto,
      recebido_em: evento.timestamp,
      tipo_evento: classificacao,
    })
    .select('id')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { ok: true, duplicado: true, eventoId: -1 };
    }
    return { ok: false, erro: error.message };
  }

  const agora = new Date().toISOString();

  // --- CLASSIFICAR → AÇÕES MANDATÓRIAS ---
  // Supressão de opt-out é a ÚNICA ação que o pipeline executa direto.
  // É proteção legal/operacional, não decisão de CRM.
  if (classificacao === 'optout') {
    // Supressão: impede novos disparos para este telefone (mandatório).
    await suprimirTelefone(admin, contaId, evento.telefone, 'opt_out');
    // Histórico do lead (se conhecido).
    if (leadId) {
      await admin.from('historico_contato').insert({
        conta_id: contaId,
        lead_id: leadId,
        campanha_id: campanhaId,
        telefone: evento.telefone,
        provider: evento.provider,
        canal: 'whatsapp',
        status: 'optout',
        origem: 'resposta',
        motivo_bloqueio: 'Opt-out solicitado pelo contato via mensagem inbound.',
      });
    }
  } else {
    // Resposta ou negativa: registrar no histórico do lead (se conhecido).
    if (leadId) {
      await admin.from('prospecta_leads')
        .update({ respondeu_em: agora, status: 'respondeu', atualizado_em: agora })
        .eq('id', leadId)
        .is('respondeu_em', null);
      await admin.from('historico_contato').insert({
        conta_id: contaId,
        lead_id: leadId,
        campanha_id: campanhaId,
        telefone: evento.telefone,
        provider: evento.provider,
        canal: 'whatsapp',
        status: classificacao === 'negativa' ? 'negativa' : 'recebido',
        origem: 'resposta',
      });
    }
  }

  // --- PROCESSAR AUTOMAÇÕES ---
  // Toda movimentação CRM (mover estágio, encerrar, atribuir, etiqueta, etc.)
  // acontece aqui, via regras configuráveis pelo admin.
  // O pipeline NÃO movimenta o funil direto — isso é responsabilidade
  // das automações (lib/automacoes.ts).
  try {
    let oportunidadeId: number | null = null;
    let estagioAtual: string | null = null;

    if (leadId) {
      const { data: op } = await admin
        .from('oportunidades')
        .select('id, estagio')
        .eq('conta_id', contaId)
        .eq('lead_id', leadId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      oportunidadeId = op?.id ?? null;
      estagioAtual = op?.estagio ?? null;
    }
    if (!oportunidadeId && evento.telefone) {
      const { data: op } = await admin
        .from('oportunidades')
        .select('id, estagio')
        .eq('conta_id', contaId)
        .eq('telefone', evento.telefone)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      oportunidadeId = op?.id ?? null;
      estagioAtual = op?.estagio ?? null;
    }

    if (oportunidadeId) {
      await processarAutomacoes(admin, {
        contaId,
        telefone: evento.telefone,
        mensagem: evento.mensagem,
        leadId,
        campanhaId,
        oportunidadeId,
        estagioAtual,
        classificacao,
        agora,
        eventoInboundId: inserido.id,
      });
    }
  } catch (e) {
    // Falha segura: erro em automação NÃO bloqueia o inbound.
    console.error(`[inbound] erro ao processar automações tel=${evento.telefone}:`, e);
  }

  return { ok: true, eventoId: inserido.id, leadId, campanhaId };
}
