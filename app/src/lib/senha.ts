/** Regra da senha definitiva: mínimo 8, maiúscula, minúscula, número e caractere especial.
 *  A senha provisória (nome da empresa + "1234") não passa por aqui — ela existe
 *  só para o primeiro login, que já obriga a trocar por uma que passe. */
export function senhaFraca(s: string): string | null {
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[a-z]/.test(s)) return 'A senha precisa de uma letra minúscula.';
  if (!/[A-Z]/.test(s)) return 'A senha precisa de uma letra maiúscula.';
  if (!/[0-9]/.test(s)) return 'A senha precisa de um número.';
  if (!/[^A-Za-z0-9]/.test(s)) return 'A senha precisa de um caractere especial (ex: ! @ # $).';
  return null;
}

/** Senha provisória previsível: primeira palavra do nome da empresa + "1234".
 *  O usuário troca no primeiro login. Só a primeira palavra para caber fácil
 *  num WhatsApp — "Guinffer Pratas" vira "Guinffer1234", não a empresa inteira. */
export function senhaProvisoria(nomeConta: string | null | undefined): string {
  const primeiraPalavra = (nomeConta ?? '').trim().split(/\s+/)[0] ?? '';
  const letras = primeiraPalavra.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '');
  const base = letras || 'Harvest';
  return `${base[0].toUpperCase()}${base.slice(1).toLowerCase()}1234`;
}
