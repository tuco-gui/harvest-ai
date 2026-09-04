import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';

/**
 * Controle de acesso por papel para o CRM (Fase 3C+).
 *
 * Regra:
 * - admin/super_admin: vê TODAS as oportunidades/leads da conta
 * - operador: vê SOMENTE oportunidades onde ele é o responsável (owner_id)
 *
 * "Ver" = ler, responder mensagens, adicionar atividades, atualizar dados.
 * "Criar" continua admin-only (decisão de produto).
 *
 * O filtro é aplicado NO BACKEND (API) e também na UI (CrmPipeline),
 * nunca só na UI — segurança em profundidade.
 */

export type Papel = 'super_admin' | 'admin' | 'operador';

export function isAdmin(papel: Papel | string): boolean {
  return papel === 'admin' || papel === 'super_admin';
}

/**
 * Verifica se o perfil pode acessar uma oportunidade específica.
 * Admin sempre pode. Operador só se for o owner_id.
 */
export async function podeAcessarOportunidade(
  admin: SupabaseClient,
  perfil: { id: string; papel: string; conta_id: string | null },
  oportunidadeId: number,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (isAdmin(perfil.papel)) return { ok: true };

  const { data: op } = await admin
    .from('oportunidades')
    .select('owner_id')
    .eq('id', oportunidadeId)
    .eq('conta_id', perfil.conta_id!)
    .maybeSingle();

  if (!op) return { ok: false, erro: 'Oportunidade não encontrada.' };
  if (op.owner_id === perfil.id) return { ok: true };
  return { ok: false, erro: 'Sem permissão para acessar esta oportunidade.' };
}

/**
 * Aplica filtro de visibilidade do operador a uma query de oportunidades.
 * Admin: sem filtro (vê tudo). Operador: filtra por owner_id.
 */
export function filtroVisibilidade(
  query: any,
  papel: string,
  perfilId: string,
  contaId: string,
) {
  if (isAdmin(papel)) return query.eq('conta_id', contaId);
  return query.eq('conta_id', contaId).eq('owner_id', perfilId);
}
