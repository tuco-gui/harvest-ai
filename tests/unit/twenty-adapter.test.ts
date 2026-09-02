/**
 * Testes do adapter Twenty (TwentyCrmBackend em lib/twenty) — HTTP mockado.
 * Roda sem workspace real: node --experimental-strip-types tests/unit/twenty-adapter.test.ts
 *
 * lib/twenty.ts importa ./supabase/server, que por sua vez importa
 * next/headers — módulo que só resolve dentro do runtime Next (mesma
 * limitação documentada em tests/unit/crm.test.ts, que por isso replica a
 * interface CrmBackend em vez de importar o arquivo real). Este teste segue
 * a mesma convenção: replica aqui APENAS a lógica de request/HTTP de
 * TwentyCrmBackend (não o SupabaseCrmBackend, que já é coberto por
 * crm.test.ts), espelhando fielmente app/src/lib/twenty.ts. Qualquer mudança
 * na lógica de request/criar/atualizar/buscarOwners/jaExistePorLead em
 * twenty.ts deve ser replicada aqui.
 *
 * Nenhum token real: TWENTY_API_URL/TWENTY_API_KEY são fakes só para montar
 * a URL/headers da chamada, interceptada antes de qualquer rede real.
 */
const TWENTY_TIMEOUT_MS = 10_000;
const BASE_URL = 'https://twenty.fake.test';
const API_KEY = 'fake-key-nao-real';

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TWENTY_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`Twenty: timeout (${TWENTY_TIMEOUT_MS}ms) em ${path}.`);
    throw new Error(`Twenty: falha de rede em ${path}: ${err?.message ?? err}`);
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 401 || res.status === 403) throw new Error(`Twenty: não autorizado (${res.status}) — verifique TWENTY_API_KEY.`);
  if (res.status === 429) throw new Error('Twenty: rate limit excedido (429).');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Twenty: erro HTTP ${res.status} em ${path}.`);
  if (res.status === 204) return {};
  try {
    return await res.json();
  } catch {
    throw new Error(`Twenty: resposta inválida (não-JSON) em ${path}.`);
  }
}

function filterQuery(campo: string, valor: string | number): string {
  const v = typeof valor === 'number' ? valor : `"${valor.replace(/"/g, '\\"')}"`;
  return `?filter=${encodeURIComponent(`${campo}[eq]:${v}`)}`;
}

async function listar(): Promise<any[]> {
  const dados: any[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 20; pagina++) {
    const qs = cursor ? `?first=60&after=${encodeURIComponent(cursor)}` : '?first=60';
    const json = await request(`/opportunities${qs}`);
    const lote = json?.data?.opportunities ?? [];
    dados.push(...lote);
    const pageInfo = json?.pageInfo ?? json?.data?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) break;
    cursor = pageInfo.endCursor;
  }
  return dados;
}

async function buscar(id: number): Promise<any | null> {
  const json = await request(`/opportunities/${id}`);
  return json?.data?.opportunity ?? null;
}

async function buscarOwners(): Promise<{ id: string; nome: string }[]> {
  const json = await request('/workspaceMembers?first=60');
  const membros = json?.data?.workspaceMembers ?? [];
  return membros.map((m: any) => ({
    id: m.id,
    nome: [m.name?.firstName, m.name?.lastName].filter(Boolean).join(' ') || m.userEmail || m.id,
  }));
}

async function jaExistePorLead(leadId: number): Promise<boolean> {
  const json = await request(`/opportunities${filterQuery('harvestLeadId', leadId)}`);
  const lista = json?.data?.opportunities ?? [];
  return lista.length > 0;
}

async function criar(input: { empresa: string; harvestLeadId?: number | null }): Promise<any> {
  const payload = { name: input.empresa, harvestLeadId: input.harvestLeadId ?? null };
  const json = await request('/opportunities', { method: 'POST', body: JSON.stringify(payload) });
  const criada = json?.data?.createOpportunity;
  if (!criada) throw new Error('Twenty: não consegui criar a oportunidade (resposta sem createOpportunity).');
  return criada;
}

