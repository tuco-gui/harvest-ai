// Verificação da Fase 3B — adapters WAHA/Evolution, resolução de conta e
// pipeline de inbound (app/src/lib/inbound{Tipos,Waha,Evolution,Conta}.ts,
// app/src/lib/inbound.ts). Reimplementação em JS puro, mesmo padrão de
// telefone.test.js/protecao-outbound.test.js — este repo não tem
// ts-node/jest configurado; mantemos as duas em sincronia manualmente.
// Roda com: node tests/inbound.test.js
const assert = require('assert');

function normalizarTelefone(bruto) {
  if (!bruto) return null;
  let d = String(bruto).replace(/\D/g, '');
  if (d.length < 10) return null;
  if (!d.startsWith('55')) d = '55' + d;
  if (d.length > 13) return null; // falha fechada contra LID (2026-08-13)
  return d;
}

// ---------------------------------------------------------------- adapter WAHA
const EVENTOS_MENSAGEM = new Set(['message', 'message.any']);

function timestampIso(bruto) {
  if (typeof bruto !== 'number' || !Number.isFinite(bruto)) return new Date().toISOString();
  const ms = bruto > 2_000_000_000 ? bruto : bruto * 1000;
  return new Date(ms).toISOString();
}

function normalizarEventoWaha(body) {
  if (!body?.event || !EVENTOS_MENSAGEM.has(body.event)) return null;
  const p = body.payload;
  if (!p) return null;
  const jidBruto = String(p.from ?? '');
  if (!jidBruto || jidBruto.endsWith('@g.us')) return null;
  const key = p._data?.key;
  const usaLid = jidBruto.endsWith('@lid') || key?.addressingMode === 'lid';
  const jid = usaLid
    ? (key?.remoteJidAlt && key.remoteJidAlt.endsWith('@s.whatsapp.net') ? key.remoteJidAlt : null)
    : jidBruto;
  if (!jid) return null;
  const telefone = normalizarTelefone(jid.split('@')[0]);
  if (!telefone) return null;
  const messageIdExterno = p.id ? String(p.id) : null;
  if (!messageIdExterno) return null;
  return {
    provider: 'waha',
    telefone,
    mensagem: typeof p.body === 'string' && p.body.length > 0 ? p.body : null,
    messageIdExterno,
    timestamp: timestampIso(p.timestamp),
    nomeContato: p.notifyName ?? p._data?.notifyName ?? null,
    tipoMensagem: p.hasMedia ? 'midia' : (typeof p.body === 'string' && p.body.length > 0 ? 'texto' : 'outro'),
    fromMe: p.fromMe === true,
    payloadBruto: body,
  };
}

// ------------------------------------------------------------ adapter Evolution
const CHAVES_MIDIA = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'];

function extrairTexto(msg) {
  if (typeof msg.conversation === 'string' && msg.conversation.length > 0) return msg.conversation;
  if (typeof msg.extendedTextMessage?.text === 'string' && msg.extendedTextMessage.text.length > 0) return msg.extendedTextMessage.text;
  return null;
}

function normalizarEventoEvolution(body) {
  if (body?.event !== 'messages.upsert') return null;
  const d = body.data;
  const key = d?.key;
  if (!d || !key) return null;
  const jid = String(key.remoteJid ?? '');
  if (!jid || jid.endsWith('@g.us')) return null;
  const telefone = normalizarTelefone(jid.split('@')[0]);
  if (!telefone) return null;
  const messageIdExterno = key.id ? String(key.id) : null;
  if (!messageIdExterno) return null;
  const msg = d.message ?? {};
  const texto = extrairTexto(msg);
  return {
    provider: 'evolution',
    telefone,
    mensagem: texto,
    messageIdExterno,
    timestamp: timestampIso(d.messageTimestamp),
    nomeContato: d.pushName ?? null,
    tipoMensagem: texto ? 'texto' : (CHAVES_MIDIA.some((c) => c in msg) ? 'midia' : 'outro'),
    fromMe: key.fromMe === true,
    payloadBruto: body,
  };
}

// --------------------------------------------------------------- resolução de conta
function wahaSessionName(contaId) {
  return `conta_${contaId.replace(/-/g, '')}`;
}

