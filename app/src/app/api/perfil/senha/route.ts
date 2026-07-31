import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { senhaFraca } from '@/lib/senha';

/** Troca a própria senha. Sempre via servidor, para validar a força de
 *  verdade e derrubar a flag de senha provisória no mesmo passo. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const { senha } = await req.json().catch(() => ({}) as any);
  if (typeof senha !== 'string') {
    return NextResponse.json({ erro: 'Falta a senha nova.' }, { status: 400 });
  }
  const fraqueza = senhaFraca(senha);
  if (fraqueza) return NextResponse.json({ erro: fraqueza }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(perfil.id, { password: senha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await admin.from('perfis').update({ senha_provisoria: false }).eq('id', perfil.id);
  return NextResponse.json({ ok: true });
}
