// Verificação de app/src/lib/telefone.ts (normalizarTelefone).
// Reimplementada aqui em JS puro, no mesmo padrão de envio.test.js — este
// repo não tem ts-node/jest configurado, então os testes não importam o
// .ts direto; mantemos as duas em sincronia manualmente.
// Roda com: node tests/telefone.test.js
const assert = require('assert');

function normalizarTelefone(bruto) {
  if (!bruto) return null;
  let d = String(bruto).replace(/\D/g, '');
  if (d.length < 10) return null;
  if (!d.startsWith('55')) d = '55' + d;
  return d;
}

assert.strictEqual(normalizarTelefone(null), null, 'null vira null');
assert.strictEqual(normalizarTelefone(undefined), null, 'undefined vira null');
assert.strictEqual(normalizarTelefone(''), null, 'string vazia vira null');
assert.strictEqual(normalizarTelefone('123'), null, 'menos de 10 dígitos vira null (mesmo já tendo 55 embutido não faria diferença aqui)');

assert.strictEqual(normalizarTelefone('11999998888'), '5511999998888', 'sem 55, prefixa');
assert.strictEqual(normalizarTelefone('5511999998888'), '5511999998888', 'já com 55, mantém');
assert.strictEqual(normalizarTelefone('(11) 99999-8888'), '5511999998888', 'remove formatação');
assert.strictEqual(normalizarTelefone('+55 11 99999-8888'), '5511999998888', 'remove + e espaços');

// dois formatos do MESMO número precisam colapsar no mesmo valor — é a
// premissa que faz a supressão e o histórico de contato funcionarem por
// telefone em vez de por string exata.
assert.strictEqual(
  normalizarTelefone('11 99999-8888'),
  normalizarTelefone('+5511999998888'),
  'duas grafias do mesmo número normalizam igual',
);

console.log('telefone: ok');
