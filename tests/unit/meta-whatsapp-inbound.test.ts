import assert from 'node:assert/strict';
import { test, mock } from 'node:test';

const chamadas: Array<{ conta: string; lead: any }> = [];
let duplicate = false;
let funilConfig = 13;
let tokenMeta: string|null = 'cifrado';

mock.module('../../app/src/lib/superlogica.ts', {
  namedExports: {
    capturarLeadSuperlogica: async (_admin: any, conta: string, lead: any) => {
      chamadas.push({ conta, lead });
      return 'registro-1';
    },
  },
});
mock.module('../../app/src/lib/servicosWorkspace.ts', {
  namedExports: { recursoDaWorkspace: async () => true },
});

const { extrairMensagensMeta, gravarMensagemMeta, chaveCapturaWhatsAppMeta } =
  await import('../../app/src/lib/crmMetaInbound.ts');

function admin() {
  return {
    from(tabela: string) {
      const q: any = {
        _insert: null as any,
        _eq: [] as Array<[string, any]>,
        select() { return q; },
        eq(k: string, v: any) { q._eq.push([k, v]); return q; },
        in() { return q; },
        limit() { return q; },
        maybeSingle() { return q; },
        single() { return q; },
        insert(p: any) { q._insert = p; return q; },
        update() { return q; },
        then(resolve: (r: any) => void) {
          if (tabela === 'crm_fontes_funil') {
            return resolve({ data: [{
              id: 'fonte-1', conta_id: 'conta-1', funil_id: 13,
              meta_token_cifrado: tokenMeta, status: 'pronto',
            }], error: null });
          }
          if (tabela === 'crm_conversas_externas') {
            return resolve(q._insert ? { data: { id: 'conversa-1' }, error: null }
              : { data: null, error: null });
          }
          if (tabela === 'crm_mensagens_externas') {
            return resolve({ data: null, error: duplicate ? { code: '23505' } : null });
          }
          if (tabela === 'bdr_config') {
            const pedido = q._eq.find(([k]: [string, any]) => k === 'funil_id')?.[1];
            return resolve(funilConfig === pedido
              ? { data: { funil_id: funilConfig }, error: null }
              : { data: null, error: null });
          }
          return resolve({ data: null, error: null });
        },
      };
      return q;
    },
    rpc: async () => ({ data: null, error: null }),
  } as any;
}

const payload = {
  object: 'whatsapp_business_account',
  entry: [{
    id: 'waba-1',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { phone_number_id: '123456789012345' },
        contacts: [{ wa_id: '5514997754659', profile: { name: 'Piloto' } }],
        messages: [
          { id: 'wamid.1', from: '5514997754659', type: 'text', text: { body: 'Olá, tenho interesse' } },
          { id: 'wamid.2', from: '5514997754659', type: 'image', image: { id: 'midia' } },
        ],
        statuses: [{ id: 'wamid.1', status: 'delivered' }],
      },
    }],
  }],
};

test('normaliza WhatsApp Cloud API e ignora status/mídia', () => {
  const eventos = extrairMensagensMeta(payload);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].plataforma, 'whatsapp_cloud_api');
  assert.equal(eventos[0].contaExternaId, '123456789012345');
  assert.equal(eventos[0].remetenteId, '5514997754659');
  assert.equal(eventos[0].mensagemId, 'wamid.1');
  assert.equal(eventos[0].nomeContato, 'Piloto');
});

test('WhatsApp HMAC pré-validado no endpoint não depende de OAuth Instagram, mas outras fontes dependem', async () => {
 chamadas.length = 0;
 tokenMeta = null;
 try {
  const evento = extrairMensagensMeta(payload)[0];
  assert.equal(await gravarMensagemMeta(admin(),evento),'gravada');
  assert.equal(chamadas.length,1,'webhook WhatsApp recebe mesmo sem token OAuth por fonte');
  const semToken = {...evento,plataforma:'instagram_dm' as const};
  assert.equal(await gravarMensagemMeta(admin(),semToken),'ignorada',
    'Instagram/Messenger não devem aceitar fonte sem token próprio');
 }finally{tokenMeta='cifrado';}
});

test('captura idempotente alcança o piloto e também outros contatos nomeados', async () => {
  chamadas.length = 0;
  assert.equal(await gravarMensagemMeta(admin(), extrairMensagensMeta(payload)[0]), 'gravada');
  assert.deepEqual(chamadas[0], {
    conta: 'conta-1',
    lead: {
      chave: 'meta-wa:123456789012345:5514997754659', nome: 'Piloto', telefone: '5514997754659', email: null,
      origem: { source_channel: 'meta', utm_source: 'whatsapp' },
    },
  });

  chamadas.length = 0;
  await gravarMensagemMeta(admin(), {
    ...extrairMensagensMeta(payload)[0],
    mensagemId: 'wamid.9', remetenteId: '5514888888888', nomeContato: 'Outro contato',
  });
  assert.equal(chamadas.length, 1, 'contato fora do piloto é capturado sem resposta automática');
  assert.equal(chamadas[0].lead.telefone, '5514888888888');
});

test('uma conversa com várias mensagens conserva a chave comercial, mas receptores/contatos diferentes não colidem', async () => {
 const e = extrairMensagensMeta(payload)[0];
 assert.equal(chaveCapturaWhatsAppMeta(e), 'meta-wa:123456789012345:5514997754659');
 assert.equal(chaveCapturaWhatsAppMeta({...e,mensagemId:'wamid.99',texto:'Nova pergunta'}),
   chaveCapturaWhatsAppMeta(e), 'outras mensagens não criam nova entrada comercial');
 assert.notEqual(chaveCapturaWhatsAppMeta({...e,remetenteId:'5514888888888'}),
   chaveCapturaWhatsAppMeta(e), 'outro contato gera chave própria');
 assert.notEqual(chaveCapturaWhatsAppMeta({...e,contaExternaId:'999999999999999'}),
   chaveCapturaWhatsAppMeta(e), 'outro número receptor não compartilha chave');
 assert.throws(()=>chaveCapturaWhatsAppMeta({...e,remetenteId:'invalid'}),
   /identidade_whatsapp_invalida/);
 chamadas.length = 0;
 await gravarMensagemMeta(admin(),e);
 await gravarMensagemMeta(admin(),{...e,mensagemId:'wamid.99',texto:'Outra mensagem'});
 assert.equal(chamadas.length,2,'o bridge pode reconciliar cada mensagem');
 assert.equal(chamadas[0].lead.chave,chamadas[1].lead.chave,
   'as duas mensagens apontam para uma única entrada comercial no banco');
});

test('retry da Meta reconcilia a captura sem duplicar conversa', async () => {
  chamadas.length = 0;
  duplicate = true;
  try {
    const evento = extrairMensagensMeta(payload)[0];
    assert.equal(await gravarMensagemMeta(admin(), evento), 'duplicada');
    assert.equal(chamadas.length, 1, 'captura roda novamente de forma idempotente');
  } finally { duplicate = false; }
});

test('captura não cruza funil nem contato sem nome', async () => {
  chamadas.length = 0;
  funilConfig = 99;
  try {
    await gravarMensagemMeta(admin(), extrairMensagensMeta(payload)[0]);
    assert.equal(chamadas.length, 0, 'fonte de outro funil não captura');
  } finally { funilConfig = 13; }

  await gravarMensagemMeta(admin(), {
    ...extrairMensagensMeta(payload)[0], nomeContato: null,
  });
  assert.equal(chamadas.length, 0, 'sem nome não cria lead no CRM');
});
