import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventoInboundNormalizado } from './inboundTipos';
import { classificarMensagem } from './optoutResposta';
import { suprimirTelefone } from './supressao';

/**
 * Pipeline comercial único de inbound (Fase 3B) — depois que um adapter
 * (lib/inboundWaha.ts ou lib/inboundEvolution.ts) normaliza o payload e a
 * conta foi resolvida (lib/inboundConta.ts), TODO evento passa por aqui,
 * não importa o provider. É isso que evita ter duas lógicas comerciais
 * (uma por webhook) — as rotas app/api/webhook/* só fazem parsing + adapter
 * + chamada a esta função.
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

  // Conta não resolvida com segurança: registra erro técnico e para aqui.
  // Nunca associa o evento à conta errada, e nunca grava numa tabela sem
  // conta_id — inbound_eventos é multi-tenant com RLS por conta_id.
  if (!contaId) {
    console.error(
      `[inbound] ${evento.provider}: evento ${evento.messageIdExterno} não pôde ser associado a uma conta com segurança — descartado, nenhum dado gravado.`,
    );
    return { ok: false, erro: 'conta_nao_resolvida' };
  }

  // Idempotência: mesma (conta, provider, message_id) não processa duas
  // vezes — checa antes de fazer qualquer trabalho de correlação.
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

  // Correlação SEMPRE por telefone normalizado + conta — nunca por nome ou
  // fuzzy matching. Se não achar, segue sem lead/campanha (evento ainda é
  // válido: "telefone desconhecido aceito como inbound sem inventar vínculo").
  const { data: lead } = await admin
    .from('prospecta_leads')
    .select('id')
    .eq('conta_id', contaId)
    .eq('telefone', evento.telefone)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const leadId: number | null = lead?.id ?? null;

  // Última campanha/contato relevante para esse telefone — só preparação
  // para a Fase 3C (status de resposta) e 3D (Chatwoot). Não altera nada em
  // Twenty/oportunidade nesta fase.
  const { data: ultimoContato } = await admin
    .from('historico_contato')
    .select('campanha_id')
    .eq('conta_id', contaId)
    .eq('telefone', evento.telefone)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  const campanhaId: number | null = ultimoContato?.campanha_id ?? null;

  // Classificação da mensagem para a 3C (opt-out vs resposta) — precisa estar
  // disponível tanto no insert de inbound_eventos quanto no reflixo no funil.
  const classificacao = classificarMensagem(evento.mensagem);

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
    // 23505 = unique_violation — corrida rara entre o check acima e o
    // insert (dois webhooks quase simultâneos do mesmo evento). Ainda é
    // idempotência, não erro de verdade.
    if ((error as { code?: string }).code === '23505') {
      return { ok: true, duplicado: true, eventoId: -1 };
    }
    return { ok: false, erro: error.message };
  }

  // --- Fase 3C: refletir a classificação no funil ---
  const agora = new Date().toISOString();

  // 1) Opt-out: marca supressão central (já bloqueia disparo via 016) e
  //    registra no histórico (origem='resposta', status='optout').
  if (classificacao === 'optout') {
    await suprimirTelefone(admin, contaId, evento.telefone, 'opt_out');
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
  } else {
    // 2) Resposta comum: marca o lead como "respondeu" (sem sobrescrever a
    //    primeira resposta) e registra entrada no histórico.
    if (leadId) {
      await admin.from('prospecta_leads')
        .update({ respondeu_em: agora, status: 'respondeu', atualizado_em: agora })
        .eq('id', leadId)
        .is('respondeu_em', null);
    }
    await admin.from('historico_contato').insert({
      conta_id: contaId,
      lead_id: leadId,
      campanha_id: campanhaId,
      telefone: evento.telefone,
      provider: evento.provider,
      canal: 'whatsapp',
      status: 'recebido',
      origem: 'resposta',
    });
  }

  return { ok: true, eventoId: inserido.id, leadId, campanhaId };
}
