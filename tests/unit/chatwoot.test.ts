/**
 * Testes do adapter Chatwoot (lib/chatwoot) — HTTP mockado via global.fetch.
 * Roda sem instância real: node --experimental-strip-types tests/unit/chatwoot.test.ts
 *
 * Nenhum token real: CHATWOOT_API_URL/CHATWOOT_API_TOKEN são valores fake
 * definidos abaixo só para o adapter montar a URL/headers da requisição —
 * o fetch é interceptado antes de qualquer rede real.
 */
process.env.CHATWOOT_API_URL = 'https://chatwoot.fake.test';
process.env.CHATWOOT_API_TOKEN = 'fake-token-nao-real';

import {
  listarInboxes,
  listarConversas,
  buscarConversa,
  listarMensagens,
  encontrarOuCriarContato,
  enviarMensagem,
  listarAgentes,
  listarTimes,
  alterarStatusConversa,
  atribuirAgente,
  atribuirTime,
} from '../../app/src/lib/chatwoot.ts';

let passou = 0;
let falhou = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passou++; console.log('  ok  -', msg); }
  else { falhou++; console.log('  FALHOU -', msg); }
}

type Chamada = { url: string; init: RequestInit };
function mockFetch(respostas: Record<string, { status: number; body?: any }>) {
  const chamadas: Chamada[] = [];
  (global as any).fetch = async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const path = new URL(url).pathname + new URL(url).search;
    const chaves = Object.keys(respostas).sort((a, b) => b.length - a.length);
    const key = chaves.find((k) => path === k) ?? chaves.find((k) => path.startsWith(k));
    const resp = key ? respostas[key] : { status: 404 };
    return {
      status: resp.status,
      ok: resp.status >= 200 && resp.status < 300,
      json: async () => resp.body ?? {},
    } as Response;
  };
  return chamadas;
}

async function main() {
  console.log('== chatwoot: listarInboxes ==');
  {
    mockFetch({ '/api/v1/accounts/1/inboxes': { status: 200, body: { payload: [{ id: 4, name: 'WhatsApp' }] } } });
    const inboxes = await listarInboxes(1);
    assert(inboxes.length === 1 && inboxes[0].id === 4, 'retorna inboxes da conta');
  }

  console.log('== chatwoot: listarConversas com filtro ==');
  {
    const chamadas = mockFetch({
      '/api/v1/accounts/1/conversations': { status: 200, body: { data: { payload: [{ id: 10, inbox_id: 4, status: 'open' }] } } },
    });
    const conversas = await listarConversas(1, { inboxId: 4, status: 'open' });
    assert(conversas.length === 1 && conversas[0].id === 10, 'retorna conversas filtradas');
    assert(chamadas[0].url.includes('inbox_id=4') && chamadas[0].url.includes('status=open'), 'aplica query params de filtro');
  }

  console.log('== chatwoot: buscarConversa 404 ==');
  {
    mockFetch({});
    const conversa = await buscarConversa(1, 999);
    assert(conversa === null, '404 vira null, não erro');
  }

  console.log('== chatwoot: listarMensagens ==');
  {
    mockFetch({
      '/api/v1/accounts/1/conversations/10/messages': { status: 200, body: { payload: [{ id: 1, content: 'oi', message_type: 0, created_at: 123 }] } },
    });
    const msgs = await listarMensagens(1, 10);
    assert(msgs.length === 1 && msgs[0].content === 'oi', 'retorna mensagens da conversa');
  }

  console.log('== chatwoot: encontrarOuCriarContato — encontra existente ==');
  {
    mockFetch({
      '/api/v1/accounts/1/contacts/search': { status: 200, body: { payload: [{ id: 5, name: 'Ana', phone_number: '+5511999999999' }] } },
    });
    const contato = await encontrarOuCriarContato(1, { nome: 'Ana', telefone: '+5511999999999' });
    assert(contato.id === 5, 'reaproveita contato existente por telefone, não cria duplicado');
  }

  console.log('== chatwoot: encontrarOuCriarContato — cria novo ==');
  {
    const chamadas = mockFetch({
      '/api/v1/accounts/1/contacts/search': { status: 200, body: { payload: [] } },
      '/api/v1/accounts/1/contacts': { status: 200, body: { payload: { contact: { id: 9, name: 'Bruno' } } } },
    });
    const contato = await encontrarOuCriarContato(1, { nome: 'Bruno', telefone: '+5511988888888' });
    assert(contato.id === 9, 'cria contato quando busca não encontra nada');
    const post = chamadas.find((c) => c.init.method === 'POST');
    assert(!!post && JSON.parse(post.init.body as string).name === 'Bruno', 'envia nome no payload de criação');
  }

  console.log('== chatwoot: enviarMensagem (mock, sem envio real) ==');
  {
    const chamadas = mockFetch({
      '/api/v1/accounts/1/conversations/10/messages': { status: 200, body: { id: 55, content: 'oi', message_type: 1, created_at: 1 } },
    });
    const msg = await enviarMensagem(1, 10, 'oi');
    assert(msg.id === 55, 'retorna a mensagem criada (mock)');
    assert(chamadas[0].init.method === 'POST', 'usa POST para enviar mensagem');
  }

  console.log('== chatwoot: listarAgentes / listarTimes ==');
  {
    mockFetch({
      '/api/v1/accounts/1/agents': { status: 200, body: [{ id: 1, name: 'Carla' }] },
      '/api/v1/accounts/1/teams': { status: 200, body: [{ id: 1, name: 'Vendas' }] },
    });
    const agentes = await listarAgentes(1);
    const times = await listarTimes(1);
    assert(agentes.length === 1 && agentes[0].name === 'Carla', 'lista agentes');
    assert(times.length === 1 && times[0].name === 'Vendas', 'lista times');
  }

  console.log('== chatwoot: alterarStatusConversa / atribuirAgente / atribuirTime ==');
  {
    const chamadas = mockFetch({
      '/api/v1/accounts/1/conversations/10/toggle_status': { status: 200, body: {} },
      '/api/v1/accounts/1/conversations/10/assignments': { status: 200, body: {} },
    });
    await alterarStatusConversa(1, 10, 'resolved');
    await atribuirAgente(1, 10, 7);
    await atribuirTime(1, 10, 3);
    assert(chamadas.length === 3, 'as três chamadas de mutação são feitas');
    assert(JSON.parse(chamadas[0].init.body as string).status === 'resolved', 'toggle_status envia o status novo');
    assert(JSON.parse(chamadas[1].init.body as string).assignee_id === 7, 'assignments envia assignee_id');
    assert(JSON.parse(chamadas[2].init.body as string).team_id === 3, 'assignments envia team_id');
  }

  console.log('== chatwoot: erro HTTP (5xx) vira exceção ==');
  {
    mockFetch({ '/api/v1/accounts/1/inboxes': { status: 500, body: {} } });
    try {
      await listarInboxes(1);
      assert(false, 'deveria ter lançado erro em 500');
    } catch (e: any) {
      assert(String(e.message).includes('500'), 'erro 500 é propagado com o status');
    }
  }

  console.log('== chatwoot: 401 vira erro de autorização ==');
  {
    mockFetch({ '/api/v1/accounts/1/inboxes': { status: 401, body: {} } });
    try {
      await listarInboxes(1);
      assert(false, 'deveria ter lançado erro em 401');
    } catch (e: any) {
      assert(String(e.message).toLowerCase().includes('autorizado'), 'erro 401 é reportado como falta de autorização');
    }
  }

  console.log(`\n${passou} ok, ${falhou} falhas`);
  if (falhou > 0) process.exit(1);
}

main();
