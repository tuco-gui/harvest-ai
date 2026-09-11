import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { normalizarTelefone } from '@/lib/telefone';

export async function GET(_req: Request, { params }: { params: Promise<{ telefone: string }> }) {
  const { telefone: rawTel } = await params;
  const telefone = normalizarTelefone(decodeURIComponent(rawTel));
  if (!telefone) return NextResponse.json({ erro: 'Telefone inválido.' }, { status: 400 });

  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });
  const admin = supabaseAdmin();

  // Inbound messages
  const { data: entradas } = await admin
    .from('inbound_eventos')
    .select('id, mensagem, tipo_mensagem, tipo_evento, recebido_em, nome_contato, lead_id')
    .eq('conta_id', perfil.conta_id)
    .eq('telefone', telefone)
    .order('recebido_em');

  // Find lead for this phone
  const leadId = entradas?.find((e) => e.lead_id)?.lead_id ?? null;

  // Outbound messages (if lead exists)
  let saidas: any[] = [];
  if (leadId) {
    const { data } = await admin
      .from('prospecta_mensagens')
      .select('id, conteudo, status, enviado_em, criado_em')
      .eq('conta_id', perfil.conta_id)
      .eq('lead_id', leadId)
      .order('criado_em');
    saidas = data ?? [];
  }

  // Merge into timeline
  const timeline = [
    ...(entradas ?? []).map((m) => ({
      id: `e-${m.id}`, direcao: 'entrada' as const, texto: m.mensagem ?? `[${m.tipo_mensagem}]`,
      status: m.tipo_evento, data: m.recebido_em, nome: m.nome_contato ?? null,
    })),
    ...saidas.map((m) => ({
      id: `s-${m.id}`, direcao: 'saida' as const, texto: m.conteudo ?? '',
      status: m.status, data: m.enviado_em ?? m.criado_em, nome: null,
    })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  // Check if opportunity exists for this phone
  const { data: oportunidade } = await admin
    .from('oportunidades')
    .select('id, estagio')
    .eq('conta_id', perfil.conta_id)
    .eq('telefone', telefone)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    telefone,
    nome: entradas?.find((e) => e.nome_contato)?.nome_contato ?? null,
    leadId,
    oportunidade,
    total: timeline.length,
    timeline,
  });
}
