import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { crmBackend, ownerAtual } from '@/lib/twenty';
import { perfilTemModulo } from '@/lib/autorizacao';

/**
 * GET  /api/crm/oportunidades  → lista do tenant (isola por conta_id via RLS).
 * POST /api/crm/oportunidades → qualifica um lead OU cria oportunidade manual.
 * Não duplica quando houver lead_id; criação manual exige empresa ou contato.
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

  const backend = await crmBackend(perfil.conta_id);
  const ops = await backend.listar(perfil.conta_id);
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
  const leadId = b.lead_id ? Number(b.lead_id) : null;
  if (b.lead_id && !leadId) return NextResponse.json({ erro: 'Lead inválido.' }, { status: 400 });

  const backend = await crmBackend(perfil.conta_id);

  // Não duplicar: se já existe oportunidade para este lead, devolve a existente.
  if (leadId && await backend.jaExistePorLead(perfil.conta_id, leadId)) {
    const { data } = await supabaseAdmin()
      .from('oportunidades')
      .select('*')
      .eq('conta_id', perfil.conta_id)
      .eq('lead_id', leadId)
      .maybeSingle();
    return NextResponse.json({ oportunidade: data, duplicada: true });
  }

  // Puxa dados do lead para pré-preencher a oportunidade.
  const admin = supabaseAdmin();
  const { data: lead } = leadId
    ? await admin.from('prospecta_leads')
        .select('empresa, decisor_nome, telefone, email, campanha_id')
        .eq('conta_id', perfil.conta_id).eq('id', leadId).maybeSingle()
    : { data: null };
  if (leadId && !lead) return NextResponse.json({ erro: 'Lead não encontrado nesta conta.' }, { status: 404 });

  const empresa = String(b.empresa ?? lead?.empresa ?? '').trim();
  const contato = String(b.contato ?? lead?.decisor_nome ?? '').trim();
  if (!empresa && !contato) {
    return NextResponse.json({ erro: 'Informe pelo menos a empresa ou o contato.' }, { status: 400 });
  }

  const campanhaId = b.campanha_id ? Number(b.campanha_id) : (lead?.campanha_id ?? null);
  if (campanhaId) {
    const { data: campanha } = await admin.from('prospecta_campanhas').select('id')
      .eq('id', campanhaId).eq('conta_id', perfil.conta_id).maybeSingle();
    if (!campanha) return NextResponse.json({ erro: 'Campanha não pertence a esta conta.' }, { status: 400 });
  }

  const owner = Object.prototype.hasOwnProperty.call(b, 'owner_id')
    ? (b.owner_id || null)
    : await ownerAtual();
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
  const tags = Array.isArray(b.tags)
    ? b.tags.map((v: unknown) => String(v).trim()).filter(Boolean).slice(0, 20)
    : [];
  const probabilidadeInformada = Number(b.probabilidade);
  const probabilidade = Number.isFinite(probabilidadeInformada)
    ? Math.min(100, Math.max(0, probabilidadeInformada))
    : 5;
  const op = await backend.criar(perfil.conta_id, {
    lead_id: leadId,
    empresa,
    contato,
    telefone: b.telefone ? String(b.telefone).trim() : (lead?.telefone ?? null),
    email: b.email ? String(b.email).trim() : (lead?.email ?? null),
    origem: String(b.origem ?? (leadId ? 'prospeccao' : 'manual')).trim(),
    campanha_id: campanhaId,
    estagio: b.estagio,
    owner_id: owner,
    valor: Number(b.valor) || 0,
    probabilidade,
    tags,
    proxima_acao: b.proxima_acao ?? null,
    observacoes: b.observacoes ?? null,
    previsao_fechamento: b.previsao_fechamento ?? null,
  });
  return NextResponse.json({ oportunidade: op, duplicada: false });
}
