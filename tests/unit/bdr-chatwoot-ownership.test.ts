import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const etapas:string[]=[];
const fixture={
  db:{from(tabela:string){const q:any={select(){return q;},eq(){return q;},limit(){return q;},maybeSingle(){return q;},then(resolve:any){
    const rows:any={chatwoot_inboxes:[{conta_id:'workspace-a',whatsapp_canal_id:1}],crm_vinculos:{ativo:true},whatsapp_canais:{id:1},funis:[{id:2}]};
    assert(tabela in rows);resolve({data:rows[tabela],error:null});}};return q;}},
  assumir:async()=>{etapas.push('pausa_persistida_antes_da_sessao');},
  receber:async(_db:unknown,e:any,conta:string,canal:number,funil:number)=>{
    assert.equal(etapas[0],'pausa_persistida_antes_da_sessao');assert.equal(e.mensagem,'Quero informações');
    assert.equal(conta,'workspace-a');assert.equal(canal,1);assert.equal(funil,2);etapas.push('inbound_registrado');return {ok:true,eventoId:1};},
};
(globalThis as any).__bdrCw=fixture;
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
  if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
  if(specifier==='@/lib/supabase/server')return data('export const supabaseAdmin=()=>globalThis.__bdrCw.db;');
  if(specifier==='@/lib/bdr')return data('export const assumirBDR=(...args)=>globalThis.__bdrCw.assumir(...args);');
  if(specifier==='@/lib/inbound')return data('export const processarEventoInbound=(...args)=>globalThis.__bdrCw.receber(...args);');
  if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice(6)+'.ts',import.meta.url).href,context);
  return next(specifier,context);
}});
const tokenAnterior=process.env.CHATWOOT_WEBHOOK_TOKEN;process.env.CHATWOOT_WEBHOOK_TOKEN='token-ficticio';
try{
  const {POST}=await import('../../app/src/app/api/webhook/chatwoot/route.ts');
  const body={event:'message_created',id:12,account:{id:8},inbox:{id:3},message_type:'incoming',content:'Quero informações',
    conversation:{id:7,inbox_id:3,meta:{assignee:{id:4},sender:{type:'contact',phone_number:'+5514999999999'}}}};
  const r=await POST(new Request('https://harvest.test/api/webhook/chatwoot',{method:'POST',headers:{'Content-Type':'application/json','x-webhook-token':'token-ficticio'},body:JSON.stringify(body)}));
  assert.equal(r.status,200);assert.deepEqual(etapas,['pausa_persistida_antes_da_sessao','inbound_registrado']);
  console.log('Chatwoot: ownership pré-sessão persiste e incoming continua na Inbox.');
}finally{h.deregister();delete (globalThis as any).__bdrCw;
  if(tokenAnterior===undefined)delete process.env.CHATWOOT_WEBHOOK_TOKEN;else process.env.CHATWOOT_WEBHOOK_TOKEN=tokenAnterior;}
