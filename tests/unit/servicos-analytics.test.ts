import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import {servicosDb} from '../helpers/servicos-db.ts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';let conta=a,papel='admin';
const f=servicosDb({contas:[a,b].map(id=>({id,ativo:true,slug:id,modulos_habilitados:['crm'],recursos_versao:0})),
 conta_recursos:[a,b].flatMap(conta_id=>[{conta_id,recurso:'analytics.relatorios',liberado:true},{conta_id,recurso:'analytics.dashboards',liberado:true}]),
 prospecta_leads:[{id:1,conta_id:a},{id:2,conta_id:a},{id:3,conta_id:b}],oportunidades:[],inbound_eventos:[],prospecta_campanhas:[]});
(globalThis as any).__analyticsServicos={db:f.db,perfil:()=>({id:'admin',papel,conta_id:conta})};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__analyticsServicos.perfil();export const supabaseAdmin=()=>globalThis.__analyticsServicos.db;');
 if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice(6)+'.ts',import.meta.url).href,context);
 return next(specifier,context);
}});
const {GET}=await import('../../app/src/app/api/analytics/route.ts');
test('indicadores usam somente a workspace da sessão, nunca a query do cliente',async()=>{
 const x=await GET(new Request('https://harvest.test/api/analytics?conta_id='+b));assert.equal(x.status,200);assert.equal((await x.json()).indicadores.leads,2);
 conta=b;assert.equal((await(await GET(new Request('https://harvest.test/api/analytics'))).json()).indicadores.leads,1);conta=a;
});
test('operador não recebe métricas administrativas e serviço revogado não é consultado',async()=>{
 papel='operador';assert.equal((await GET(new Request('https://harvest.test/api/analytics'))).status,403);papel='admin';
 f.tabelas.conta_recursos.push({conta_id:a,recurso:'prospeccao.base',liberado:false});
 const before=f.consultas.filter(x=>x.tabela==='prospecta_leads').length;
 assert.equal((await(await GET(new Request('https://harvest.test/api/analytics'))).json()).indicadores.leads,null);
 assert.equal(f.consultas.filter(x=>x.tabela==='prospecta_leads').length,before);
});
test('relatórios não liberam dashboard automaticamente',async()=>{
 f.tabelas.conta_recursos.find(x=>x.conta_id===a&&x.recurso==='analytics.dashboards')!.liberado=false;
 assert.equal((await GET(new Request('https://harvest.test/api/analytics'))).status,403);
 assert.equal((await GET(new Request('https://harvest.test/api/analytics/relatorios'))).status,200);
 h.deregister();delete (globalThis as any).__analyticsServicos;
});
