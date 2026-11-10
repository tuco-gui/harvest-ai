import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {registerHooks} from 'node:module';
import {servicosDb} from '../helpers/servicos-db.ts';

const conta='11111111-1111-4111-8111-111111111111',state='22222222-2222-4222-8222-222222222222';
const f=servicosDb({contas:[{id:conta,ativo:true,slug:'cliente',modulos_habilitados:['crm','crm_avancado']}],
 conta_recursos:[{conta_id:conta,recurso:'inbox.facebook',liberado:false}],
 crm_meta_oauth_estados:[{id:state,conta_id:conta,perfil_id:'admin',plataforma:'facebook_messenger',estado:'iniciado',expira_em:new Date(Date.now()+60_000).toISOString(),opcoes_cifradas:'cifrado'}]});
(globalThis as any).__metaServicos={db:f.db,chamadas:0,perfil:{id:'admin',papel:'admin',conta_id:conta}};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={redirect:(url,status=307)=>Response.redirect(url,status)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__metaServicos.perfil;export const supabaseAdmin=()=>globalThis.__metaServicos.db;');
 if(specifier==='@/lib/crmMetaGraph')return data('export const trocarCodigoMeta=async()=>{globalThis.__metaServicos.chamadas++;throw Error("não chamar");};export const contaInstagram=trocarCodigoMeta;export const paginasFacebook=trocarCodigoMeta;');
 if(specifier==='@/lib/crmMetaOAuth')return data('export const cifrarMeta=x=>x;export const decifrarMeta=()=>{globalThis.__metaServicos.chamadas++;throw Error("não decifrar");};');
 if(specifier==='@/lib/crmMetaAssinaturas')return data('export const assinarMensagensMessenger=async()=>{globalThis.__metaServicos.chamadas++;};');
 if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice(6)+'.ts',import.meta.url).href,context);
 return next(specifier,context);
}});
const callback=await import('../../app/src/app/api/meta/oauth/callback/[plataforma]/route.ts');
const finalizar=await import('../../app/src/app/api/meta/oauth/finalizar/route.ts');
after(()=>{h.deregister();delete (globalThis as any).__metaServicos;});
test('OAuth iniciado antes da revogação não troca código Meta nem altera a fonte',async()=>{
 const r=await callback.GET(new Request('https://harvest.test/api/meta/oauth/callback/facebook?state='+state+'&code=teste'),{params:Promise.resolve({plataforma:'facebook'})});
 assert.equal(new URL(r.headers.get('location')!).searchParams.get('resultado'),'erro');
 assert.equal((globalThis as any).__metaServicos.chamadas,0);
 assert(!f.consultas.some(x=>x.tabela==='crm_fontes_funil'));
});
test('finalização por formulário valida Messenger antes de decifrar opções ou inscrever Page',async()=>{
 f.tabelas.crm_meta_oauth_estados[0].estado='escolher_pagina';
 const form=new FormData();form.set('state',state);form.set('pagina_id','1234567890');
 const r=await finalizar.POST(new Request('https://harvest.test/api/meta/oauth/finalizar',{method:'POST',body:form}));
 assert.equal(new URL(r.headers.get('location')!).searchParams.get('resultado'),'erro');
 assert.equal((globalThis as any).__metaServicos.chamadas,0);
 assert(!f.consultas.some(x=>x.tabela==='crm_fontes_funil'));
});
