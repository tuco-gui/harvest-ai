/**
 * Testes unitários de sanitização (lib/logOperacional.ts) — Fase 3B.1.1.
 * Roda sem banco: node --experimental-strip-types tests/unit/logOperacional.test.ts
 */
import { sanitizarTexto } from '../../app/src/lib/logOperacional.ts';

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log('  ok  -', msg);
  else { falhas++; console.error('  FALHOU -', msg); }
}

// Não vaza secret cru
ok(!/sk-[A-Za-z0-9]{8,}/.test(sanitizarTexto('erro com sk-1234567890abc')), 'reduz sk-***');
ok(sanitizarTexto('api_key=supersecret12345').includes('***'), 'mascara api_key');
ok(sanitizarTexto('token=abcdefghijklmnop').includes('***'), 'mascara token');
ok(sanitizarTexto('AKIA1234567890ABCDEF').includes('***'), 'mascara AKIA');
// Texto limpo passa
ok(sanitizarTexto('Ponte de busca respondeu 500') === 'Ponte de busca respondeu 500', 'texto limpo preservado');
// Vazio/nulo
ok(sanitizarTexto('') === '', 'vazio');
ok(sanitizarTexto(null as unknown as string) === '', 'null');
// Trunca em 500
ok(sanitizarTexto('x'.repeat(900)).length <= 500, 'trunca em 500');

if (falhas) { console.error(`\n${falhas} teste(s) falharam.`); process.exit(1); }
console.log('\nTodos os testes de sanitização passaram.');
