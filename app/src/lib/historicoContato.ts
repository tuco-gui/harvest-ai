import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarTelefone } from './telefone';

/**
 * Histórico de contato (historico_contato) — uma linha por tentativa de
 * disparo. Chave de consulta é o TELEFONE, não o lead_id: o mesmo número
 * pode reaparecer sob um lead/place_id diferente (nova busca, nova planilha),
 * e "esse contato já foi abordado" precisa valer mesmo assim.
 */

export type StatusContato = 'tentativa' | 'enviado' | 'erro' | 'bloqueado_supressao';
export type ProviderContato = 'waha' | 'evolution';

export type ContatoAnterior = {
  abordado: boolean;
  ultimaTentativa: {
    data: string;
    status: StatusContato;
    provider: ProviderContato;
    campanhaId: number | null;
    campanhaNome: string | null;
  } | null;
};

/**
 * Não bloqueia — só informa. A decisão de reenviar é da conta (ver Fase 3A:
 * "não bloquear automaticamente quando não houver opt-out, mas permitir
 * decisão consciente"). Quem bloqueia é a supressão (lib/supressao.ts).
 */
export async function contatoJaAbordado(
  admin: SupabaseClient, contaId: string, telefone: string,
): Promise<ContatoAnterior> {
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return { abordado: false, ultimaTentativa: null };

  const { data } = await admin
    .from('historico_contato')
    .select('criado_em, status, provider, campanha_id')
    .eq('conta_id', contaId)
    .eq('telefone', normalizado)
    .in('status', ['enviado', 'tentativa'])
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { abordado: false, ultimaTentativa: null };

  // Consulta separada em vez de embedded select (mesmo padrão de lib/leads.ts)
  // — evita depender do PostgREST resolver a FK automaticamente.
  let campanhaNome: string | null = null;
  if (data.campanha_id) {
    const { data: campanha } = await admin
      .from('prospecta_campanhas').select('nome').eq('id', data.campanha_id).maybeSingle();
    campanhaNome = campanha?.nome ?? null;
  }

  return {
    abordado: true,
    ultimaTentativa: {
      data: data.criado_em,
      status: data.status,
      provider: data.provider,
      campanhaId: data.campanha_id ?? null,
      campanhaNome,
    },
  };
}

export type RegistrarTentativaParams = {
  contaId: string;
  leadId: number | null;
  campanhaId: number | null;
  mensagemId?: number | null;
  telefone: string;
  provider: ProviderContato;
  status: StatusContato;
  motivoBloqueio?: string | null;
  origem?: string;
};

/** Sempre registra — mesmo tentativa bloqueada por supressão, para auditoria. */
export async function registrarTentativaContato(
  admin: SupabaseClient, p: RegistrarTentativaParams,
): Promise<void> {
  const normalizado = normalizarTelefone(p.telefone) ?? p.telefone;
  await admin.from('historico_contato').insert({
    conta_id: p.contaId,
    lead_id: p.leadId,
    campanha_id: p.campanhaId,
    mensagem_id: p.mensagemId ?? null,
    telefone: normalizado,
    provider: p.provider,
    status: p.status,
    motivo_bloqueio: p.motivoBloqueio ?? null,
    origem: p.origem ?? 'disparo',
  });
}
