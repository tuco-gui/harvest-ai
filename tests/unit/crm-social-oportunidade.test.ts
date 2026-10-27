import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {mensagensDaConversa} from '../../app/src/lib/crmConversaOportunidade.ts';
import {contatosDasOportunidades} from '../../app/src/lib/crmContatos.ts';

const conversa='d502d1b8-cae2-4712-8b84-d77eb542ee1f';
let conta='workspace-a',acesso=true,erroVinculo=false,statusSocial=200,envios=0,leituras=0;
let vinculo:string|null=conversa;
const fixture={
 perfil:()=>({id:'operador-1',papel:'operador',conta_id:conta}),
 acesso:()=>acesso,
 db:{from(tabela:string){
  assert(['oportunidades','crm_vinculos_conversa_negocio'].includes(tabela),'Não consultar WhatsApp para Instagram sem telefone');
  const eqs:Record<string,unknown>={};
  const q={select(){return q;},eq(k:string,v:unknown){eqs[k]=v;return q;},async maybeSingle(){
   assert.equal(eqs.conta_id,conta);
   if(tabela==='oportunidades')return {data:{id:26,telefone:null,lead_id:null},error:null};
   assert.equal(eqs.oportunidade_id,26);
   return {data:conta==='workspace-a'&&vinculo?{conversa_id:vinculo}:null,error:erroVinculo?{code:'XX000'}:null};
  }};return q;
 }},
 async ler(_req:Request,{params}:{params:Promise<{id:string}>}){
  leituras++;assert.equal((await params).id,conversa);
  if(statusSocial!==200)return Response.json({erro:'Conversa sem acesso.'},{status:statusSocial});
  return Response.json({fonte:{tipo:'instagram_dm',nome:'Instagram'},conversa:{id:conversa},
   mensagens:[{id:'m-1',direcao:'entrada',texto:'Olá do Instagram',criado_em:'2026-10-27T20:00:00Z'}]});
 },
 async enviar(req:Request,{params}:{params:Promise<{id:string}>}){
  envios++;assert.equal((await params).id,conversa);
  const body=await req.json();assert.equal(body.texto,'Resposta sem telefone');assert(body.idempotencia);
  return Response.json({mensagem:{id:'m-2'}},{status:201});
 },
};
(globalThis as any).__socialTeste=fixture;
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)}');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__socialTeste.perfil();export const supabaseAdmin=()=>globalThis.__socialTeste.db;');
 if(specifier==='@/lib/crmControleAcesso')return data('export const podeAcessarOportunidade=async()=>({ok:globalThis.__socialTeste.acesso(),erro:"Sem permissão"});');
 if(specifier==='@/lib/autorizacao')return data('export const perfilTemModulo=async()=>true;');
 if(specifier==='@/app/api/crm/conversas-externas/[id]/route')return data('export const GET=(...a)=>globalThis.__socialTeste.ler(...a);export const POST=(...a)=>globalThis.__socialTeste.enviar(...a);');
 if(specifier==='@/lib/crmConversaOportunidade')return next(new URL('../../app/src/lib/crmConversaOportunidade.ts',import.meta.url).href,context);
 if(specifier.startsWith('@/lib/'))return data('export const normalizarTelefone=()=>null;export const envioPermitidoNoAmbiente=()=>{throw Error("Não enviar WhatsApp")};export const estaEmOptOut=()=>null;export const podeSobrescreverOptOut=()=>null;export const registrarOverride=()=>null;export const carregarCanais=()=>[];export const sessaoWahaDoCanal=()=>null;export const getOrCreateSession=()=>null;export const sendText=()=>null;export const registrarTentativaContato=()=>null;export const crmBackend=()=>null;');
 return next(specifier,context);
}});
try{
 const {GET,POST}=await import('../../app/src/app/api/crm/oportunidades/[id]/mensagens/route.ts');
 const params={params:Promise.resolve({id:'26'})};
 const req=()=>new Request('https://harvest.test/api/crm/oportunidades/26/mensagens');
 const resposta=await GET(req(),params);
 const dados=await resposta.json();
 assert.equal(resposta.status,200);assert.equal(dados.mensagens[0].texto,'Olá do Instagram');
 assert.equal(dados.conversaExterna.id,conversa);assert.equal(dados.conversaExterna.tipo,'instagram_dm');
 const enviada=await POST(new Request(req(),{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({texto:'Resposta sem telefone',idempotencia:'envio-unico'})}),params);
 assert.equal(enviada.status,201);assert.equal(envios,1);
 statusSocial=403;assert.equal((await GET(req(),params)).status,403);statusSocial=200;
 acesso=false;const anteriores=leituras;assert.equal((await GET(req(),params)).status,403);assert.equal(leituras,anteriores);acesso=true;
 erroVinculo=true;assert.equal((await GET(req(),params)).status,503);erroVinculo=false;
 conta='workspace-b';
 assert.equal((await POST(new Request(req(),{method:'POST',body:'{}'}),params)).status,400);
 assert.equal(envios,1);assert.equal(leituras,anteriores);
 const msg=mensagensDaConversa([{id:'x',direcao:'saida',texto:'Teste',criado_em:'2026-10-27T20:00:00Z',status_envio:'falhou'}]);
 assert.equal(msg[0].erro,'Envio não confirmado.');
 const ops=[1,2].map(id=>({id,contato_id:7,contato:'Pessoa social',empresa:'',telefone:null,email:null,tags:[],valor:0,atualizado_em:'2026-10-27',estagio:'novo'}));
 const pessoas=contatosDasOportunidades(ops as any);
 assert.equal(pessoas.length,1);assert.equal(pessoas[0].cadastroId,7);assert.equal(pessoas[0].negocios.length,2);
 console.log('Instagram no negócio: histórico explícito, resposta sem telefone, mesmas permissões, tenant e contato estável OK');
}finally{hook.deregister();delete (globalThis as any).__socialTeste;}
