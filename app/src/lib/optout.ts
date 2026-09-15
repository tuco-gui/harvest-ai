import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarTelefone } from './telefone';

/**
 * Sistema de opt-out como PREFERÊNCIA (não bloqueio absoluto).
 *
 * - opt_outs: registro rico de quem pediu para não receber mensagens
 * - opt_out_overrides: auditoria quando alguém envia apesar de opt-out
 * - contas.optout_override_policy: quem pode sobrescrever na workspace
 * - perfis.pode_enviar_optout: permissão granular por operador
 *
 * O opt-out antigo (conta_supressao) continua sendo populado para retrocompatibilidade.
 */

// ===================== TIPOS =====================

export type OptOutStatus = 'ativo' | 'removido';
export type OptOutMotivo = 'mensagem' | 'manual' | 'reclamacao';
export type OptOutOrigem = 'inbound' | 'manual' | 'importacao';
export type OptOutCriadoPorTipo = 'contato' | 'operador' | 'admin' | 'automacao' | 'sistema';
export type OverridePolicy = 'nenhum' | 'admin' | 'admin_operadores' | 'qualquer';

export interface OptOut {
  id: number;
  conta_id: string;
  telefone: string;
  status: OptOutStatus;
  motivo: OptOutMotivo;
  mensagem_geradora: string | null;
  criado_por: string | null;
  criado_por_tipo: OptOutCriadoPorTipo;
  criado_em: string;
  removido_por: string | null;
  motivo_remocao: string | null;
  removido_em: string | null;
  origem: OptOutOrigem;
}

export interface OptOutOverride {
  id: number;
  conta_id: string;
  opt_out_id: number;
  telefone: string;
  autorizado_por: string;
  autorizado_por_tipo: 'admin' | 'super_admin' | 'operador_autorizado';
  enviado_por: string | null;
  data_hora: string;
  motivo: string;
  campanha_id: number | null;
  oportunidade_id: number | null;
  canal_id: number | null;
  canal_nome: string | null;
}

export type Papel = 'super_admin' | 'admin' | 'operador';

// ===================== VERIFICAÇÃO =====================

/** Verifica se telefone está em opt-out ativo na conta. */
export async function estaEmOptOut(
  admin: SupabaseClient, contaId: string, telefone: string,
): Promise<OptOut | null> {
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return null;
  const { data } = await admin
    .from('opt_outs')
    .select('*')
    .eq('conta_id', contaId)
    .eq('telefone', normalizado)
    .eq('status', 'ativo')
    .maybeSingle();
  return data as OptOut | null;
}

// ===================== REGISTRO =====================

