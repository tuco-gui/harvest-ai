import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {registerHooks} from 'node:module';
import {servicosDb} from '../helpers/servicos-db.ts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';let papel='admin';
const f=servicosDb({contas:[{id:a,ativo:true,slug:'cliente-a',modulos_habilitados:['crm','crm_avancado']}],conta_recursos:[],
 crm_vinculos:[{conta_id:a,chatwoot_account_id:11}],chatwoot_inboxes:[],servicos_auditoria:[]});
(globalThis as any).__chatwootOrganizacao={db:f.db,perfil:()=>({id:'admin',papel,conta_id:a})};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__chatwootOrganizacao.perfil();export const supabaseAdmin=()=>globalThis.__chatwootOrganizacao.db;');
 if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice(6)+'.ts',import.meta.url).href,context);
 return next(specifier,context);
}});
const route=await import('../../app/src/app/api/canais/chatwoot/route.ts');
const original=globalThis.fetch;const urls:string[]=[];
process.env.CHATWOOT_API_URL='https://chatwoot.teste.invalid';process.env.CHATWOOT_API_TOKEN='token-falso';
globalThis.fetch=async url=>{urls.push(String(url));return Response.json({payload:[{id:51,name:'Inbox própria',channel_type:'Channel::Instagram'}]});};
const req=(b:unknown)=>new Request('https://harvest.test',{method:'POST',body:JSON.stringify(b)});
after(()=>{h.deregister();globalThis.fetch=original;delete (globalThis as any).__chatwootOrganizacao;delete process.env.CHATWOOT_API_URL;delete process.env.CHATWOOT_API_TOKEN;});
test('admin cliente vê e vincula somente inbox da conta previamente autorizada',async()=>{
 assert.equal((await route.GET()).status,200);assert(urls.every(u=>u.includes('/accounts/11/')));
 assert.equal((await route.POST(req({acao:'vincular',chatwootInboxId:51,tipoCanal:'whatsapp',conta_id:b,chatwootAccountId:999}))).status,200);
 const v=f.tabelas.chatwoot_inboxes[0];assert.equal(v.conta_id,a);assert.equal(v.chatwoot_account_id,11);assert.equal(v.tipo_canal,'instagram');
 assert.equal((await route.POST(req({acao:'vincular',chatwootInboxId:999,tipoCanal:'instagram'}))).status,409);
 assert.equal((await route.POST(req({acao:'configurar',chatwootAccountId:999}))).status,403);
});
test('revogação e operador negam integração; desvincular preserva o registro e histórico',async()=>{
 assert.equal((await route.POST(req({acao:'desvincular',chatwootInboxId:51}))).status,200);assert.equal(f.tabelas.chatwoot_inboxes.length,1);assert.equal(f.tabelas.chatwoot_inboxes[0].ativo,false);
 papel='operador';assert.equal((await route.GET()).status,403);papel='admin';
 f.tabelas.conta_recursos.push({conta_id:a,recurso:'integracoes.chatwoot',liberado:false});
 const n=urls.length;assert.equal((await route.POST(req({acao:'vincular',chatwootInboxId:51,tipoCanal:'instagram'}))).status,403);assert.equal(urls.length,n);
});
