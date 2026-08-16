import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { senhaAleatoria } from '@/lib/senha';
import { enviarEmail, configuracaoSmtp } from '@/lib/email';
import { gerarCodigoRecuperacao, textoCodigoRecuperacao, baseUrlApp } from '@/lib/recuperacao';

const PAPEIS = ['super_admin', 'admin', 'operador'] as const;
type Papel = (typeof PAPEIS)[number];

const ERRO_SMTP =
  'O envio de e-mail não está configurado. Configure o SMTP antes de criar novos usuários.';

/**
 * Cria usuário (primeiro acesso, fluxo B). Só existe um caminho:
 *  - COM SMTP: nasce com senha aleatória INTERNA (só para "vestir" o Auth,
 *    nunca exposta) + senha_provisoria=true; mandamos um código OTP de 6
 *    dígitos por e-mail. A pessoa valida o código e define a senha dela.
 *  - SEM SMTP: nem criamos — retornamos erro claro. Não há mais senha
 *    provisória previsível (nome/empresa + 1234) nem qualquer segredo na
 *    resposta. Sem e-mail não há como entregar o código, então o fluxo não
 *    existe incompleto.
 *
 * A permissão continua a mesma: super admin cria qualquer um; admin de conta
 * cria só na própria conta e não cria outro super admin.
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

  // Sem SMTP não dá para entregar o OTP — nem criamos o usuário.
  const temSmtp = !!(await configuracaoSmtp());
  if (!temSmtp) return NextResponse.json({ erro: ERRO_SMTP }, { status: 400 });

  const admin = supabaseAdmin();

  // Base URL do ambiente (para o link do e-mail). Sem ela não enviamos e-mail
  // apontando para lugar errado — erro claro ao admin, em vez de fallback.
  const baseUrl = baseUrlApp();
  if (!baseUrl) {
    return NextResponse.json(
      { erro: 'URL do app não configurada (NEXT_PUBLIC_APP_URL). Defina antes de criar usuários.' },
      { status: 500 },
    );
  }

  // senhaAleatoria() é detalhe de bootstrap: o Auth exige uma senha no
  // createUser, mas ela NUNCA volta no corpo da resposta nem aparece na UI.
  const senha = senhaAleatoria();

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

  // OTP para o próprio usuário definir a senha — o admin nunca vê a senha.
  const otp = await gerarCodigoRecuperacao(admin, email);
  if (!('codigo' in otp)) {
    return NextResponse.json({ erro: 'Não consegui gerar o código de acesso.' }, { status: 500 });
  }
  const enviou = await enviarEmail(email, 'Seu acesso ao Harvest AI', textoCodigoRecuperacao(otp.codigo, true, baseUrl));
  if (!enviou) {
    return NextResponse.json({ erro: 'Falha ao enviar o e-mail de primeiro acesso. Verifique o SMTP.' }, { status: 502 });
  }
  return NextResponse.json({ id: data.user?.id, email, modo: 'otp', emailEnviado: true });
}

/**
 * Redefinição de senha pedida pelo admin (não o self-service "esqueci").
 * Mesmo padrão do primeiro acesso: o admin SÓ dispara o OTP para o usuário;
 * quem define a nova senha é o próprio usuário em /verificar-codigo. O admin
 * não recebe (e não pode receber) a senha final. Sem SMTP, erro de configuração.
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

  const temSmtp = !!(await configuracaoSmtp());
  if (!temSmtp) {
    return NextResponse.json(
      { erro: 'O envio de e-mail não está configurado. Configure o SMTP antes de redefinir senhas.' },
      { status: 400 },
    );
  }

  const baseUrl = baseUrlApp();
  if (!baseUrl) {
    return NextResponse.json(
      { erro: 'URL do app não configurada (NEXT_PUBLIC_APP_URL). Defina antes de redefinir senhas.' },
      { status: 500 },
    );
  }

  // OTP vai para o USUÁRIO, não para o admin. Ele define a nova senha.
  const otp = await gerarCodigoRecuperacao(admin, alvo.email!);
  if (!('codigo' in otp)) {
    return NextResponse.json({ erro: 'Não consegui enviar o código de recuperação.' }, { status: 500 });
  }
  const enviou = await enviarEmail(
    alvo.email!,
    'Sua senha no Harvest AI foi redefinida',
    textoCodigoRecuperacao(otp.codigo, false, baseUrl),
  );
  if (!enviou) {
    return NextResponse.json({ erro: 'Falha ao enviar o e-mail de redefinição. Verifique o SMTP.' }, { status: 502 });
  }
  return NextResponse.json({ email: alvo.email, modo: 'otp', emailEnviado: true });
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
