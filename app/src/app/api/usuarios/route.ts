import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { senhaProvisoria } from '@/lib/senha';
import { enviarEmail } from '@/lib/email';

const PAPEIS = ['super_admin', 'admin', 'operador'] as const;
type Papel = (typeof PAPEIS)[number];

async function nomeDaConta(admin: ReturnType<typeof supabaseAdmin>, conta: string | null) {
  if (!conta) return 'Figueira';
  const { data } = await admin.from('contas').select('nome').eq('id', conta).maybeSingle();
  return data?.nome ?? 'Harvest';
}

function textoConvite(email: string, senha: string) {
  return (
    `Seu acesso ao Harvest AI foi criado.\n\n` +
    `Link: https://harvest.figueiramarketing.com.br/entrar\n` +
    `E-mail: ${email}\n` +
    `Senha provisória: ${senha}\n\n` +
    `No primeiro login o sistema vai pedir para você trocar essa senha por uma só sua.`
  );
}

/**
 * Cria usuário. Duas permissões distintas:
 *  - super admin cria qualquer um, em qualquer conta, inclusive da agência
 *  - admin de conta cria só dentro da própria conta, e não cria super admin
 *
 * A senha nasce previsível ("NomeDaEmpresa1234") em vez de aleatória: sem
 * SMTP não dá para confiar que a pessoa vai ver a senha só uma vez na tela,
 * então ela precisa ser algo que dê para repassar de cabeça. senha_provisoria
 * fica true, e o layout barra qualquer navegação até ela trocar por uma senha
 * de verdade — é o que torna essa previsibilidade segura.
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

  const admin = supabaseAdmin();
  const senha = senhaProvisoria(await nomeDaConta(admin, conta));

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // sem confirmação por e-mail, o login já libera na hora
    user_metadata: { nome, papel, conta_id: conta ?? '' },
  });

  if (error) {
    const jaExiste = /already been registered|already exists/i.test(error.message);
    return NextResponse.json(
      { erro: jaExiste ? 'Já existe usuário com esse e-mail.' : error.message },
      { status: 400 },
    );
  }

  await admin.from('perfis').update({ senha_provisoria: true }).eq('id', data.user!.id);

  const emailEnviado = await enviarEmail(email, 'Seu acesso ao Harvest AI', textoConvite(email, senha));

  // A senha aparece aqui de qualquer forma — o e-mail é um extra, não uma garantia.
  return NextResponse.json({ id: data.user?.id, email, senha, emailEnviado });
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

  const senha = senhaProvisoria(await nomeDaConta(admin, alvo.conta_id));
  const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await admin.from('perfis').update({ senha_provisoria: true }).eq('id', id);

  const emailEnviado = await enviarEmail(alvo.email!, 'Sua senha no Harvest AI foi redefinida', textoConvite(alvo.email!, senha));

  return NextResponse.json({ email: alvo.email, senha, emailEnviado });
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
