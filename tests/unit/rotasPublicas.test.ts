import assert from 'node:assert/strict';
import { rotaPublicaSemSessao } from '../../app/src/lib/rotasPublicas.ts';

const publicas = ['/entrar', '/esqueci-senha', '/verificar-codigo', '/api/auth/esqueci-senha'];
const privadas = ['/', '/inbox', '/api/perfil/senha', '/api/usuarios',
  '/api/auth/esqueci-senha/outro', '/api/auth/alterar-senha', '/entrar/outro'];
for (const rota of publicas) assert.equal(rotaPublicaSemSessao(rota), true, rota);
for (const rota of privadas) assert.equal(rotaPublicaSemSessao(rota), false, rota);
console.log('11 asserts: allowlist pública preserva rotas privadas');