/** Registra opt-out. Idempotente: se já existe ativo, atualiza motivo/observação. */
export async function registrarOptOut(
  admin: SupabaseClient,
  params: {
    contaId: string;
    telefone: string;
    motivo?: OptOutMotivo;
    mensagemGeradora?: string | null;
    criadoPor?: string | null;
    criadoPorTipo?: OptOutCriadoPorTipo;
    origem?: OptOutOrigem;
  },
): Promise<{ ok: boolean; optOutId?: number; erro?: string }> {
  const normalizado = normalizarTelefone(params.telefone);
  if (!normalizado) return { ok: false, erro: 'Telefone inválido.' };

  // Upsert: se já existe opt-out ativo, mantém (idempotente)
  const { data: existente } = await admin
    .from('opt_outs')
    .select('id')
    .eq('conta_id', params.contaId)
    .eq('telefone', normalizado)
    .eq('status', 'ativo')
    .maybeSingle();

  if (existente) {
    return { ok: true, optOutId: existente.id };
  }

  // Se existe um removido, reativa
  const { data: removido } = await admin
    .from('opt_outs')
    .select('id')
    .eq('conta_id', params.contaId)
    .eq('telefone', normalizado)
    .eq('status', 'removido')
    .maybeSingle();

  if (removido) {
    const { error } = await admin
      .from('opt_outs')
      .update({
        status: 'ativo',
        motivo: params.motivo ?? 'mensagem',
        mensagem_geradora: params.mensagemGeradora ?? null,
        criado_por: params.criadoPor ?? null,
        criado_por_tipo: params.criadoPorTipo ?? 'contato',
        origem: params.origem ?? 'inbound',
        removido_por: null,
        motivo_remocao: null,
        removido_em: null,
      })
      .eq('id', removido.id);
    if (error) return { ok: false, erro: error.message };
    return { ok: true, optOutId: removido.id };
  }

  // Novo opt-out
  const { data, error } = await admin
    .from('opt_outs')
    .insert({
      conta_id: params.contaId,
      telefone: normalizado,
      status: 'ativo',
      motivo: params.motivo ?? 'mensagem',
      mensagem_geradora: params.mensagemGeradora ?? null,
      criado_por: params.criadoPor ?? null,
      criado_por_tipo: params.criadoPorTipo ?? 'contato',
      origem: params.origem ?? 'inbound',
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };

  // Manter retrocompatibilidade: also write to conta_supressao
  await admin
    .from('conta_supressao')
    .upsert(
      { conta_id: params.contaId, telefone: normalizado, motivo: 'opt_out', criado_por: params.criadoPor ?? null },
      { onConflict: 'conta_id, telefone' },
    )
    .then(() => {});

  return { ok: true, optOutId: data!.id };
}

// ===================== OVERRIDE (ENVIO APESAR DE OPT-OUT) =====================

/** Verifica se o usuário pode sobrescrever opt-out nesta workspace. */
export async function podeSobrescreverOptOut(
  admin: SupabaseClient,
  contaId: string,
  perfilId: string,
  papel: Papel,
): Promise<{ permitido: boolean; motivo?: string }> {
  // Super admin sempre pode
  if (papel === 'super_admin') return { permitido: true };

  // Buscar política da workspace
  const { data: conta } = await admin
    .from('contas')
    .select('optout_override_policy')
    .eq('id', contaId)
    .maybeSingle();

  const policy: OverridePolicy = conta?.optout_override_policy ?? 'admin';

  switch (policy) {
    case 'nenhum':
      return { permitido: false, motivo: 'Esta workspace não permite sobrescrever opt-outs.' };

    case 'admin':
      if (papel === 'admin') return { permitido: true };
      return { permitido: false, motivo: 'Apenas administradores podem sobrescrever opt-outs nesta workspace.' };

    case 'admin_operadores':
      if (papel === 'admin') return { permitido: true };
      if (papel === 'operador') {
        // Verificar permissão granular do operador
        const { data: perfil } = await admin
          .from('perfis')
          .select('pode_enviar_optout')
          .eq('id', perfilId)
          .maybeSingle();
        if (perfil?.pode_enviar_optout) return { permitido: true };
        return { permitido: false, motivo: 'Você não tem permissão para sobrescrever opt-outs. Solicite ao administrador.' };
      }
      return { permitido: false, motivo: 'Papel não reconhecido.' };

    case 'qualquer':
      return { permitido: true };

    default:
      return { permitido: false, motivo: 'Política de opt-out não reconhecida.' };
  }
}

/** Registra override (auditoria). NÃO remove o opt-out. */
export async function registrarOverride(
  admin: SupabaseClient,
  params: {
    contaId: string;
    optOutId: number;
    telefone: string;
    autorizadoPor: string;
    autorizadoPorTipo: 'admin' | 'super_admin' | 'operador_autorizado';
    enviadoPor?: string | null;
    motivo: string;
    campanhaId?: number | null;
    oportunidadeId?: number | null;
    canalId?: number | null;
    canalNome?: string | null;
  },
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await admin
    .from('opt_out_overrides')
    .insert({
      conta_id: params.contaId,
      opt_out_id: params.optOutId,
      telefone: params.telefone,
      autorizado_por: params.autorizadoPor,
      autorizado_por_tipo: params.autorizadoPorTipo,
      enviado_por: params.enviadoPor ?? null,
      motivo: params.motivo,
      campanha_id: params.campanhaId ?? null,
      oportunidade_id: params.oportunidadeId ?? null,
      canal_id: params.canalId ?? null,
      canal_nome: params.canalNome ?? null,
    });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

// ===================== REMOÇÃO =====================

/** Remove opt-out (exige motivo). */
export async function removerOptOut(
  admin: SupabaseClient,
  params: {
    optOutId: number;
    contaId: string;
    removidoPor: string;
    motivoRemocao: string;
  },
): Promise<{ ok: boolean; erro?: string }> {
  if (!params.motivoRemocao?.trim()) {
    return { ok: false, erro: 'Informe o motivo da remoção do opt-out.' };
  }

  const { data: optOut } = await admin
    .from('opt_outs')
    .select('id, status')
    .eq('id', params.optOutId)
    .eq('conta_id', params.contaId)
    .maybeSingle();

  if (!optOut) return { ok: false, erro: 'Opt-out não encontrado.' };
  if (optOut.status === 'removido') return { ok: false, erro: 'Opt-out já foi removido.' };

  const { error } = await admin
    .from('opt_outs')
    .update({
      status: 'removido',
      removido_por: params.removidoPor,
      motivo_remocao: params.motivoRemocao,
      removido_em: new Date().toISOString(),
    })
    .eq('id', params.optOutId);

  if (error) return { ok: false, erro: error.message };

  // Remover de conta_supressao também (retrocompatibilidade)
  const { data: optOutFull } = await admin
    .from('opt_outs')
    .select('telefone')
    .eq('id', params.optOutId)
    .maybeSingle();
  if (optOutFull) {
    await admin
      .from('conta_supressao')
      .delete()
      .eq('conta_id', params.contaId)
      .eq('telefone', optOutFull.telefone);
  }

  return { ok: true };
}

// ===================== LISTAGEM =====================

/** Lista opt-outs de uma conta. */
export async function listarOptOuts(
  admin: SupabaseClient,
  contaId: string,
  opcoes?: { status?: OptOutStatus; limite?: number; offset?: number },
): Promise<{ dados: OptOut[]; total: number }> {
  let query = admin
    .from('opt_outs')
    .select('*', { count: 'exact' })
    .eq('conta_id', contaId);

  if (opcoes?.status) {
    query = query.eq('status', opcoes.status);
  }

  query = query.order('criado_em', { ascending: false });

  if (opcoes?.limite) {
    query = query.range(opcoes.offset ?? 0, (opcoes.offset ?? 0) + opcoes.limite - 1);
  }

  const { data, count } = await query;
  return { dados: (data as OptOut[]) ?? [], total: count ?? 0 };
}

/** Lista overrides de uma conta. */
export async function listarOverrides(
  admin: SupabaseClient,
  contaId: string,
  opcoes?: { limite?: number; offset?: number },
): Promise<{ dados: OptOutOverride[]; total: number }> {
  let query = admin
    .from('opt_out_overrides')
    .select('*', { count: 'exact' })
    .eq('conta_id', contaId)
    .order('data_hora', { ascending: false });

  if (opcoes?.limite) {
    query = query.range(opcoes.offset ?? 0, (opcoes.offset ?? 0) + opcoes.limite - 1);
  }

  const { data, count } = await query;
  return { dados: (data as OptOutOverride[]) ?? [], total: count ?? 0 };
}

// ===================== POLÍTICA =====================

/** Busca política de override da workspace. */
export async function buscarPolitica(
  admin: SupabaseClient, contaId: string,
): Promise<OverridePolicy> {
  const { data } = await admin
    .from('contas')
    .select('optout_override_policy')
    .eq('id', contaId)
    .maybeSingle();
  return (data?.optout_override_policy as OverridePolicy) ?? 'admin';
}

/** Atualiza política de override da workspace (só admin/super_admin). */
export async function atualizarPolitica(
  admin: SupabaseClient, contaId: string, nova: OverridePolicy,
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await admin
    .from('contas')
    .update({ optout_override_policy: nova })
    .eq('id', contaId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
