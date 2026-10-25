/** Rotas públicas necessárias para autenticação e recuperação da própria conta.
 *  A API de troca de senha NÃO é pública: exige sessão Supabase válida.
 */
export function rotaPublicaSemSessao(pathname: string): boolean {
  return pathname === '/entrar'
    || pathname === '/esqueci-senha'
    || pathname === '/verificar-codigo'
    || pathname === '/api/auth/esqueci-senha';
}
