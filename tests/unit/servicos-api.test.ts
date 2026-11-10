import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import {servicosDb} from '../helpers/servicos-db.ts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
let papel='super_admin',rpcError:any=null;const chamadas:any[]=[];
const f=servicosDb({contas:[{id:a,slug:'cliente-a',ativo:true,recursos_versao:0,modulos_habilitados:['crm','crm_avancado','agentes','ia']},{id:b,slug:'cliente-b',ativo:true,recursos_versao:0,modulos_habilitados:[]}],
 conta_recursos:[],servicos_auditoria:[],bdr_config:[{conta_id:a,modo:'simulacao',aprovado_em:null,aprovado_por:null,crm_habilitado:true}],
 agentes_workspace:[{conta_id:a,tipo:'bdr',ativo:false}],whatsapp_canais:[{conta_id:a,status:'desconectado',ativo:true,numero:null}],conta_credenciais:[{conta_id:a,ia_key:'fake-nao-retornar'}],crm_fontes_funil:[]});
f.db.rpc=async(nome:string,args:any)=>{chamadas.push({nome,args});return rpcError?{data:null,error:rpcError}:{data:1,error:null};};
(globalThis as any).__servicosApi={db:f.db,perfil:()=>({id:'root',papel,conta_id:a})};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const hooks=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__servicosApi.perfil();export const supabaseAdmin=()=>globalThis.__servicosApi.db;');
 if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice(6)+'.ts',import.meta.url).href,context);
 return next(specifier,context);
}});
const {GET,PATCH}=await import('../../app/src/app/api/contas/[id]/servicos/route.ts');
const params={params:Promise.resolve({id:a})};
const req=(body:unknown)=>new Request('https://harvest.test/api/contas/'+a+'/servicos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('API serviços exige super admin antes de ler/gravar dados',async()=>{
 papel='admin';const consultas=f.consultas.length;const r=await GET(new Request('https://harvest.test'),params);assert.equal(r.status,403);assert.equal(f.consultas.length,consultas);
 assert.equal((await PATCH(req({}),params)).status,403);assert.equal(chamadas.length,0);papel='super_admin';
});
test('API serviços não retorna segredos e distingue licença de aprovação operacional',async()=>{
 const r=await GET(new Request('https://harvest.test'),params),body=await r.json();assert.equal(r.status,200);
 assert(!JSON.stringify(body).includes('fake-nao-retornar'));assert.equal(body.recursos.find((x:any)=>x.chave==='agentes.base').estado.ia_autorizada,false);
 assert.equal(body.recursos.find((x:any)=>x.chave==='inbox.whatsapp').estado.conectado,false);
});
test('concessão usa ator da sessão/tenant da URL e não ativa BDR/canal',async()=>{
 const before=JSON.stringify({bdr:f.tabelas.bdr_config,canais:f.tabelas.whatsapp_canais,agentes:f.tabelas.agentes_workspace});
 const r=await PATCH(req({versao:0,motivo:'Contrato comercial aprovado',ator_id:'cliente-falso',conta_id:b,mudancas:[{recurso:'agentes.responder',liberado:true,modo:'producao'}]}),params);
 assert.equal(r.status,200);const last=chamadas.at(-1);assert.equal(last.args.p_ator,'root');assert.equal(last.args.p_conta,a);
 assert(!('modo'in last.args.p_mudancas[0]));assert.equal(JSON.stringify({bdr:f.tabelas.bdr_config,canais:f.tabelas.whatsapp_canais,agentes:f.tabelas.agentes_workspace}),before);
});
test('API recusa recurso desconhecido, dependência ausente, trial em cliente e conflito de versão',async()=>{
 const base={versao:0,motivo:'Revisar serviços contratados'};
 assert.equal((await PATCH(req({...base,mudancas:[{recurso:'root',liberado:true}]}),params)).status,400);
 assert.equal((await PATCH(req({...base,mudancas:[{recurso:'crm.base',liberado:true,expira_em:new Date(Date.now()+60_000).toISOString()}]}),params)).status,400);
 rpcError={code:'40001'};assert.equal((await PATCH(req({...base,mudancas:[{recurso:'crm.base',liberado:true}]}),params)).status,409);rpcError=null;
});
test('encerrar fixture',()=>{hooks.deregister();delete (globalThis as any).__servicosApi;});
