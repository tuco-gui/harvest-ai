import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { salvarLeads, gerarPlaceIdSintetico } from '@/lib/leads';

/**
 * Persiste leads de planilha ou entrada manual — mesmo tratamento que a
 * busca do Google Maps já tem (place_id, dedupe, duplicado avisado em vez
 * de roubar campanha), só que o place_id é sintético (não existe CNPJ nem
 * ID do Google pra isso) porque não veio do Maps.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada. Entre de novo.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta antes de importar.' }, { status: 400 });

  const { leads, origem, campanhaId } = await req.json().catch(() => ({}) as Record<string, unknown>);
  if (!Array.isArray(leads) || !leads.length) {
    return NextResponse.json({ erro: 'Nenhum lead pra importar.' }, { status: 400 });
  }
  const origemValida = origem === 'manual' ? 'manual' : 'csv';

  const comId = (leads as any[])
    .filter((l) => l?.telefone)
    .map((l) => ({
      place_id: gerarPlaceIdSintetico(perfil.conta_id!, origemValida, l.telefone),
      empresa: l.empresa || 'Sem nome',
      telefone: l.telefone,
      telefone_original: l.telefone_original ?? l.telefone,
      endereco: l.endereco ?? null,
      especialidades: l.especialidades ?? null,
      rating: null,
      reviews: null,
      site: l.site ?? null,
      latitude: null,
      longitude: null,
      tem_whatsapp: (l.temWhatsapp === true ? 'sim' : l.temWhatsapp === false ? 'nao' : 'nao_verificado') as
        'sim' | 'nao' | 'nao_verificado',
    }));

  const admin = supabaseAdmin();
  const { porPlaceId, novos } = await salvarLeads(
    admin, perfil.conta_id, comId, typeof campanhaId === 'number' ? campanhaId : null,
    origemValida === 'manual' ? 'manual' : 'planilha',
  );

  return NextResponse.json({
    ok: true,
    novos,
    leads: comId.map((l) => ({
      ...l,
      duplicado: porPlaceId[l.place_id]?.duplicado ?? false,
      campanhaAnterior: porPlaceId[l.place_id]?.campanhaAnterior ?? null,
    })),
  });
}
