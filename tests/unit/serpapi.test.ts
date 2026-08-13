/**
 * Testes unitários da busca nativa (lib/serpapi.ts) — remoção da ponte n8n.
 * Roda sem banco real (admin é um stub) e sem rede real (fetch é mockado):
 *   node --experimental-strip-types tests/unit/serpapi.test.ts
 */
import { chamarSerpApi } from '../../app/src/lib/serpapi.ts';

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log('  ok  -', msg);
  else { falhas++; console.error('  FALHOU -', msg); }
}

// admin stub: nunca fala com banco de verdade, só finge inserir o log.
const adminStub: any = {
  from: () => ({ insert: async () => ({ error: null }) }),
};

function mockFetch(impl: (url: string) => Promise<{ ok: boolean; status?: number; json: () => Promise<any> }>) {
  (globalThis as any).fetch = impl;
}

async function rodar() {
  // 1) credencial ausente -> nem tenta rede
  {
    let chamou = false;
    mockFetch(async () => { chamou = true; return { ok: true, json: async () => ({}) }; });
    const r = await chamarSerpApi(adminStub, 'conta-1', null, { q: 'padaria' }, { modo: 'busca' });
    ok(!r.ok && r.codigo === 'CREDENCIAL_AUSENTE', 'sem chave -> CREDENCIAL_AUSENTE');
    ok(!chamou, 'sem chave -> não chama fetch (nem tenta rede)');
  }

  // 2) chave nunca aparece na URL nem em params passados por quem chama
  {
    let urlChamada = '';
    mockFetch(async (url: string) => { urlChamada = url; return { ok: true, json: async () => ({ local_results: [] }) }; });
    await chamarSerpApi(adminStub, 'conta-1', 'CHAVE_SECRETA_123', { q: 'padaria' }, { modo: 'busca' });
    ok(urlChamada.includes('serpapi.com/search.json'), 'chama direto serpapi.com/search.json (sem n8n)');
    ok(urlChamada.includes('api_key=CHAVE_SECRETA_123'), 'a chave só entra na URL dentro de chamarSerpApi');
  }

  // 3) credencial inválida
  {
    mockFetch(async () => ({ ok: true, json: async () => ({ error: 'Invalid API key.' }) }));
    const r = await chamarSerpApi(adminStub, 'conta-1', 'ruim', { q: 'x' }, { modo: 'busca' });
    ok(!r.ok && r.codigo === 'CREDENCIAL_INVALIDA', 'SerpAPI "Invalid API key" -> CREDENCIAL_INVALIDA');
  }

  // 4) créditos esgotados
  {
    mockFetch(async () => ({ ok: true, json: async () => ({ error: 'Your account has run out of searches.' }) }));
    const r = await chamarSerpApi(adminStub, 'conta-1', 'ok', { q: 'x' }, { modo: 'busca' });
    ok(!r.ok && r.codigo === 'CREDITOS_ESGOTADOS', 'SerpAPI "run out of searches" -> CREDITOS_ESGOTADOS');
  }

  // 5) erro genérico da SerpAPI (não é chave nem crédito)
  {
    mockFetch(async () => ({ ok: true, json: async () => ({ error: 'Something else broke.' }) }));
    const r = await chamarSerpApi(adminStub, 'conta-1', 'ok', { q: 'x' }, { modo: 'busca' });
    ok(!r.ok && r.codigo === 'ERRO_SERPAPI', 'erro não classificado -> ERRO_SERPAPI');
  }

  // 6) HTTP não-ok (ex.: 500 da SerpAPI)
  {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const r = await chamarSerpApi(adminStub, 'conta-1', 'ok', { q: 'x' }, { modo: 'busca' });
    ok(!r.ok && r.status === 500 && r.codigo === 'ERRO_SERPAPI', 'HTTP 500 -> ERRO_SERPAPI, status preservado');
  }

  // 7) timeout / falha de rede -> FALHA_INTERNA
  {
    mockFetch(async () => { throw new Error('boom'); });
    const r = await chamarSerpApi(adminStub, 'conta-1', 'ok', { q: 'x' }, { modo: 'busca' });
    ok(!r.ok && r.codigo === 'FALHA_INTERNA', 'exceção de rede -> FALHA_INTERNA');
  }

  // 8) resposta sem local_results (sem erro) -> ok:true, sem inventar dado
  {
    mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    const r = await chamarSerpApi(adminStub, 'conta-1', 'ok', { q: 'x' }, { modo: 'busca' });
    ok(r.ok && r.dados.local_results === undefined, 'sem local_results -> ok:true, dados crus (rota decide achados=[])');
  }

  // 9) sucesso normal com resultados
  {
    mockFetch(async () => ({ ok: true, json: async () => ({ local_results: [{ title: 'Padaria X' }] }) }));
    const r = await chamarSerpApi(adminStub, 'conta-1', 'ok', { q: 'x' }, { modo: 'busca' });
    ok(r.ok && Array.isArray(r.dados.local_results) && r.dados.local_results.length === 1, 'sucesso -> local_results propagado');
  }

  console.log(falhas ? `\n${falhas} falha(s).` : '\nTodos os testes passaram.');
  process.exit(falhas ? 1 : 0);
}

rodar();
