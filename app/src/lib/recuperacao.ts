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
/**
 * Base URL pública do app, por ambiente. Lê NEXT_PUBLIC_APP_URL (ou a
 * alternativa server-side APP_URL). Fail-closed: se nenhuma estiver
 * configurada, retorna null — NUNCA cai para produção silenciosamente.
 * Quem chama decide o que fazer (não enviar e-mail, ou erro claro ao admin).
 */
export function baseUrlApp(): string | null {
  const bruta = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '').trim();
  if (!bruta) return null;
  return bruta.replace(/\/+$/, ''); // tira barra final, se houver
}

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

/**
 * Texto do e-mail de recuperação/primeiro acesso. A URL é SEMPRE a do
 * ambiente (baseUrl), vinda de NEXT_PUBLIC_APP_URL. Sem baseUrl não montamos
 * link nenhum — falha fechado, em vez de apontar para produção por engano.
 */
export function textoCodigoRecuperacao(codigo: string, primeiroAcesso: boolean, baseUrl: string): string {
  if (!baseUrl) {
    throw new Error('baseUrlApp não configurada: não é possível montar o link de recuperação.');
  }
  const link = `${baseUrl}/verificar-codigo`;
  const contexto = primeiroAcesso
    ? 'Seu acesso ao Harvest AI foi criado. Use o código abaixo para definir sua senha e entrar pela primeira vez.'
    : 'Recebemos um pedido para redefinir sua senha no Harvest AI.';
  return (
    `${contexto}\n\n` +
    `Código: ${codigo}\n\n` +
    `Acesse ${link}, informe seu e-mail e esse código, e defina a senha nova.\n\n` +
    `O código expira em pouco tempo. Se você não pediu isso, pode ignorar este e-mail —` +
    ` sua senha atual continua valendo.`
  );
}
