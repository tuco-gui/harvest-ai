import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/**
 * Atualiza um canal (nome, número, ativo, padrão, status). Só admin da conta.
 * Não aceita troca de provider aqui — trocar provider é recriar o canal (a
 * sessão/instância é do provider antigo).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canalId = Number(id);
  if (!Number.isInteger(canalId)) return NextResponse.json({ erro: 'Canal inválido.' }, { status: 400 });

  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não altera canais de WhatsApp.' }, { status: 403 });
  }
  if (!perfil.conta_id) {
    return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}) as Record<string, unknown>);
  const admin = supabaseAdmin();

  // O canal precisa ser da conta ativa — bloqueia cross-tenant por segurança.
  const { data: dono } = await admin
    .from('whatsapp_canais')
    .select('conta_id')
    .eq('id', canalId)
    .maybeSingle();
  if (!dono || dono.conta_id !== perfil.conta_id) {
    return NextResponse.json({ erro: 'Canal não encontrado nesta conta.' }, { status: 404 });
  }

  const dados: Record<string, unknown> = {};
  if (typeof b.nome === 'string' && b.nome.trim()) dados.nome = b.nome.trim();
  if (typeof b.numero === 'string') dados.numero = b.numero.trim() || null;
  if (typeof b.ativo === 'boolean') dados.ativo = b.ativo;
  if (typeof b.status === 'string' && ['conectado', 'desconectado', 'desconhecido'].includes(b.status)) {
    dados.status = b.status;
  }

  // Marcar como padrão: desmarca os outros da conta primeiro.
  if (b.padrao === true) {
    await admin.from('whatsapp_canais').update({ padrao: false }).eq('conta_id', perfil.conta_id);
    dados.padrao = true;
  } else if (b.padrao === false) {
    dados.padrao = false;
  }

  if (!Object.keys(dados).length) return NextResponse.json({ ok: true });

  const { data, error } = await admin
    .from('whatsapp_canais')
    .update({ ...dados, atualizado_em: new Date().toISOString() })
    .eq('id', canalId)
    .eq('conta_id', perfil.conta_id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ canal: data });
}

/** Exclui um canal da conta ativa. Só admin da conta. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canalId = Number(id);
  if (!Number.isInteger(canalId)) return NextResponse.json({ erro: 'Canal inválido.' }, { status: 400 });

  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não exclui canais de WhatsApp.' }, { status: 403 });
  }
  if (!perfil.conta_id) {
    return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('whatsapp_canais')
    .delete()
    .eq('id', canalId)
    .eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
