import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
let papel='operador',conta='workspace-a',ativo=true,erro=false,semSessao=false;
const consultas:{tabela:string;filtros:Record<string,unknown>}[]=[];
const db={from(tabela:string){
 const filtros:Record<string,unknown>={};consultas.push({tabela,filtros});
 const q={select(){return q;},eq(k:string,v:unknown){filtros[k]=v;return q;},
  gte(k:string,v:unknown){filtros['de:'+k]=v;return q;},lt(k:string,v:unknown){filtros['ate:'+k]=v;return q;},
  in(k:string,v:unknown){filtros[k]=v;return q;},order(){return q;},limit(){return q;},
  then(resolve:(v:unknown)=>unknown){
   assert.equal(filtros.conta_id,conta);
   if(tabela==='oportunidades'){
    assert.equal(filtros.id,26,'O filtro do negócio deve chegar ao banco antes do limite');
    if(papel==='operador')assert.equal(filtros.owner_id,'user-1');
    return Promise.resolve(resolve({data:[{id:26,contato:'Pessoa',empresa:'',owner_id:'user-1'}],error:null}));
   }
   if(filtros['de:vence_em']){
    assert.equal(filtros['oportunidade.conta_id'],conta);
    if(papel==='operador')assert.equal(filtros['oportunidade.owner_id'],'user-1');
    else assert.equal(filtros['oportunidade.owner_id'],undefined);
    assert.equal(filtros['de:vence_em'],'2026-09-27T03:00:00.000Z');
    assert.equal(filtros['ate:vence_em'],'2026-11-08T03:00:00.000Z');
   }else assert.deepEqual(filtros.oportunidade_id,[26]);
   return Promise.resolve(resolve({data:erro?null:[{id:1,oportunidade_id:26,titulo:'Ligar',vence_em:'2026-10-27T15:00:00Z'}],error:erro?{code:'XX000'}:null,count:1}));
  },
 };return q;
}};
(globalThis as any).__agendaTeste={db,perfil:()=>semSessao?null:{id:'user-1',conta_id:conta,papel},ativo:()=>ativo};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__agendaTeste.perfil();export const supabaseAdmin=()=>globalThis.__agendaTeste.db;');
 if(specifier==='@/lib/autorizacao')return data('export const perfilTemModulo=async()=>globalThis.__agendaTeste.ativo();');
 if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice(6)+'.ts',import.meta.url).href,context);
 return next(specifier,context);
}});
try{
 const {GET}=await import('../../app/src/app/api/crm/agenda/route.ts');
 const {GET:tarefas}=await import('../../app/src/app/api/crm/tarefas/route.ts');
 const req=(q='mes=2026-10')=>new Request('https://harvest.test/api/crm/agenda?'+q);
 const r=await GET(req());assert.equal(r.status,200);assert.equal((await r.json()).eventos.length,1);
 papel='admin';assert.equal((await GET(req())).status,200);
 conta='workspace-b';papel='operador';assert.equal((await GET(req())).status,200);
 const t=await tarefas(new Request('https://harvest.test/api/crm/tarefas?oportunidade_id=26'));
 assert.equal(t.status,200);assert.equal((await t.json()).tarefas[0].empresa,'Pessoa');
 assert.equal((await tarefas(new Request('https://harvest.test/api/crm/tarefas?oportunidade_id=-1'))).status,400);
 const antes=consultas.length;assert.equal((await GET(req('mes=2026-13'))).status,400);assert.equal(consultas.length,antes);
 erro=true;assert.equal((await GET(req())).status,503);erro=false;
 ativo=false;assert.equal((await GET(req())).status,403);ativo=true;
 semSessao=true;assert.equal((await GET(req())).status,401);
 console.log('Agenda/tarefas: handler real, fuso, responsáveis, dois tenants, filtro do negócio e falhas OK');
}finally{h.deregister();delete (globalThis as any).__agendaTeste;}
