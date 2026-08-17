import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { crmBackend, ownerAtual } from '@/lib/twenty';
import { perfilTemModulo } from '@/lib/autorizacao';

/**
 * GET  /api/crm/oportunidades  → lista do tenant (isola por conta_id via RLS).
 * POST /api/crm/oportunidades  → qualifica um lead do Harvest em oportunidade.
 *      body: { lead_id, estagio?, owner_id?, valor?, proxima_acao?, observacoes? }
 *      Não duplica se já houver oportunidade para o mesmo lead_id.
 */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não acessa o CRM.' }, { status: 403 });
  }
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (!(await perfilTemModulo(supabaseAdmin(), perfil, 'crm'))) {
    return NextResponse.json({ erro: 'CRM não habilitado para esta conta.' }, { status: 403 });
  }

  const ops = await crmBackend().listar(perfil.conta_id);
  return NextResponse.json({ oportunidades: ops });
}

export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não qualifica leads.' }, { status: 403 });
  }
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (!(await perfilTemModulo(supabaseAdmin(), perfil, 'crm'))) {
    return NextResponse.json({ erro: 'CRM não habilitado para esta conta.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const leadId = Number(b.lead_id);
  if (!leadId) return NextResponse.json({ erro: 'Lead inválido.' }, { status: 400 });

  // Não duplicar: se já existe oportunidade para este lead, devolve a existente.
  if (await crmBackend().jaExistePorLead(perfil.conta_id, leadId)) {
    const { data } = await supabaseAdmin()
      .from('oportunidades')
      .select('*')
      .eq('conta_id', perfil.conta_id)
      .eq('lead_id', leadId)
      .maybeSingle();
    return NextResponse.json({ oportunidade: data, duplicada: true });
  }

  // Puxa dados do lead para pré-preencher a oportunidade.
  const { data: lead } = await supabaseAdmin()
    .from('prospecta_leads')
    .select('empresa, decisor_nome, telefone, email')
    .eq('conta_id', perfil.conta_id)
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ erro: 'Lead não encontrado nesta conta.' }, { status: 404 });
  }

  const owner = b.owner_id ?? (await ownerAtual());
  if (owner) {
    const { data: ownerDaConta } = await supabaseAdmin()
      .from('perfis')
      .select('id')
      .eq('conta_id', perfil.conta_id)
      .eq('id', owner)
      .maybeSingle();
    if (!ownerDaConta) {
      return NextResponse.json({ erro: 'Responsável não pertence a esta conta.' }, { status: 400 });
    }
  }
  const op = await crmBackend().criar(perfil.conta_id, {
    lead_id: leadId,
    empresa: lead?.empresa ?? '',
    contato: lead?.decisor_nome ?? '',
    telefone: lead?.telefone ?? null,
    email: lead?.email ?? null,
    origem: 'prospeccao',
    estagio: b.estagio,
    owner_id: owner,
    valor: Number(b.valor) || 0,
    proxima_acao: b.proxima_acao ?? null,
    observacoes: b.observacoes ?? null,
  });
  return NextResponse.json({ oportunidade: op, duplicada: false });
}
