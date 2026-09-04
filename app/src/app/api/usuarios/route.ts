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

function textoConviteWorkspace(email: string, nomeConta: string) {
  return (
    `Você foi adicionado(a) à workspace "${nomeConta}" no Harvest AI.\n\n` +
    `Link: https://harvest.figueiramarketing.com.br/entrar\n` +
    `E-mail: ${email}\n\n` +
    `Use sua senha existente para entrar.`
  );
}

/**
 * Cria usuário ou adiciona a workspace.
 *
 * Se o e-mail JÁ existe no Supabase Auth:
 *   - NÃO cria outro Auth user
 *   - Adiciona membership (conta_usuarios) na workspace atual
 *   - Se já pertence à workspace, informa
 *
 * Se o e-mail NÃO existe:
 *   - Cria Auth user + perfis + membership
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

  // Quem não é super admin só cria na própria conta
  const conta = papel === 'super_admin' ? null : (ehSuper ? (b.conta_id ?? perfil.conta_id) : perfil.conta_propria);
  if (papel !== 'super_admin' && !conta) {
    return NextResponse.json({ erro: 'Escolha a conta do usuário.' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Verificar se o e-mail já existe no Supabase Auth
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email);

  if (existingUser) {
    // --- USUÁRIO JÁ EXISTE: adicionar membership ---
    if (!conta) {
      return NextResponse.json({ erro: 'Especifique a conta para adicionar o usuário.' }, { status: 400 });
    }

    // Verificar se já pertence a esta workspace
    const { data: jaExiste } = await admin
      .from('conta_usuarios')
      .select('id')
      .eq('user_id', existingUser.id)
      .eq('conta_id', conta)
      .eq('ativo', true)
      .maybeSingle();

    if (jaExiste) {
      return NextResponse.json({
        erro: `Este usuário já pertence à workspace.`,
        status: 'ja_membro',
        user_id: existingUser.id,
      }, { status: 200 });
    }

    // Adicionar membership
    const { error: memError } = await admin.from('conta_usuarios').insert({
      user_id: existingUser.id,
      conta_id: conta,
      papel,
      ativo: true,
    });

    if (memError) {
      return NextResponse.json({ erro: memError.message }, { status: 500 });
    }

    const nomeConta = await nomeDaConta(admin, conta);
    const emailEnviado = await enviarEmail(email, `Adicionado à workspace ${nomeConta}`, textoConviteWorkspace(email, nomeConta));

    return NextResponse.json({
      id: existingUser.id,
      email,
      status: 'adicionado',
      emailEnviado,
    });
  }

  // --- USUÁRIO NOVO: criar Auth + perfis + membership ---
  const senha = senhaProvisoria(await nomeDaConta(admin, conta));

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }

  // Criar membership
  if (conta) {
    await admin.from('conta_usuarios').insert({
      user_id: data.user!.id,
      conta_id: conta,
      papel,
      ativo: true,
    });
  }

  await admin.from('perfis').update({ senha_provisoria: true }).eq('id', data.user!.id);

  const emailEnviado = await enviarEmail(email, 'Seu acesso ao Harvest AI', textoConvite(email, senha));

  return NextResponse.json({ id: data.user?.id, email, senha, emailEnviado });
}

/**
 * Gera uma senha nova para um usuário já existente.
 */
export async function PATCH(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil || perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}) as any);
  if (!id) return NextResponse.json({ erro: 'Falta o usuário.' }, { status: 400 });

  const admin = supabaseAdmin();

  // Verificar que o alvo tem membership na conta atual do caller
  if (perfil.papel !== 'super_admin') {
    const { data: membro } = await admin
      .from('conta_usuarios')
      .select('id')
      .eq('user_id', id)
      .eq('conta_id', perfil.conta_id!)
      .eq('ativo', true)
      .maybeSingle();

    if (!membro) {
      return NextResponse.json({ erro: 'Esse usuário não é da sua conta.' }, { status: 403 });
    }
  }

  const { data: alvo } = await admin.from('perfis').select('email').eq('id', id).single();
  if (!alvo) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });

  const senha = senhaProvisoria('Harvest');
  const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await admin.from('perfis').update({ senha_provisoria: true }).eq('id', id);

  const emailEnviado = await enviarEmail(alvo.email!, 'Sua senha no Harvest AI foi redefinida', textoConvite(alvo.email!, senha));

  return NextResponse.json({ email: alvo.email, senha, emailEnviado });
}

/**
 * Remove membro da workspace.
 * NÃO deleta o Auth user — apenas remove a membership.
 * Se o usuário não tem mais nenhuma membership, pode ser removido do Auth.
 */
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

  // Admin de conta só remove gente da própria workspace
  if (perfil.papel !== 'super_admin') {
    const { data: membro } = await admin
      .from('conta_usuarios')
      .select('id')
      .eq('user_id', id)
      .eq('conta_id', perfil.conta_id!)
      .eq('ativo', true)
      .maybeSingle();

    if (!membro) {
      return NextResponse.json({ erro: 'Esse usuário não é da sua conta.' }, { status: 403 });
    }
  }

  // Remover SOMENTE a membership desta workspace
  const targetConta = perfil.papel === 'super_admin' ? (await req.json().catch(() => ({})) as any).conta_id : perfil.conta_id;

  if (!targetConta) {
    return NextResponse.json({ erro: 'Especifique a conta.' }, { status: 400 });
  }

  const { error } = await admin
    .from('conta_usuarios')
    .delete()
    .eq('user_id', id)
    .eq('conta_id', targetConta);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Verificar se o usuário ainda tem outras memberships
  const { count } = await admin
    .from('conta_usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)
    .eq('ativo', true);

  // Se não tem mais nenhuma membership, remover do Auth
  if (count === 0) {
    await admin.auth.admin.deleteUser(id);
  }

  return NextResponse.json({ ok: true });
}
