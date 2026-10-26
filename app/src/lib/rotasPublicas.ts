/** Rotas de autenticação acessíveis sem sessão.
 *  Apenas caminhos EXATOS: não liberar APIs de usuários/perfil nem prefixos.
 */
export function rotaPublicaSemSessao(path: string): boolean {
  // Webchat possui autenticação própria: token público para o widget e
  // segredo aleatório por visitante para acesso ao histórico. Nunca libera
  // outras rotas do CRM ou prefixos genéricos.
  if(/^\/(?:webchat|api\/publico\/webchat)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))return true;
  // Endpoint público somente para verificação/entrega Meta; o POST exige HMAC.
  if(path==='/api/webhook/meta-mensagens')return true;
  if(/^\/api\/webhook\/zernio\/[0-9a-f-]{36}$/i.test(path))return true;
  if(path==='/api/zernio/callback')return true;
  return path === '/entrar'
    || path === '/esqueci-senha'
    || path === '/verificar-codigo'
    || path === '/api/auth/esqueci-senha';
}
