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

/**
 * Remove o lead da campanha (Entrega 22 — edição de campanha). Só apaga o
 * vínculo N:N; NUNCA apaga o lead nem seu histórico de contato/mensagens —
 * isso preserva rastreabilidade mesmo depois de removido de uma campanha
 * específica. Se `prospecta_leads.campanha_id` (a "campanha de origem")
 * ainda apontava para esta campanha, é reatribuída para outra campanha em
 * que o lead ainda esteja (se houver) ou fica null — sem isso a página de
 * detalhe da campanha continuaria mostrando o lead removido (ela também lê
 * por essa FK para compatibilidade com registros antigos, ver
 * app/(app)/campanhas/[id]/page.tsx).
 */
export async function desvincularLeadDaCampanha(
  admin: SupabaseClient, contaId: string, campanhaId: number, leadId: number,
): Promise<void> {
  await admin.from('campanha_leads').delete()
    .eq('conta_id', contaId).eq('campanha_id', campanhaId).eq('lead_id', leadId);

  const { data: lead } = await admin
    .from('prospecta_leads').select('campanha_id').eq('id', leadId).eq('conta_id', contaId).maybeSingle();
  if (lead?.campanha_id !== campanhaId) return;

  const { data: outraCampanha } = await admin
    .from('campanha_leads').select('campanha_id').eq('lead_id', leadId).eq('conta_id', contaId).limit(1).maybeSingle();
  await admin.from('prospecta_leads').update({ campanha_id: outraCampanha?.campanha_id ?? null })
    .eq('id', leadId).eq('conta_id', contaId);
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
