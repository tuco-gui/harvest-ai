/** Rotas de autenticação acessíveis sem sessão.
 *  Apenas caminhos EXATOS: não liberar APIs de usuários/perfil nem prefixos.
 */
export function rotaPublicaSemSessao(path: string): boolean {
  return path === '/entrar'
    || path === '/esqueci-senha'
    || path === '/verificar-codigo'
    || path === '/api/auth/esqueci-senha';
}
