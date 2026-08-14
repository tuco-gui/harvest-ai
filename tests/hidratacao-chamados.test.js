// Verificação da correção do hydration error #418 em /chamados.
// Reimplementada aqui em JS puro, no mesmo padrão de envio.test.js/telefone.test.js
// — este repo não tem ts-node/jest configurado, então os testes não importam o
// .ts direto; mantemos em sincronia manualmente com app/src/lib/data.ts e
// app/src/componentes/Chamados.tsx / ChamadoDetalhe.tsx.
//
// O que este teste garante:
// 1. formatarDataHora produz o MESMO texto independente do fuso horário do
//    runtime que está chamando (o bug original vinha de `toLocaleString('pt-BR')`
//    sem `timeZone`, que usa o fuso padrão do processo — diferente entre o
//    container do servidor e o navegador do usuário).
// 2. O cálculo de "SLA vencido" (slaVencido/vencido) depende de um `agoraMs`
//    passado como parâmetro — nunca de `Date.now()` direto no render — para
//    que a primeira renderização do cliente (hidratação) bata exatamente com
//    o HTML gerado no servidor.
//
// Roda com: node tests/hidratacao-chamados.test.js
const assert = require('assert');

const FUSO_HORARIO_NEGOCIO = 'America/Sao_Paulo';

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO_HORARIO_NEGOCIO });
}

function slaVencido(conversa, agoraMs) {
  return conversa.status === 'aberta' && new Date(conversa.prazo_sla).getTime() < agoraMs;
}

// --- 1. formatarDataHora é determinístico e independente do TZ do runtime ---

const isoExemplo = '2026-03-10T14:30:00.000Z';

// Mesmo texto em duas chamadas (nenhuma dependência de estado global/tempo real)
assert.strictEqual(formatarDataHora(isoExemplo), formatarDataHora(isoExemplo), 'formatarDataHora é determinístico');

// Simula servidor rodando em UTC vs cliente rodando em America/Sao_Paulo:
// sem o fix, `toLocaleString('pt-BR')` sem timeZone explícito produziria
// textos diferentes nesses dois cenários. Com o fix, o resultado não deve
// mudar mesmo alterando o TZ do processo Node, porque o timeZone é sempre
// passado explicitamente na chamada.
const tzOriginal = process.env.TZ;
try {
  process.env.TZ = 'UTC';
  const comoServidorUTC = formatarDataHora(isoExemplo);
  process.env.TZ = 'America/Sao_Paulo';
  const comoClienteSP = formatarDataHora(isoExemplo);
  assert.strictEqual(comoServidorUTC, comoClienteSP, 'formatarDataHora ignora o TZ do processo — sempre usa America/Sao_Paulo explícito');
} finally {
  if (tzOriginal === undefined) delete process.env.TZ; else process.env.TZ = tzOriginal;
}

// --- 2. slaVencido depende só de agoraMs (nunca de Date.now() implícito) ---

const agoraFixo = new Date('2026-03-10T12:00:00.000Z').getTime();

// Chamado aberto, prazo no futuro → dentro do SLA
assert.strictEqual(
  slaVencido({ status: 'aberta', prazo_sla: '2026-03-10T18:00:00.000Z' }, agoraFixo),
  false,
  'prazo no futuro não está vencido',
);

// Chamado aberto, prazo no passado → SLA vencido
assert.strictEqual(
  slaVencido({ status: 'aberta', prazo_sla: '2026-03-10T06:00:00.000Z' }, agoraFixo),
  true,
  'prazo no passado está vencido',
);

// Chamado já respondido/fechado nunca é "vencido", mesmo com prazo no passado
assert.strictEqual(
  slaVencido({ status: 'respondida', prazo_sla: '2026-03-10T06:00:00.000Z' }, agoraFixo),
  false,
  'chamado respondido não conta como vencido',
);
assert.strictEqual(
  slaVencido({ status: 'fechada', prazo_sla: '2026-03-10T06:00:00.000Z' }, agoraFixo),
  false,
  'chamado fechado não conta como vencido',
);

// Mesmo `agoraMs`, chamado sem SLA vencendo em cima da hora — resultado
// estável e repetível (não é hora real do sistema, então SSR e cliente
// (que recebem o mesmo agoraMs vindo do servidor) sempre concordam)
assert.strictEqual(
  slaVencido({ status: 'aberta', prazo_sla: '2026-03-10T12:00:00.001Z' }, agoraFixo),
  false,
  'prazo 1ms no futuro ainda não venceu',
);
assert.strictEqual(
  slaVencido({ status: 'aberta', prazo_sla: '2026-03-10T11:59:59.999Z' }, agoraFixo),
  true,
  'prazo 1ms no passado já venceu',
);

console.log('hidratacao-chamados: ok');
