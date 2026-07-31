// Verificação da lógica de Envios do painel (painel/index.html).
// Roda com: node tests/envio.test.js
const assert = require('assert');

const ENVIO_CONFIG = { modo: 'ia', mensagens: [], contexto: '' };

function mensagemDoLead(indice) {
  if (ENVIO_CONFIG.modo === 'ia') return null;
  if (!ENVIO_CONFIG.mensagens.length) return null;
  if (ENVIO_CONFIG.modo === 'rodizio') {
    return ENVIO_CONFIG.mensagens[indice % ENVIO_CONFIG.mensagens.length];
  }
  return ENVIO_CONFIG.mensagens[0];
}

const lerMensagens = (t) => t.split(/^\s*---\s*$/m).map(m => m.trim()).filter(Boolean);

// null é o sinal para o n8n seguir pela IA — os dois casos abaixo dependem disso
assert.strictEqual(mensagemDoLead(0), null, 'modo ia devolve null');

ENVIO_CONFIG.modo = 'fixa';
ENVIO_CONFIG.mensagens = ['A', 'B', 'C'];
assert.strictEqual(mensagemDoLead(0), 'A');
assert.strictEqual(mensagemDoLead(7), 'A', 'fixa nunca alterna');

ENVIO_CONFIG.modo = 'rodizio';
assert.deepStrictEqual([0, 1, 2, 3, 4].map(mensagemDoLead), ['A', 'B', 'C', 'A', 'B'], 'rodizio circula');

ENVIO_CONFIG.mensagens = [];
assert.strictEqual(mensagemDoLead(0), null, 'sem mensagem cadastrada cai para a IA');

assert.deepStrictEqual(lerMensagens('Oi um\n---\nOi dois\n---\nOi três'), ['Oi um', 'Oi dois', 'Oi três']);
assert.deepStrictEqual(lerMensagens('  Só uma  '), ['Só uma'], 'sem separador = uma mensagem');
assert.deepStrictEqual(lerMensagens('A\n---\n\n---\nB'), ['A', 'B'], 'bloco vazio ignorado');
assert.deepStrictEqual(lerMensagens('preço --- promoção'), ['preço --- promoção'], 'traço no meio da linha não separa');

console.log('envio: ok');