function contaIdDoSessionWaha(sessionName) {
  const m = /^conta_([0-9a-f]{32})$/i.exec(sessionName ?? '');
  if (!m) return null;
  const hex = m[1];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// =====================================================================
// 1. payload WAHA válido → normaliza corretamente
const uuidTeste = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const eventoWaha = normalizarEventoWaha({
  event: 'message',
  session: wahaSessionName(uuidTeste),
  payload: { id: 'wa_msg_1', from: '5511999998888@c.us', fromMe: false, body: 'Oi, tenho interesse', hasMedia: false, notifyName: 'Fulano', timestamp: 1_700_000_000 },
});
assert.ok(eventoWaha, 'payload WAHA válido normaliza');
assert.strictEqual(eventoWaha.provider, 'waha');
assert.strictEqual(eventoWaha.telefone, '5511999998888', 'telefone WAHA normalizado');
assert.strictEqual(eventoWaha.mensagem, 'Oi, tenho interesse');
assert.strictEqual(eventoWaha.tipoMensagem, 'texto');
assert.strictEqual(eventoWaha.fromMe, false);

// 2. payload Evolution válido → normaliza corretamente, MESMO FORMATO
const eventoEvolution = normalizarEventoEvolution({
  event: 'messages.upsert',
  instance: 'minha-instancia',
  data: {
    key: { id: 'evo_msg_1', fromMe: false, remoteJid: '5511999998888@s.whatsapp.net' },
    pushName: 'Fulano',
    messageTimestamp: 1_700_000_000,
    message: { conversation: 'Oi, tenho interesse' },
  },
});
assert.ok(eventoEvolution, 'payload Evolution válido normaliza');
assert.strictEqual(eventoEvolution.provider, 'evolution');

// 3. mesmo formato interno após normalização (mesmas chaves nos dois)
assert.deepStrictEqual(
  Object.keys(eventoWaha).sort(),
  Object.keys(eventoEvolution).sort(),
  'WAHA e Evolution produzem o mesmo formato interno — só o provider muda',
);
assert.strictEqual(eventoWaha.telefone, eventoEvolution.telefone, 'telefone normalizado igual para o mesmo número nos dois providers');
assert.strictEqual(eventoWaha.mensagem, eventoEvolution.mensagem, 'mesma mensagem extraída nos dois formatos');

// 4. telefone normalizado (jid sem DDI explícito ainda normaliza com 55, igual ao jid completo)
const eventoSemDDI = normalizarEventoWaha({
  event: 'message',
  session: wahaSessionName(uuidTeste),
  payload: { id: 'wa_msg_2', from: '11999998888@c.us', fromMe: false, body: 'oi' },
});
assert.strictEqual(eventoSemDDI.telefone, '5511999998888', 'jid sem 55 explícito normaliza igual ao jid completo — mesma premissa de telefone.test.js');

// jid de grupo (@g.us) é ignorado com segurança — não há um único lead/telefone a correlacionar
const eventoGrupo = normalizarEventoWaha({
  event: 'message',
  session: wahaSessionName(uuidTeste),
  payload: { id: 'wa_msg_grupo', from: '120363000000000000@g.us', fromMe: false, body: 'mensagem em grupo' },
});
assert.strictEqual(eventoGrupo, null, 'mensagem de grupo é ignorada (fora de escopo da Fase 3B)');

// 5. identificação correta da conta — WAHA (session → conta_id determinístico)
assert.strictEqual(contaIdDoSessionWaha(wahaSessionName(uuidTeste)), uuidTeste, 'sessão WAHA resolve de volta para o conta_id exato');
assert.strictEqual(contaIdDoSessionWaha('session-aleatoria'), null, 'nome de sessão fora do padrão não resolve conta nenhuma');
assert.strictEqual(contaIdDoSessionWaha('conta_naoehex'), null, 'sessão com sufixo que não é hex não resolve');

// 6. mensagem duplicada não processada duas vezes (idempotência conta+provider+message_id)
function processarIdempotente(armazenados, contaId, provider, messageIdExterno) {
  const jaExiste = armazenados.some((e) => e.contaId === contaId && e.provider === provider && e.messageIdExterno === messageIdExterno);
  if (jaExiste) return { duplicado: true };
  armazenados.push({ contaId, provider, messageIdExterno });
  return { duplicado: false };
}
const armazenados = [];
assert.strictEqual(processarIdempotente(armazenados, uuidTeste, 'waha', 'wa_msg_1').duplicado, false, 'primeira vez processa');
assert.strictEqual(processarIdempotente(armazenados, uuidTeste, 'waha', 'wa_msg_1').duplicado, true, 'reenvio do mesmo evento (retry do provider) não processa de novo');
assert.strictEqual(armazenados.length, 1, 'só uma linha gravada para o evento repetido');

// 7. mensagem enviada pelo próprio sistema (fromMe) ignorada
const eventoFromMe = normalizarEventoWaha({
  event: 'message',
  session: wahaSessionName(uuidTeste),
  payload: { id: 'wa_msg_3', from: '5511999998888@c.us', fromMe: true, body: 'Mensagem que o Harvest mandou' },
});
assert.ok(eventoFromMe, 'evento fromMe ainda normaliza (o adapter não decide, só marca)');
assert.strictEqual(eventoFromMe.fromMe, true);
// decisão de ignorar é do pipeline (lib/inbound.ts), não do adapter:
function decisaoPipeline(evento, contaId) {
  if (evento.fromMe) return { ok: true, ignorado: true, motivo: 'fromMe' };
  if (!contaId) return { ok: false, erro: 'conta_nao_resolvida' };
  return { ok: true, processado: true };
}
assert.deepStrictEqual(decisaoPipeline(eventoFromMe, uuidTeste), { ok: true, ignorado: true, motivo: 'fromMe' }, 'pipeline descarta fromMe antes de qualquer outra coisa');

// 8. conta desconhecida não contamina outro tenant
assert.strictEqual(contaIdDoSessionWaha(wahaSessionName('outro-uuid-que-nao-bate-no-regex')), null, 'UUID malformado não gera conta_id nenhum');
const decisaoSemConta = decisaoPipeline(eventoWaha, null);
assert.deepStrictEqual(decisaoSemConta, { ok: false, erro: 'conta_nao_resolvida' }, 'sem conta resolvida, nada é processado nem associado a ninguém');

// 9. lead existente localizado (por telefone normalizado + conta, nunca por nome)
function localizarLead(leads, contaId, telefone) {
  return leads.find((l) => l.contaId === contaId && l.telefone === telefone) ?? null;
}
const leadsFake = [{ id: 42, contaId: uuidTeste, telefone: '5511999998888', nome: 'Empresa Teste' }];
const leadEncontrado = localizarLead(leadsFake, uuidTeste, eventoWaha.telefone);
assert.strictEqual(leadEncontrado?.id, 42, 'lead existente localizado por telefone+conta');
assert.strictEqual(localizarLead(leadsFake, 'outra-conta', eventoWaha.telefone), null, 'mesmo telefone em OUTRA conta não localiza o lead — isolamento por conta_id');

// 10. telefone desconhecido aceito como inbound sem inventar vínculo
const leadDesconhecido = localizarLead(leadsFake, uuidTeste, '5511900001111');
assert.strictEqual(leadDesconhecido, null, 'telefone sem lead correspondente não inventa vínculo — evento ainda é válido, só sem leadId');

// 11. BUG REAL DE PRODUÇÃO (2026-08-13): contato endereçado por LID —
// `from` é um lid opaco (`@lid`), telefone real vem em `_data.key.remoteJidAlt`.
// Payload abaixo é o formato real (números trocados) do evento de opt-out
// capturado em produção que motivou esta correção.
const eventoLid = normalizarEventoWaha({
  event: 'message',
  session: wahaSessionName(uuidTeste),
  payload: {
    id: 'false_21342044815384@lid_ABC123',
    from: '21342044815384@lid',
    fromMe: false,
    body: 'Sair',
    _data: { key: { remoteJid: '21342044815384@lid', remoteJidAlt: '5514997554659@s.whatsapp.net', addressingMode: 'lid' } },
  },
});
assert.ok(eventoLid, 'evento com addressing LID ainda normaliza (via remoteJidAlt)');
assert.strictEqual(eventoLid.telefone, '5514997554659', 'telefone real (remoteJidAlt) usado, NÃO o número do lid');
assert.notStrictEqual(eventoLid.telefone, '5521342044815384', 'nunca usa o lid como telefone');

// 12. LID sem remoteJidAlt disponível → descarta em vez de gravar lixo
const eventoLidSemAlt = normalizarEventoWaha({
  event: 'message',
  session: wahaSessionName(uuidTeste),
  payload: { id: 'wa_msg_lid_sem_alt', from: '21342044815384@lid', fromMe: false, body: 'oi' },
});
assert.strictEqual(eventoLidSemAlt, null, 'sem remoteJidAlt, evento LID é descartado (fail closed) em vez de virar telefone falso');

// 13. normalizarTelefone rejeita dígitos longos demais para ser telefone (defesa em profundidade)
assert.strictEqual(normalizarTelefone('21342044815384'), null, 'número de 14 dígitos (lid típico) é rejeitado como telefone');
assert.strictEqual(normalizarTelefone('216827867185396'), null, 'número de 15 dígitos (lid típico) é rejeitado como telefone');

console.log('inbound: ok');
