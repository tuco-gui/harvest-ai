import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { testarSmtp } from '@/lib/email';

/** Configuração de e-mail do sistema inteiro (um GoTrue serve todas as
 *  contas, então só existe um SMTP). Só o super admin mexe aqui. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (perfil?.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Só o super admin configura o SMTP.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const admin = supabaseAdmin();

  // senha em branco = não mexer, mesma convenção das outras chaves da conta
  const dados: Record<string, unknown> = { id: 1, atualizado_em: new Date().toISOString() };
  if (typeof b.smtp_host === 'string') dados.smtp_host = b.smtp_host.trim() || null;
  if (typeof b.smtp_porta !== 'undefined') dados.smtp_porta = Number(b.smtp_porta) || null;
  if (typeof b.smtp_usuario === 'string') dados.smtp_usuario = b.smtp_usuario.trim() || null;
  if (typeof b.smtp_remetente === 'string') dados.smtp_remetente = b.smtp_remetente.trim() || null;
  if (typeof b.smtp_senha === 'string' && b.smtp_senha) dados.smtp_senha = b.smtp_senha;

  const { error } = await admin.from('config_sistema').upsert(dados, { onConflict: 'id' });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Manda um e-mail de teste para o próprio super admin, usando o que já
 *  está salvo — não usa o que está no formulário e não foi salvo ainda. */
export async function PUT() {
  const perfil = await perfilAtual();
  if (perfil?.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Só o super admin testa o SMTP.' }, { status: 403 });
  }
  if (!perfil.email) return NextResponse.json({ erro: 'Seu usuário não tem e-mail cadastrado.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: cfg } = await admin.from('config_sistema').select('*').eq('id', 1).maybeSingle();
  if (!cfg?.smtp_host || !cfg.smtp_usuario || !cfg.smtp_senha) {
    return NextResponse.json({ erro: 'Salve host, usuário e senha antes de testar.' }, { status: 400 });
  }

  const erro = await testarSmtp(cfg as any, perfil.email);
  if (erro) return NextResponse.json({ erro }, { status: 502 });
  return NextResponse.json({ ok: true, recado: `E-mail de teste enviado para ${perfil.email}.` });
}
