import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin, COOKIE_CONTA } from '@/lib/supabase/server';

/**
 * Troca de workspace. Qualquer usuário com mais de 1 membership pode trocar.
 * Super admin pode acessar qualquer conta ativa.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) {
    return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  }

  const { conta_id } = await req.json().catch(() => ({}) as any);
  const admin = supabaseAdmin();

  // "Sair da conta" — limpa cookie
  if (!conta_id) {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(COOKIE_CONTA);
    return res;
  }

  // Validar que a conta existe e está ativa
  const { data: conta } = await admin
    .from('contas')
    .select('id')
    .eq('id', conta_id)
    .eq('ativo', true)
    .maybeSingle();

  if (!conta) {
    return NextResponse.json({ erro: 'Conta não encontrada ou inativa.' }, { status: 404 });
  }

  // Validar que o usuário tem membership nesta conta
  const { data: membro } = await admin
    .from('conta_usuarios')
    .select('id')
    .eq('user_id', perfil.id)
    .eq('conta_id', conta_id)
    .eq('ativo', true)
    .maybeSingle();

  if (!membro && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Você não tem acesso a esta conta.' }, { status: 403 });
  }

  // Super admin sem membership: criar membership temporária para acessar
  if (!membro && perfil.papel === 'super_admin') {
    await admin.from('conta_usuarios').insert({
      user_id: perfil.id,
      conta_id,
      papel: 'admin',
      ativo: true,
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_CONTA, String(conta_id), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
  });
  return res;
}
