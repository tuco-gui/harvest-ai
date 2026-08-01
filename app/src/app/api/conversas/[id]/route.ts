import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Uma conversa com o histórico de mensagens — pra abrir o chamado e ver a thread. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: conversa } = await admin
    .from('conversas')
    .select('id, conta_id, assunto, categoria, status, criado_em, prazo_sla, respondido_em, contas(nome)')
    .eq('id', id).single();

  if (!conversa) return NextResponse.json({ erro: 'Chamado não encontrado.' }, { status: 404 });
  if (conversa.conta_id !== perfil.conta_id && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Esse chamado não é da sua conta.' }, { status: 403 });
  }

  const { data: mensagens } = await admin
    .from('conversa_mensagens')
    .select('id, conteudo, criado_em, perfis(nome, email, papel)')
    .eq('conversa_id', id).order('criado_em');

  return NextResponse.json({ conversa, mensagens: mensagens ?? [] });
}

/** Fechar ou reabrir. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const b = await req.json().catch(() => ({}) as any);
  if (!['aberta', 'respondida', 'fechada'].includes(b.status)) {
    return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: conversa } = await admin.from('conversas').select('conta_id').eq('id', id).single();
  if (!conversa) return NextResponse.json({ erro: 'Chamado não encontrado.' }, { status: 404 });
  if (conversa.conta_id !== perfil.conta_id && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Esse chamado não é da sua conta.' }, { status: 403 });
  }

  const { error } = await admin.from('conversas').update({ status: b.status }).eq('id', id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