async function atualizar(id: number, patch: { stage?: string }): Promise<any | null> {
  const json = await request(`/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  if (json === null) return null;
  return json?.data?.updateOpportunity ?? null;
}

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
    return { status: resp.status, ok: resp.status >= 200 && resp.status < 300, json: async () => resp.body ?? {} } as Response;
  };
  return chamadas;
}

async function main() {
  console.log('== twenty: listar (uma página) ==');
  {
    mockFetch({ '/opportunities?first=60': { status: 200, body: { data: { opportunities: [{ id: '1', name: 'A' }] } } } });
    const lista = await listar();
    assert(lista.length === 1 && lista[0].id === '1', 'retorna oportunidades da primeira página');
  }

  console.log('== twenty: listar com paginação (cursor) ==');
  {
    mockFetch({
      '/opportunities?first=60': { status: 200, body: { data: { opportunities: [{ id: '1' }] }, pageInfo: { hasNextPage: true, endCursor: 'abc' } } },
      '/opportunities?first=60&after=abc': { status: 200, body: { data: { opportunities: [{ id: '2' }] }, pageInfo: { hasNextPage: false } } },
    });
    const lista = await listar();
    assert(lista.length === 2 && lista[1].id === '2', 'segue o cursor até hasNextPage=false');
  }

  console.log('== twenty: buscar 404 ==');
  {
    mockFetch({});
    const op = await buscar(999);
    assert(op === null, '404 vira null');
  }

  console.log('== twenty: criar ==');
  {
    const chamadas = mockFetch({
      '/opportunities': { status: 200, body: { data: { createOpportunity: { id: '10', name: 'Nova' } } } },
    });
    const op = await criar({ empresa: 'Nova', harvestLeadId: 42 });
    assert(op.id === '10', 'cria oportunidade e retorna o registro criado');
    assert(chamadas[0].init.method === 'POST', 'usa POST para criar');
    assert(JSON.parse(chamadas[0].init.body as string).harvestLeadId === 42, 'envia harvestLeadId no payload');
  }

  console.log('== twenty: criar sem createOpportunity na resposta -> erro ==');
  {
    mockFetch({ '/opportunities': { status: 200, body: { data: {} } } });
    try {
      await criar({ empresa: 'X' });
      assert(false, 'deveria ter lançado erro');
    } catch (e: any) {
      assert(String(e.message).includes('não consegui criar'), 'erro claro quando resposta não traz o registro criado');
    }
  }

  console.log('== twenty: atualizar (stage) ==');
  {
    const chamadas = mockFetch({
      '/opportunities/10': { status: 200, body: { data: { updateOpportunity: { id: '10', stage: 'proposta' } } } },
    });
    const op = await atualizar(10, { stage: 'proposta' });
    assert(op.stage === 'proposta', 'atualiza o estágio');
    assert(chamadas[0].init.method === 'PATCH', 'usa PATCH para atualizar');
  }

  console.log('== twenty: buscarOwners (workspace members) ==');
  {
    mockFetch({
      '/workspaceMembers?first=60': { status: 200, body: { data: { workspaceMembers: [{ id: 'u1', name: { firstName: 'Ana', lastName: 'Silva' } }, { id: 'u2', userEmail: 'b@x.com' }] } } },
    });
    const owners = await buscarOwners();
    assert(owners.length === 2, 'retorna todos os workspace members');
    assert(owners[0].nome === 'Ana Silva', 'monta nome a partir de firstName+lastName');
    assert(owners[1].nome === 'b@x.com', 'usa email como fallback quando não há nome');
  }

  console.log('== twenty: jaExistePorLead — true/false ==');
  {
    mockFetch({ '/opportunities?filter=harvestLeadId%5Beq%5D%3A42': { status: 200, body: { data: { opportunities: [{ id: '1' }] } } } });
    assert((await jaExistePorLead(42)) === true, 'detecta duplicata por harvestLeadId, não por telefone');
  }
  {
    mockFetch({ '/opportunities?filter=harvestLeadId%5Beq%5D%3A99': { status: 200, body: { data: { opportunities: [] } } } });
    assert((await jaExistePorLead(99)) === false, 'retorna false quando não há oportunidade com esse lead_id');
  }

  console.log('== twenty: 401 vira erro de autorização ==');
  {
    mockFetch({ '/opportunities?first=60': { status: 401, body: {} } });
    try {
      await listar();
      assert(false, 'deveria ter lançado erro em 401');
    } catch (e: any) {
      assert(String(e.message).toLowerCase().includes('autorizado'), 'erro 401 reportado como falta de autorização');
    }
  }

  console.log('== twenty: 429 vira erro de rate limit ==');
  {
    mockFetch({ '/opportunities?first=60': { status: 429, body: {} } });
    try {
      await listar();
      assert(false, 'deveria ter lançado erro em 429');
    } catch (e: any) {
      assert(String(e.message).toLowerCase().includes('rate limit'), 'erro 429 reportado como rate limit');
    }
  }

  console.log('== twenty: 5xx vira erro genérico com status ==');
  {
    mockFetch({ '/opportunities?first=60': { status: 503, body: {} } });
    try {
      await listar();
      assert(false, 'deveria ter lançado erro em 503');
    } catch (e: any) {
      assert(String(e.message).includes('503'), 'erro 503 propagado com o status');
    }
  }

  console.log('== twenty: resposta não-JSON vira erro claro ==');
  {
    (global as any).fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => { throw new Error('unexpected token'); },
    });
    try {
      await listar();
      assert(false, 'deveria ter lançado erro de JSON inválido');
    } catch (e: any) {
      assert(String(e.message).toLowerCase().includes('inválida'), 'JSON inválido vira erro claro, não exceção crua');
    }
  }

  console.log(`\n${passou} ok, ${falhou} falhas`);
  if (falhou > 0) process.exit(1);
}

main();
