import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { enriquecerLead } from '@/lib/enriquecimento';

/**
 * Enriquece um lead sob demanda (nunca em lote automático — cada chamada
 * gasta crédito de Perplexity/Serper/Anymail Finder). A conta vem sempre da
 * sessão verificada, nunca do corpo — mesma regra do /api/busca.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada. Entre de novo.' }, { status: 401 });
  if (!perfil.conta_id) {
    return NextResponse.json({ erro: 'Escolha uma conta antes de enriquecer.' }, { status: 400 });
  }

  const { placeId } = await req.json().catch(() => ({}) as Record<string, unknown>);
  if (typeof placeId !== 'string' || !placeId) {
    return NextResponse.json({ erro: 'Lead inválido.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const [{ data: cred }, { data: lead }] = await Promise.all([
    admin.from('conta_credenciais')
      .select('perplexity_key, decisor_provedor, serper_key, tavily_key, linkedin_provedor, email_provedor, anymail_key, apollo_key, snov_client_id, snov_client_secret, ia_provedor, ia_key, ia_modelo')
      .eq('conta_id', perfil.conta_id).single(),
    admin.from('prospecta_leads')
      .select('id, empresa, endereco, site, place_id')
      .eq('place_id', placeId).eq('conta_id', perfil.conta_id).single(),
  ]);

  if (!lead) return NextResponse.json({ erro: 'Lead não encontrado nesta conta.' }, { status: 404 });
  if (!cred?.perplexity_key && !cred?.ia_key && !cred?.serper_key && !cred?.tavily_key
      && !cred?.anymail_key && !cred?.apollo_key && !cred?.snov_client_id) {
    return NextResponse.json(
      { erro: 'Cadastre pelo menos uma chave de enriquecimento em Configurações.' }, { status: 400 },
    );
  }

  const resultado = await enriquecerLead(cred, lead);

  const dados: Record<string, unknown> = {
    enriquecido_em: new Date().toISOString(),
    cnpj: resultado.cnpj,
    decisor_nome: resultado.decisorNome,
    linkedin: resultado.linkedin,
    email: resultado.email,
    email_status: resultado.emailStatus,
  };
  if (resultado.decisorNome) dados.status = 'enriquecido';

  const { error } = await admin.from('prospecta_leads').update(dados).eq('id', lead.id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    decisorNome: resultado.decisorNome,
    linkedin: resultado.linkedin,
    email: resultado.email,
    emailStatus: resultado.emailStatus,
    avisos: resultado.avisos,
  });
}
