// Verificação da lógica de decisão da Fase 3A (disparo/route.ts):
// - supressão bloqueia envio; contato-já-abordado NÃO bloqueia sozinho;
// - vínculo campanha_leads é idempotente e permite N:N.
// Reimplementação em JS puro, mesmo padrão de envio.test.js/telefone.test.js.
// Roda com: node tests/protecao-outbound.test.js
const assert = require('assert');

// Espelha a decisão em app/src/app/api/disparo/route.ts: só supressão
// bloqueia. contatoAnterior é sempre informativo, nunca impeditivo.
function podeEnviar({ suprimido }) {
  return !suprimido;
}

assert.strictEqual(podeEnviar({ suprimido: true }), false, 'suprimido bloqueia');
assert.strictEqual(podeEnviar({ suprimido: false }), true, 'não suprimido pode enviar');
// jaAbordado não é nem parâmetro de podeEnviar — de propósito: reforça que
// duplicidade nunca entra na decisão de bloquear, só supressão.

// Espelha campanha_leads: unique(campanha_id, lead_id), upsert idempotente.
function vincular(mapa, campanhaId, leadId) {
  const chave = `${campanhaId}:${leadId}`;
  const jaExistia = mapa.has(chave);
  mapa.set(chave, true);
  return !jaExistia; // true = criou vínculo novo
}

const vinculos = new Map();
assert.strictEqual(vincular(vinculos, 1, 100), true, 'primeiro vínculo (campanha 1, lead 100) é novo');
assert.strictEqual(vincular(vinculos, 1, 100), false, 'repetir o mesmo par não cria de novo (idempotente)');
assert.strictEqual(vincular(vinculos, 2, 100), true, 'mesmo lead (100) em OUTRA campanha (2) é um vínculo novo — QA: lead em duas campanhas');
assert.strictEqual(vinculos.size, 2, 'lead 100 termina vinculado a exatamente 2 campanhas');

// Espelha conta_supressao: unique(conta_id, telefone), isolado por conta.
function estaSuprimidoMock(supressoes, contaId, telefone) {
  return supressoes.some((s) => s.conta_id === contaId && s.telefone === telefone);
}

const supressoes = [{ conta_id: 'conta-a', telefone: '5511999998888', motivo: 'opt_out' }];
assert.strictEqual(estaSuprimidoMock(supressoes, 'conta-a', '5511999998888'), true, 'telefone suprimido na própria conta bloqueia');
assert.strictEqual(estaSuprimidoMock(supressoes, 'conta-b', '5511999998888'), false, 'mesmo telefone em OUTRA conta não está suprimido — isolamento por conta_id');
assert.strictEqual(estaSuprimidoMock(supressoes, 'conta-a', '5511999997777'), false, 'telefone diferente não está suprimido');

console.log('protecao-outbound: ok');
