import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarTelefone } from './telefone';

/**
 * Supressão central por conta+telefone (conta_supressao). Independe de
 * campanha e de provider (WAHA/Evolution) — é a barreira final antes de
 * QUALQUER disparo, não uma regra por campanha.
 */

export type MotivoSupressao = 'opt_out' | 'manual' | 'reclamacao' | 'invalido';

/** true = telefone suprimido, não pode receber disparo desta conta. */
export async function estaSuprimido(
  admin: SupabaseClient, contaId: string, telefone: string,
): Promise<boolean> {
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return false; // sem telefone válido não há o que suprimir aqui
  const { data } = await admin
    .from('conta_supressao')
    .select('id')
    .eq('conta_id', contaId)
    .eq('telefone', normalizado)
    .maybeSingle();
  return !!data;
}

/** Idempotente: suprimir um telefone já suprimido não é erro, só atualiza motivo/observação. */
export async function suprimirTelefone(
  admin: SupabaseClient, contaId: string, telefone: string,
  motivo: MotivoSupressao, criadoPor?: string | null, observacao?: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return { ok: false, erro: 'Telefone inválido.' };
  const { error } = await admin
    .from('conta_supressao')
    .upsert(
      { conta_id: contaId, telefone: normalizado, motivo, criado_por: criadoPor ?? null, observacao: observacao ?? null },
      { onConflict: 'conta_id, telefone' },
    );
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
