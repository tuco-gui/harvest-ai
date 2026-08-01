import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Responde um chamado. Quem é da agência marca como respondida (e cumpre
 *  o SLA, se ainda não tinha resposta); quem é do cliente reabre. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const b = await req.json().catch(() => ({}) as any);
  const conteudo = String(b.conteudo ?? '').trim();
  if (!conteudo) return NextResponse.json({ erro: 'Escreva uma mensagem.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: conversa } = await admin.from('conversas').select('conta_id, respondido_em').eq('id', id).single();
  if (!conversa) return NextResponse.json({ erro: 'Chamado não encontrado.' }, { status: 404 });
  if (conversa.conta_id !== perfil.conta_id && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Esse chamado não é da sua conta.' }, { status: 403 });
  }

  const { error } = await admin.from('conversa_mensagens').insert({ conversa_id: id, autor_id: perfil.id, conteudo });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const ehAgencia = perfil.papel === 'super_admin';
  await admin.from('conversas').update({
    status: ehAgencia ? 'respondida' : 'aberta',
    ...(ehAgencia && !conversa.respondido_em ? { respondido_em: new Date().toISOString() } : {}),
  }).eq('id', id);

  return NextResponse.json({ ok: true });
}
