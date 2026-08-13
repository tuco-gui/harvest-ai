import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * campanha_leads — relação N:N entre lead e campanha (Fase 3A). Existe
 * porque `prospecta_leads.campanha_id` sozinho não aguenta "o mesmo lead
 * apareceu em duas campanhas": a coluna vira só a "campanha de origem"
 * (primeira vez que o lead foi visto — ver lib/leads.ts), e esta tabela é
 * quem acumula todas as campanhas em que o lead esteve, sem apagar nada.
 *
 * Idempotente: vincular o mesmo (campanha, lead) duas vezes não duplica
 * (unique constraint + ignoreDuplicates).
 */
export async function vincularLeadACampanha(
  admin: SupabaseClient, contaId: string, campanhaId: number, leadId: number,
  origem: 'busca' | 'planilha' | 'manual' | 'disparo',
): Promise<void> {
  await admin.from('campanha_leads').upsert(
    { conta_id: contaId, campanha_id: campanhaId, lead_id: leadId, origem },
    { onConflict: 'campanha_id, lead_id', ignoreDuplicates: true },
  );
}

/** Variante em lote — usada por lib/leads.ts (salvarLeads) para não fazer 1 upsert por lead. */
export async function vincularLeadsACampanha(
  admin: SupabaseClient, contaId: string, campanhaId: number,
  leadIds: number[], origem: 'busca' | 'planilha' | 'manual' | 'disparo',
): Promise<void> {
  if (!leadIds.length) return;
  await admin.from('campanha_leads').upsert(
    leadIds.map((leadId) => ({ conta_id: contaId, campanha_id: campanhaId, lead_id: leadId, origem })),
    { onConflict: 'campanha_id, lead_id', ignoreDuplicates: true },
  );
}
