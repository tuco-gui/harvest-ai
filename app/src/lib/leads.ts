import type { SupabaseClient } from '@supabase/supabase-js';

/** Um lead repetido (mesmo place_id) não pode simplesmente reescrever
 *  campanha_id: se "Joalheria X" já estava na campanha "Busca de terça" e a
 *  mesma busca roda de novo hoje, ela não pode "sumir" de terça só porque
 *  apareceu de novo — por isso quem já existe só tem os dados atualizados
 *  (rating, telefone, WhatsApp), nunca campanha_id, e volta marcado como
 *  duplicado pra tela avisar (e a conta decidir excluir, se quiser).
 *  Usado tanto pela busca do Google Maps (place_id real) quanto por
 *  planilha/manual (place_id sintético, ver gerarPlaceIdSintetico). */

export type LeadParaSalvar = {
  place_id: string;
  empresa: string;
  telefone: string | null;
  telefone_original: string | null;
  endereco: string | null;
  especialidades: string | null;
  rating: number | null;
  reviews: number | null;
  site: string | null;
  latitude: number | null;
  longitude: number | null;
  tem_whatsapp: 'sim' | 'nao' | 'nao_verificado';
};

export type InfoDuplicado = { duplicado: boolean; campanhaAnterior: string | null };

export async function salvarLeads(
  admin: SupabaseClient, contaId: string, leads: LeadParaSalvar[],
  campanhaId: number | null, origem: string,
): Promise<{ porPlaceId: Record<string, InfoDuplicado>; novos: number }> {
  if (!leads.length) return { porPlaceId: {}, novos: 0 };

  const { data: jaExistiam } = await admin
    .from('prospecta_leads')
    .select('place_id, campanha_id')
    .eq('conta_id', contaId)
    .in('place_id', leads.map((l) => l.place_id));
  const existentes: Record<string, number | null> = Object.fromEntries(
    (jaExistiam ?? []).map((r: any) => [r.place_id, r.campanha_id]),
  );

  const novosLeads = leads.filter((l) => !(l.place_id in existentes));
  const duplicados = leads.filter((l) => l.place_id in existentes);

  if (novosLeads.length) {
    await admin.from('prospecta_leads').upsert(novosLeads.map((l) => ({
      ...l, conta_id: contaId, origem, campanha_id: campanhaId,
    })), { onConflict: 'place_id', ignoreDuplicates: false });
  }
  await Promise.all(duplicados.map((l) => admin
    .from('prospecta_leads')
    .update({
      telefone: l.telefone, telefone_original: l.telefone_original, endereco: l.endereco,
      rating: l.rating, reviews: l.reviews, site: l.site, latitude: l.latitude, longitude: l.longitude,
      tem_whatsapp: l.tem_whatsapp,
    })
    .eq('place_id', l.place_id).eq('conta_id', contaId)));

  const idsCampanhaAnterior = [...new Set(duplicados.map((l) => existentes[l.place_id]).filter((id): id is number => !!id))];
  let nomesCampanha: Record<number, string> = {};
  if (idsCampanhaAnterior.length) {
    const { data: campanhasAnteriores } = await admin.from('prospecta_campanhas').select('id, nome').in('id', idsCampanhaAnterior);
    nomesCampanha = Object.fromEntries((campanhasAnteriores ?? []).map((c: any) => [c.id, c.nome]));
  }

  const porPlaceId: Record<string, InfoDuplicado> = {};
  for (const l of leads) {
    const campanhaAnteriorId = existentes[l.place_id];
    porPlaceId[l.place_id] = {
      duplicado: l.place_id in existentes,
      campanhaAnterior: campanhaAnteriorId ? (nomesCampanha[campanhaAnteriorId] ?? null) : null,
    };
  }
  return { porPlaceId, novos: novosLeads.length };
}

/** CSV e entrada manual não têm place_id do Google — geramos um estável a
 *  partir do telefone, escopado pela conta (place_id é único no banco
 *  inteiro, então sem o conta_id dois clientes com o mesmo telefone na
 *  planilha colidiriam um no place_id do outro). */
export function gerarPlaceIdSintetico(contaId: string, origem: 'csv' | 'manual', telefone: string): string {
  return `${origem}:${contaId}:${telefone}`;
}
