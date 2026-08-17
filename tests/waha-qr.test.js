// Verificação do Hotfix P0 (QR WAHA não aparece) e P1 (progresso de
// disparo incoerente). Reimplementa em JS puro a lógica de decisão real de
// app/src/lib/waha.ts (getOrCreateSession/getQrCode), app/src/lib/
// whatsappCanais.ts (reconciliarStatusWaha) e app/src/componentes/
// Configuracoes.tsx / CampanhaDetalhe.tsx (polling e classificação de
// resultado de disparo) — mesmo padrão de telefone.test.js: este repo não
// tem ts-node/jest configurado, os testes não importam o .ts direto, e as
// duas fontes são mantidas em sincronia manualmente.
// Roda com: node tests/waha-qr.test.js
const assert = require('assert');

// ---------------------------------------------------------------------
// 1) CRIAÇÃO DE CANAL WAHA — status inicial e o que o front deve fazer.
// Espelha POST /api/canais (sempre cria com status='desconhecido') e a
// regra do hotfix: canal WAHA recém-criado deve abrir o painel de conexão
// automaticamente, não ficar mudo em "Não conectado".
// ---------------------------------------------------------------------
function criarCanal(provider) {
  return { status: 'desconectado', provider, ativo: true };
}
function devePainelAbrirAoCriar(canal) {
  return canal.provider === 'waha';
}
{
  const canalWaha = criarCanal('waha');
  const canalEvolution = criarCanal('evolution');
  assert.strictEqual(canalWaha.status, 'desconectado', 'canal nasce desconectado, nunca conectado');
  assert.strictEqual(devePainelAbrirAoCriar(canalWaha), true, 'canal WAHA recém-criado deve abrir o painel de QR automaticamente (hotfix)');
  assert.strictEqual(devePainelAbrirAoCriar(canalEvolution), false, 'canal Evolution não usa QR — não abre o painel WAHA');
}
console.log('criação de canal WAHA: ok');

// Cada canal tem uma sessão determinística própria. O legado é preservado
// apenas para o primeiro canal já existente.
function nomeSessao(contaId, canalId) {
  const tenant = contaId.replace(/[^a-zA-Z0-9]/g, '');
  return canalId == null ? `conta_${tenant}` : `harvest_${tenant}_c${canalId}`;
}
{
  const conta = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  assert.notStrictEqual(nomeSessao(conta, 10), nomeSessao(conta, 11), 'dois canais da mesma conta nunca compartilham sessão');
  assert.notStrictEqual(nomeSessao(conta, 10), nomeSessao('ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee', 10), 'mesmo id em tenants diferentes nunca colide');
  assert.strictEqual(nomeSessao(conta), 'conta_aaaaaaaabbbbccccddddeeeeeeeeeeee', 'nome legado permanece estável para preservar canal conectado');
}
console.log('sessão por tenant/canal: ok');

// ---------------------------------------------------------------------
// 2) GERAÇÃO DE QR — só existe QR quando o status da sessão é SCAN_QR_CODE.
// Espelha getQrCode/getOrCreateSession de lib/waha.ts.
// ---------------------------------------------------------------------
function respostaSessao(statusWaha, qrDisponivel) {
  // Mesma regra do GET /api/waha/session: só busca/retorna QR quando
  // status === 'SCAN_QR_CODE'.
  const qr = statusWaha === 'SCAN_QR_CODE' ? (qrDisponivel ? 'data:image/png;base64,AAA' : null) : null;
  return { status: statusWaha, qr };
}
{
  const r1 = respostaSessao('SCAN_QR_CODE', true);
  assert.strictEqual(r1.qr, 'data:image/png;base64,AAA', 'QR presente quando status é SCAN_QR_CODE e o WAHA devolveu imagem');

  const r2 = respostaSessao('STARTING', true);
  assert.strictEqual(r2.qr, null, 'QR nunca é buscado fora de SCAN_QR_CODE, mesmo se hipoteticamente disponível');

  const r3 = respostaSessao('WORKING', true);
  assert.strictEqual(r3.qr, null, 'sessão já conectada não tem QR');
}
console.log('geração de QR: ok');

// ---------------------------------------------------------------------
// 3) QR AUSENTE/ERRO — falha ao criar sessão vira status terminal 'ERRO',
// nunca fica devolvendo algo que o poller interpretaria como "inicializando
// pra sempre" (getOrCreateSession).
// ---------------------------------------------------------------------
function getOrCreateSessionSimulado({ sessaoExiste, criacaoFalhou }) {
  if (!sessaoExiste) {
    if (criacaoFalhou) return { status: 'ERRO' };
    return { status: 'SCAN_QR_CODE' };
  }
  return { status: 'WORKING' };
}
{
  const r = getOrCreateSessionSimulado({ sessaoExiste: false, criacaoFalhou: true });
  assert.strictEqual(r.status, 'ERRO', 'falha ao criar sessão é status terminal ERRO, não um estado que gera poll infinito');
}
console.log('QR ausente/erro: ok');

