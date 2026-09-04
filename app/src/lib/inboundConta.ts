import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolução de conta para eventos inbound (Fase 3B) — NUNCA confia em um
 * conta_id que o provider externo tenha mandado no corpo do webhook (nada
 * impede um terceiro de forjar isso). A conta é sempre deduzida a partir de
 * algo que só o Harvest controla: o nome da sessão WAHA (gerado
 * deterministicamente a partir do conta_id, ver lib/waha.ts) ou o nome da
 * instância Evolution cadastrada em conta_credenciais.
 *
 * Se não for possível confirmar a conta com segurança, as duas funções
 * devolvem null — quem chama não deve inventar um vínculo.
 */

/**
 * Dois formatos de nome de sessão:
 * - Legado (single-canal): `conta_<uuid_sem_hifens>` (32 hex chars)
 * - Multicanal: `harvest_<uuid_sem_hifens>_c<canalId>`
 * Ambos contêm o UUID (32 hex) em alguma posição — extraímos o primeiro
 * match de 32 hex consecutios para reconstruir o conta_id.
 */
const REGEX_UUID_HEX = /[0-9a-f]{32}/i;

/** Reconstrói o UUID a partir de 32 hex consecutivos no nome da sessão. */
function contaIdDoSessionWaha(sessionName: string): string | null {
  const m = REGEX_UUID_HEX.exec(sessionName);
  if (!m) return null;
  const hex = m[0];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * WAHA: reconstrói o conta_id a partir do nome da sessão e CONFIRMA contra
 * o banco que essa conta existe e está de fato configurada para WAHA — a
 * reconstrução do nome sozinha não é prova suficiente.
 */
export async function resolverContaWaha(
  admin: SupabaseClient, sessionName: string | null,
): Promise<string | null> {
  if (!sessionName) return null;
  const contaId = contaIdDoSessionWaha(sessionName);
  if (!contaId) return null;

  const { data, error } = await admin
    .from('conta_credenciais')
    .select('conta_id, whatsapp_provider')
    .eq('conta_id', contaId)
    .maybeSingle();
  if (error || !data || data.whatsapp_provider !== 'waha') return null;
  return contaId;
}

/**
 * Evolution: não há regra determinística para reconstruir o conta_id a
 * partir do nome da instância (é um texto livre cadastrado em
 * Configurações), então resolve por busca — e só aceita se encontrar
 * EXATAMENTE uma conta com essa instância configurada como provider ativo.
 * 0 ou mais de 1 resultado = não resolve com segurança.
 */
export async function resolverContaEvolution(
  admin: SupabaseClient, instancia: string | null,
): Promise<string | null> {
  if (!instancia) return null;

  const { data, error } = await admin
    .from('conta_credenciais')
    .select('conta_id')
    .eq('evolution_instancia', instancia)
    .eq('whatsapp_provider', 'evolution');
  if (error || !data || data.length !== 1) return null;
  return data[0].conta_id as string;
}
