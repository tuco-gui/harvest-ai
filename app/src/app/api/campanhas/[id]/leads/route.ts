import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { vincularLeadACampanha, desvincularLeadDaCampanha } from '@/lib/campanhaLeads';

/**
 * Gestão de leads DENTRO de uma campanha (Entrega 22 — página de edição
 * dedicada). Nunca cria/edita dados do lead em si — isso é
 * /api/leads/[id]. Aqui só existe (des)vínculo campanha↔lead.
 */
async function carregarCampanha(admin: ReturnType<typeof supabaseAdmin>, id: number) {
  const { data } = await admin.from('prospecta_campanhas').select('id, conta_id').eq('id', id).maybeSingle();
  return data;
}

/** GET ?q=busca — leads da conta que ainda NÃO estão nesta campanha, pra
 *  escolher o que adicionar. Sem q, não retorna nada (evita listar a base
 *  inteira da conta por engano). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campanhaId = Number(id);
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ leads: [] });

  const admin = supabaseAdmin();
  const campanha = await carregarCampanha(admin, campanhaId);
  if (!campanha || (perfil.papel !== 'super_admin' && campanha.conta_id !== perfil.conta_id)) {
    return NextResponse.json({ erro: 'Campanha não encontrada.' }, { status: 404 });
  }

  const [{ data: jaNaCampanha }, { data: candidatos }] = await Promise.all([
    admin.from('campanha_leads').select('lead_id').eq('campanha_id', campanhaId),
    admin.from('prospecta_leads').select('id, empresa, telefone_original, endereco')
      .eq('conta_id', campanha.conta_id)
      .or(`empresa.ilike.%${q}%,telefone_original.ilike.%${q}%`)
      .limit(20),
  ]);

  const idsNaCampanha = new Set((jaNaCampanha ?? []).map((v) => v.lead_id));
  const leads = (candidatos ?? []).filter((l) => !idsNaCampanha.has(l.id));
  return NextResponse.json({ leads });
}

/** POST { leadId } — adiciona um lead já existente na conta a esta campanha. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campanhaId = Number(id);
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const { leadId } = await req.json().catch(() => ({}) as any);
  if (!Number.isInteger(leadId)) return NextResponse.json({ erro: 'Falta o lead.' }, { status: 400 });

  const admin = supabaseAdmin();
  const campanha = await carregarCampanha(admin, campanhaId);
  if (!campanha || (perfil.papel !== 'super_admin' && campanha.conta_id !== perfil.conta_id)) {
    return NextResponse.json({ erro: 'Campanha não encontrada.' }, { status: 404 });
  }

  const { data: lead } = await admin.from('prospecta_leads').select('id').eq('id', leadId).eq('conta_id', campanha.conta_id).maybeSingle();
  if (!lead) return NextResponse.json({ erro: 'Lead não encontrado nesta conta.' }, { status: 404 });

  await vincularLeadACampanha(admin, campanha.conta_id, campanhaId, leadId, 'manual');
  return NextResponse.json({ ok: true });
}

/** DELETE { leadId } — remove o lead desta campanha (nunca apaga o lead
 *  nem seu histórico — só o vínculo com esta campanha específica). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campanhaId = Number(id);
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const { leadId } = await req.json().catch(() => ({}) as any);
  if (!Number.isInteger(leadId)) return NextResponse.json({ erro: 'Falta o lead.' }, { status: 400 });

  const admin = supabaseAdmin();
  const campanha = await carregarCampanha(admin, campanhaId);
  if (!campanha || (perfil.papel !== 'super_admin' && campanha.conta_id !== perfil.conta_id)) {
    return NextResponse.json({ erro: 'Campanha não encontrada.' }, { status: 404 });
  }

  await desvincularLeadDaCampanha(admin, campanha.conta_id, campanhaId, leadId);
  return NextResponse.json({ ok: true });
}