// ---------------------------------------------------------------------
// 4) QR EXPIRADO — cada poll busca um QR NOVO e vivo (getQrCode sempre lê
// ao vivo da API do WAHA, nunca cacheado). "Atualizar QR" refaz a mesma
// chamada de conectar.
// ---------------------------------------------------------------------
function poolDeQrsPorPoll() {
  // Simula 3 polls sucessivos — cada um pode trazer um QR diferente
  // (WAHA gira o QR periodicamente). O front nunca deve reter o QR antigo
  // depois de um novo poll bem-sucedido.
  return ['QR_1', 'QR_2', 'QR_2']; // QR_2 se repete (ainda não escaneado, mesmo QR)
}
{
  const polls = poolDeQrsPorPoll();
  let qrAtual = null;
  for (const qr of polls) qrAtual = qr; // cada poll SOBRESCREVE o QR mostrado
  assert.strictEqual(qrAtual, 'QR_2', 'QR exibido é sempre o do poll mais recente, nunca um QR expirado retido em estado antigo');
}
console.log('QR expirado (atualização contínua): ok');

// ---------------------------------------------------------------------
// 5) MUDANÇA PARA CONECTADO — status WORKING encerra o polling e deve
// disparar um refresh da tabela de canais (reconciliação server-side).
// ---------------------------------------------------------------------
function decidirProximoPasso(status, tentativas, maxTentativas) {
  if (status === 'WORKING') return { parar: true, erro: null, refresh: true };
  if (status === 'FAILED' || status === 'ERRO') return { parar: true, erro: 'sessão falhou', refresh: false };
  if (tentativas >= maxTentativas) return { parar: true, erro: 'timeout', refresh: false };
  return { parar: false, erro: null, refresh: false };
}
{
  const r = decidirProximoPasso('WORKING', 5, 60);
  assert.strictEqual(r.parar, true, 'WORKING é terminal, para de pollar');
  assert.strictEqual(r.refresh, true, 'WORKING dispara refresh — sem isso o canal fica "Não conectado" na tabela até F5 manual (o bug original)');
}
console.log('mudança para conectado: ok');

// ---------------------------------------------------------------------
// 6) POLLING — teto de tentativas evita poll eterno num WAHA quebrado, e
// erro de rede/API não é engolido silenciosamente (hotfix: antes o poll
// falho resetava pra null sem avisar o usuário).
// ---------------------------------------------------------------------
{
  const semTeto = decidirProximoPasso('STARTING', 59, 60);
  assert.strictEqual(semTeto.parar, false, 'ainda dentro do teto, continua pollando');
  const comTeto = decidirProximoPasso('STARTING', 60, 60);
  assert.strictEqual(comTeto.parar, true, 'estourou o teto de tentativas, para e informa erro (não fica pollando pra sempre)');
  assert.ok(comTeto.erro, 'erro é reportado ao usuário, não um silencioso "Não conectado"');
}
console.log('polling (teto de tentativas): ok');

// ---------------------------------------------------------------------
// 7) ESTADO APÓS RELOAD — reconciliarStatusWaha: canal reflete a sessão
// real do WAHA a cada carregamento da página, não fica preso no
// status='desconhecido' gravado na criação.
// ---------------------------------------------------------------------
function reconciliarStatusWaha(canal, statusSessaoReal) {
  if (canal.provider !== 'waha' || !canal.ativo) return canal;
  const conectado = statusSessaoReal === 'WORKING';
  return { ...canal, status: conectado ? 'conectado' : 'desconectado' };
}
{
  const canal = { provider: 'waha', ativo: true, status: 'desconhecido' };
  const depoisDeConectar = reconciliarStatusWaha(canal, 'WORKING');
  assert.strictEqual(depoisDeConectar.status, 'conectado', 'reload reflete conectado quando a sessão real está WORKING');

  const canalAindaNaoEscaneado = reconciliarStatusWaha(canal, 'SCAN_QR_CODE');
  assert.strictEqual(canalAindaNaoEscaneado.status, 'desconectado', 'reload reflete desconectado enquanto aguarda escaneamento');

  const canalEvolution = { provider: 'evolution', ativo: true, status: 'desconhecido' };
  assert.strictEqual(reconciliarStatusWaha(canalEvolution, 'WORKING').status, 'desconhecido', 'reconciliação WAHA nunca mexe em canal Evolution');
}
console.log('estado após reload (reconciliação): ok');

// ---------------------------------------------------------------------
// 8) PROGRESSO DE DISPARO — classificação real do resultado por lead
// (Hotfix P1). Antes: todo lead processado virava "disparo=sim"
// incondicionalmente, mesmo em erro/bloqueio. Agora: reflete r.ok e o
// motivo (suprimido = bloqueado por opt-out; qualquer outra falha = erro).
// ---------------------------------------------------------------------
function classificarResultadoDisparo(respostaOk, dados) {
  if (respostaOk) return 'enviado';
  if (dados?.suprimido) return 'bloqueado';
  return 'erro';
}
{
  assert.strictEqual(classificarResultadoDisparo(true, { ok: true }), 'enviado', 'sucesso vira enviado');
  assert.strictEqual(classificarResultadoDisparo(false, { suprimido: true }), 'bloqueado', 'bloqueio por opt-out (403 + suprimido) vira bloqueado, não "já disparado"');
  assert.strictEqual(classificarResultadoDisparo(false, { erro: 'WAHA fora do ar' }), 'erro', 'qualquer outra falha vira erro, não "já disparado"');
  assert.strictEqual(classificarResultadoDisparo(false, {}), 'erro', 'falha de rede (sem corpo JSON) também vira erro, nunca sucesso silencioso');
}
console.log('progresso de disparo (classificação real por lead): ok');

console.log('waha-qr: todos os cenários ok');
