import assert from 'node:assert/strict';
import { rotaPublicaSemSessao } from '../../app/src/lib/rotasPublicas.ts';

for (const pathname of [
  '/entrar',
  '/esqueci-senha',
  '/verificar-codigo',
  '/api/auth/esqueci-senha',
]) assert.equal(rotaPublicaSemSessao(pathname), true, pathname);

for (const pathname of [
  '/',
  '/api/perfil/senha',
  '/api/auth/redefinir',
  '/api/usuarios',
  '/api/auth/esqueci-senha/algum-segredo',
  '/esqueci-senha/falso',
  '/inbox',
]) assert.equal(rotaPublicaSemSessao(pathname), false, pathname);

console.log('11 verificações de rotas públicas aprovadas');
