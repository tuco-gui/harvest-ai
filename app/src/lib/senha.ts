/** Regra da senha definitiva: mínimo 8, maiúscula, minúscula, número e caractere especial. */
export function senhaFraca(s: string): string | null {
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[a-z]/.test(s)) return 'A senha precisa de uma letra minúscula.';
  if (!/[A-Z]/.test(s)) return 'A senha precisa de uma letra maiúscula.';
  if (!/[0-9]/.test(s)) return 'A senha precisa de um número.';
  if (!/[^A-Za-z0-9]/.test(s)) return 'A senha precisa de um caractere especial (ex: ! @ # $).';
  return null;
}

/**
 * Senha bootstrap INTERNA, usada só para criar o usuário no Supabase Auth
 * antes do OTP. Ela é um detalhe de implementação e NUNCA deve voltar para o
 * navegador, aparecer na UI, ser logada ou mostrada a qualquer admin — quem
 * define a senha real é o próprio usuário em /verificar-codigo. Por construção
 * passa em senhaFraca (maiúscula, minúscula, número e especial).
 */
export function senhaAleatoria(): string {
  const ab = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I/O para não confundir
  const ab2 = 'abcdefghijkmnpqrstuvwxyz';
  const dig = '23456789'; // sem 0/1
  const esp = '!@#$%&*?';
  const sortear = (s: string) => s[Math.floor(Math.random() * s.length)];
  // 3 de cada caixa + 1 especial => 13 chars, acima do mínimo do senhaFraca.
  return (
    sortear(ab) + sortear(ab) + sortear(ab) +
    sortear(ab2) + sortear(ab2) + sortear(ab2) +
    sortear(dig) + sortear(dig) + sortear(dig) +
    sortear(esp) + sortear(ab2) + sortear(dig) + sortear(ab)
  );
}
