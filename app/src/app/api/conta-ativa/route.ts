import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin, COOKIE_CONTA } from '@/lib/supabase/server';
import {COOKIE_DELEGACAO,auditarServico,carregarRecursos,encerrarDelegacao} from '@/lib/servicosWorkspace';

/**
 * Troca de workspace.
 * - Super admin: pode acessar qualquer conta ativa (sem depender de membership)
 * - Usuário comum: precisa de membership em conta_usuarios
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
    if(perfil.delegacao)await encerrarDelegacao(admin,perfil.delegacao.id,perfil.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(COOKIE_CONTA);
    res.cookies.delete(COOKIE_DELEGACAO);
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

  // Super admin: acesso global, SEMPRE permitido
  if (perfil.papel === 'super_admin') {
    const c=await carregarRecursos(admin,conta_id);
    if(c.migrada)await auditarServico(admin,conta_id,perfil.id,'workspace_selecionada',{contexto:'contrato_normal',anterior:perfil.conta_id});
    if(perfil.delegacao)await encerrarDelegacao(admin,perfil.delegacao.id,perfil.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(COOKIE_DELEGACAO);
    res.cookies.set(COOKIE_CONTA, String(conta_id), {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
    });
    return res;
  }

  // Usuário comum: validar membership
  const { data: membro } = await admin
    .from('conta_usuarios')
    .select('id')
    .eq('user_id', perfil.id)
    .eq('conta_id', conta_id)
    .eq('ativo', true)
    .maybeSingle();

  if (!membro) {
    return NextResponse.json({ erro: 'Você não tem acesso a esta conta.' }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_CONTA, String(conta_id), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
  });
  return res;
}
