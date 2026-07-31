import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

const PAPEIS = ['super_admin', 'admin', 'operador'] as const;
type Papel = (typeof PAPEIS)[number];

/** Senha inicial legível: o admin copia e passa ao usuário. */
function senhaInicial() {
  const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

/**
 * Cria usuário. Duas permissões distintas:
 *  - super admin cria qualquer um, em qualquer conta, inclusive da agência
 *  - admin de conta cria só dentro da própria conta, e não cria super admin
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não cria usuários.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const email = String(b.email ?? '').trim().toLowerCase();
  const nome = String(b.nome ?? '').trim();
  const papel = (PAPEIS.includes(b.papel) ? b.papel : 'operador') as Papel;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }

  const ehSuper = perfil.papel === 'super_admin';
  if (papel === 'super_admin' && !ehSuper) {
    return NextResponse.json({ erro: 'Só o super admin cria outro super admin.' }, { status: 403 });
  }

  // Quem não é super admin só cria na própria conta — nunca aceita conta_id do corpo.
  const conta = papel === 'super_admin' ? null : (ehSuper ? (b.conta_id ?? perfil.conta_id) : perfil.conta_propria);
  if (papel !== 'super_admin' && !conta) {
    return NextResponse.json({ erro: 'Escolha a conta do usuário.' }, { status: 400 });
  }

  const senha = senhaInicial();
  const admin = supabaseAdmin();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // sem SMTP, o convite por e-mail não sairia
    user_metadata: { nome, papel, conta_id: conta ?? '' },
  });

  if (error) {
    const jaExiste = /already been registered|already exists/i.test(error.message);
    return NextResponse.json(
      { erro: jaExiste ? 'Já existe usuário com esse e-mail.' : error.message },
      { status: 400 },
    );
  }

  // A senha só aparece aqui, uma vez. Não fica guardada em lugar nenhum.
  return NextResponse.json({ id: data.user?.id, email, senha });
}

/**
 * Gera uma senha nova para um usuário já existente. Cobre dois casos: ele
 * nunca recebeu a senha inicial (sem SMTP não há e-mail de convite) ou
 * esqueceu — sem SMTP também não há "esqueci minha senha" self-service.
 * Mesma regra de alcance do DELETE: admin só na própria conta.
 */
export async function PATCH(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil || perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}) as any);
  if (!id) return NextResponse.json({ erro: 'Falta o usuário.' }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: alvo } = await admin.from('perfis').select('email, conta_id').eq('id', id).single();
  if (!alvo) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
  if (perfil.papel !== 'super_admin' && alvo.conta_id !== perfil.conta_propria) {
    return NextResponse.json({ erro: 'Esse usuário não é da sua conta.' }, { status: 403 });
  }

  const senha = senhaInicial();
  const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ email: alvo.email, senha });
}

/** Remove usuário. O perfil cai junto por cascade. */
export async function DELETE(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil || perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}) as any);
  if (!id) return NextResponse.json({ erro: 'Falta o usuário.' }, { status: 400 });
  if (id === perfil.id) {
    return NextResponse.json({ erro: 'Você não pode remover a si mesmo.' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // admin de conta só remove gente da própria conta
  if (perfil.papel !== 'super_admin') {
    const { data: alvo } = await admin.from('perfis').select('conta_id').eq('id', id).single();
    if (!alvo || alvo.conta_id !== perfil.conta_propria) {
      return NextResponse.json({ erro: 'Esse usuário não é da sua conta.' }, { status: 403 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
