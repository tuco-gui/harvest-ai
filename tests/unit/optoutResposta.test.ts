/**
 * Testes unitários da detecção opt-out/resposta (lib/optoutResposta.ts) — Fase 3C.
 * Roda sem banco: node --experimental-strip-types tests/unit/optoutResposta.test.ts
 */
import { classificarMensagem, ehOptOut } from '../../app/src/lib/optoutResposta.ts';

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log('  ok  -', msg);
  else { falhas++; console.error('  FALHOU -', msg); }
}

// --- Opt-out explícito ---
ok(ehOptOut('Pare de me mandar mensagem'), 'opt-out: "Pare de me mandar mensagem"');
ok(ehOptOut('PARAR'), 'opt-out: "PARAR" (maiúsculo)');
ok(ehOptOut('por favor cancele'), 'opt-out: "por favor cancele"');
ok(ehOptOut('não perturbe'), 'opt-out: "não perturbe"');
ok(ehOptOut('quero descadastrar'), 'opt-out: "quero descadastrar"');
ok(ehOptOut('remove meu número'), 'opt-out: "remove meu número"');
ok(ehOptOut('unsubscribe'), 'opt-out: "unsubscribe"');
ok(ehOptOut('NÃO QUERO MAIS'), 'opt-out: "NÃO QUERO MAIS" (sem acento)');
ok(ehOptOut('não mande mais nada'), 'opt-out: "não mande mais nada"');

// --- NÃO é opt-out (objeção comum, não pedido de parada) ---
ok(!ehOptOut('não tenho interesse'), 'não opt-out: "não tenho interesse" (objeção)');
ok(!ehOptOut('não'), 'não opt-out: "não" sozinho');
ok(!ehOptOut('obrigado, mas não agora'), 'não opt-out: "obrigado, mas não agora"');
ok(!ehOptOut('qual o preço?'), 'não opt-out: pergunta comum');
ok(!ehOptOut(''), 'não opt-out: vazio');
ok(!ehOptOut(null), 'não opt-out: null');
ok(!ehOptOut('me liga amanhã'), 'não opt-out: pedido de ligação');

// --- classificarMensagem retorna o tipo certo ---
ok(classificarMensagem('stop') === 'optout', 'classificar: stop -> optout');
ok(classificarMensagem('oi, tudo bem?') === 'resposta', 'classificar: saudação -> resposta');
ok(classificarMensagem(null) === 'resposta', 'classificar: null -> resposta (não órfão)');

// --- tolerância a acento/pontuação ---
ok(ehOptOut('Não perturbe!'), 'opt-out: acento + exclamação ignorados');
ok(ehOptOut('  pare  '), 'opt-out: espaços nas bordas ignorados');

if (falhas) {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
console.log('\nTodos os testes de opt-out/resposta passaram.');
