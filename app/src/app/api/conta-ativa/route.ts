import { NextResponse } from 'next/server';
import { perfilAtual, COOKIE_CONTA } from '@/lib/supabase/server';

/** O super admin escolhe em qual conta trabalhar. Só ele. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (perfil?.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Só o super admin troca de conta.' }, { status: 403 });
  }

  const { conta_id } = await req.json().catch(() => ({}) as any);
  const res = NextResponse.json({ ok: true });

  if (conta_id) {
    res.cookies.set(COOKIE_CONTA, String(conta_id), {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
    });
  } else {
    res.cookies.delete(COOKIE_CONTA);
  }
  return res;
}
