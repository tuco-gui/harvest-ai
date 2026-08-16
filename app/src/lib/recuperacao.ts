import type { SupabaseClient } from '@supabase/supabase-js';

/** Formato de e-mail aceito em toda a área de autenticação. Mesma regra
 *  usada em api/usuarios/route.ts — mantida aqui também para o fluxo
 *  público não depender de outro arquivo para uma checagem tão simples. */
export function emailValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/**
 * Pede ao Supabase Auth um código de recuperação (6 dígitos, tipo OTP) para
 * o e-mail informado. Não cria usuário — só funciona se ele já existir,
 * porque tanto "esqueci minha senha" quanto "primeiro acesso" partem de um
 * usuário já criado (pelo admin, no segundo caso).
 *
 * Por que OTP por código, e não link com token na URL: o link teria que
 * lidar com fluxo PKCE/implícito do Supabase e parsing de hash na volta —
 * complexidade real para o mesmo resultado. O código resolve com uma
 * chamada de cliente só (`auth.verifyOtp`), sem depender de redirect.
 */
export async function gerarCodigoRecuperacao(
  admin: SupabaseClient,
  email: string,
): Promise<{ codigo: string } | { erro: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data?.properties?.email_otp) {
    return { erro: error?.message ?? 'Não consegui gerar o código.' };
  }
  return { codigo: data.properties.email_otp };
}

export function textoCodigoRecuperacao(codigo: string, primeiroAcesso: boolean): string {
  const contexto = primeiroAcesso
    ? 'Seu acesso ao Harvest AI foi criado. Use o código abaixo para definir sua senha e entrar pela primeira vez.'
    : 'Recebemos um pedido para redefinir sua senha no Harvest AI.';
  return (
    `${contexto}\n\n` +
    `Código: ${codigo}\n\n` +
    `Entre em https://harvest.figueiramarketing.com.br/verificar-codigo, informe seu ` +
    `e-mail e esse código, e defina a senha nova.\n\n` +
    `O código expira em pouco tempo. Se você não pediu isso, pode ignorar este e-mail —` +
    ` sua senha atual continua valendo.`
  );
}
