// Verificação da segurança dos webhooks inbound (Fase 3B) —
// app/src/lib/inboundSeguranca.ts (HMAC WAHA, token Evolution) e do
// comportamento de payload malformado / instância desconhecida das rotas
// app/api/webhook/{waha,evolution/[token]}. Reimplementação em JS puro,
// mesmo padrão dos demais tests/*.test.js. `crypto` é módulo nativo do
// Node, usado direto (não precisa reimplementar HMAC).
// Roda com: node tests/inbound-seguranca.test.js
const assert = require('assert');
const { createHmac, timingSafeEqual } = require('crypto');

function compararSeguro(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verificarAssinaturaWaha(corpoCru, headerHmac, chaveEnv) {
  if (!chaveEnv) return { ok: false, motivo: 'segredo_nao_configurado' };
  if (!headerHmac) return { ok: false, motivo: 'header_ausente' };
  const esperado = createHmac('sha512', chaveEnv).update(corpoCru, 'utf8').digest('hex');
  if (!compararSeguro(headerHmac.toLowerCase(), esperado.toLowerCase())) {
    return { ok: false, motivo: 'assinatura_invalida' };
  }
  return { ok: true };
}

function verificarTokenEvolution(tokenRecebido, tokenEnv) {
  if (!tokenEnv) return { ok: false, motivo: 'segredo_nao_configurado' };
  if (!tokenRecebido || !compararSeguro(tokenRecebido, tokenEnv)) {
    return { ok: false, motivo: 'token_invalido' };
  }
  return { ok: true };
}

// ------------------------------------------------------------- HMAC (WAHA)
const chave = 'segredo-de-teste-nao-real';
const corpo = JSON.stringify({ event: 'message', session: 'conta_x', payload: { id: '1' } });
const hmacCorreto = createHmac('sha512', chave).update(corpo, 'utf8').digest('hex');

assert.deepStrictEqual(verificarAssinaturaWaha(corpo, hmacCorreto, chave), { ok: true }, 'assinatura correta é aceita');
assert.strictEqual(verificarAssinaturaWaha(corpo, hmacCorreto, undefined).ok, false, 'sem segredo configurado, rejeita mesmo com assinatura "certa" — falha fechada');
assert.strictEqual(verificarAssinaturaWaha(corpo, undefined, chave).ok, false, 'sem header, rejeita');
assert.strictEqual(verificarAssinaturaWaha(corpo, 'assinatura-forjada', chave).ok, false, 'assinatura errada é rejeitada');
assert.strictEqual(
  verificarAssinaturaWaha(corpo + ' ', hmacCorreto, chave).ok, false,
  'corpo alterado em 1 byte já invalida a assinatura (confirma que o HMAC é sobre o corpo cru, não sobre um objeto reparseado que ignoraria espaços)',
);

// ---------------------------------------------------------- token (Evolution)
const token = 'token-secreto-de-teste';
assert.deepStrictEqual(verificarTokenEvolution(token, token), { ok: true }, 'token correto é aceito');
assert.strictEqual(verificarTokenEvolution(token, undefined).ok, false, 'sem segredo configurado, rejeita — falha fechada');
assert.strictEqual(verificarTokenEvolution('token-errado', token).ok, false, 'token errado é rejeitado');
assert.strictEqual(verificarTokenEvolution(null, token).ok, false, 'token ausente é rejeitado');

// ---------------------------------------------- payload malformado (rota)
// Espelha o try/catch de JSON.parse nas duas rotas: erro nunca vaza detalhe
// interno (stack, chave, corpo recebido) — só um motivo genérico.
function responderPayloadInvalido() {
  return { ok: false, erro: 'payload inválido' }; // nenhuma outra chave
}
const respostaErro = responderPayloadInvalido();
assert.deepStrictEqual(Object.keys(respostaErro).sort(), ['erro', 'ok'], 'resposta de payload inválido só tem ok/erro — nada de stack, chave ou corpo cru');
assert.ok(!JSON.stringify(respostaErro).includes(chave), 'resposta de erro não vaza segredo nenhum');

// -------------------------------------------- instância desconhecida (Evolution)
// Espelha resolverContaEvolution: só resolve com EXATAMENTE 1 conta.
function resolverContaEvolutionMock(contas, instancia) {
  const encontradas = contas.filter((c) => c.evolution_instancia === instancia && c.whatsapp_provider === 'evolution');
  if (encontradas.length !== 1) return null;
  return encontradas[0].conta_id;
}
const contasFake = [
  { conta_id: 'conta-1', evolution_instancia: 'inst-a', whatsapp_provider: 'evolution' },
  { conta_id: 'conta-2', evolution_instancia: 'inst-a', whatsapp_provider: 'evolution' }, // duplicata proposital
];
assert.strictEqual(
  resolverContaEvolutionMock(contasFake, 'inst-a'), null,
  'instância cadastrada em MAIS de uma conta não resolve para nenhuma — nunca associa à "primeira encontrada"',
);
assert.strictEqual(resolverContaEvolutionMock(contasFake, 'inst-desconhecida'), null, 'instância desconhecida não resolve conta nenhuma');
assert.strictEqual(
  resolverContaEvolutionMock([{ conta_id: 'conta-3', evolution_instancia: 'inst-b', whatsapp_provider: 'evolution' }], 'inst-b'),
  'conta-3',
  'instância cadastrada em exatamente 1 conta resolve normalmente',
);

console.log('inbound-seguranca: ok');
