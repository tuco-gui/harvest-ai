// app/scripts/check-waha.ts
// Self-check da parte pura de lib/waha.ts (sem rede). Rodar com:
//   node --experimental-strip-types app/scripts/check-waha.ts
import assert from 'node:assert';
import { wahaSessionName } from '../src/lib/waha.ts';

const nome = wahaSessionName('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
assert.strictEqual(nome, 'conta_a1b2c3d4e5f67890abcdef1234567890');
assert.ok(!nome.includes('-'), 'nome de sessão não pode ter hífen (WAHA rejeita)');
assert.ok(nome.startsWith('conta_'));

console.log('ok: lib/waha.ts');
