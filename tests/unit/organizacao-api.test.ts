import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {registerHooks} from 'node:module';
import {servicosDb} from '../helpers/servicos-db.ts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
let papel='admin';
const cfg={conta_id:a,canal_id:24,funil_id:13,codigo_anuncio:'CA0653_MMOL',modo:'simulacao',base_aprovada:'Ficha anterior',crm_habilitado:true,responsavel_crm_confirmado:true,aprovado_em:null,atualizado_em:'2026-11-01'};
const f=servicosDb({contas:[{id:a,ativo:true,slug:'realize',modulos_habilitados:['crm','agentes','crm_avancado']}],conta_recursos:[],
 bdr_config:[cfg],whatsapp_canais:[{id:24,conta_id:a,ativo:true},{id:99,conta_id:b,ativo:true}],funis:[{id:13,conta_id:a,canal_padrao_id:24,ativo:true}],
 superlogica_entradas:[{conta_id:a,chave:'lp:P1'},{conta_id:a,chave:'chat:P1'},{conta_id:b,chave:'lp:P2'}],
 superlogica_registros:[{id:'registro',conta_id:a,status_sincronizacao:'cadastrado',id_superlogica:'ID-EXTERNO'}],crm_contatos:[],oportunidades:[],prospecta_leads:[],bdr_sessoes:[]});
(globalThis as any).__organizacaoApi={db:f.db,perfil:()=>({id:'admin',papel,conta_id:a})};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__organizacaoApi.perfil();export const supabaseAdmin=()=>globalThis.__organizacaoApi.db;');
 if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice(6)+'.ts',import.meta.url).href,context);
 return next(specifier,context);
}});
const ficha=await import('../../app/src/app/api/agentes/bdr/route.ts');
const diagnostico=await import('../../app/src/app/api/agentes/bdr/registros/route.ts');
const agentes=await import('../../app/src/app/api/agentes/route.ts');
const {configuracaoPadrao}=await import('../../app/src/lib/agenteModelos.ts');
const req=(patch:unknown,method='PATCH')=>new Request('https://harvest.test',{method,body:JSON.stringify(patch)});
after(()=>{h.deregister();delete (globalThis as any).__organizacaoApi;});
test('admin cliente edita ficha sem alterar modo, CRM habilitado ou responsável; payload alheio é ignorado',async()=>{
 const r=await ficha.PATCH(req({canal_id:24,funil_id:13,codigo_anuncio:'CA0653_MMOL',base_aprovada:'Ficha revisada e condições comerciais aprovadas',conta_id:b,modo:'producao',crm_habilitado:false}));
 assert.equal(r.status,200);assert.equal(cfg.base_aprovada,'Ficha revisada e condições comerciais aprovadas');assert.equal(cfg.modo,'simulacao');assert.equal(cfg.crm_habilitado,true);assert.equal(cfg.responsavel_crm_confirmado,true);assert.equal(cfg.aprovado_em,null);
 assert.equal((await ficha.POST(req({modo:'homologacao'},'POST'))).status,409);
});
test('canal estrangeiro, operador e serviço revogado são recusados no próprio handler',async()=>{
 assert.equal((await ficha.PATCH(req({canal_id:99,funil_id:13,codigo_anuncio:'X',base_aprovada:'Ficha'}))).status,403);
 papel='operador';assert.equal((await ficha.PATCH(req({}))).status,403);papel='admin';
 f.tabelas.conta_recursos.push({conta_id:a,recurso:'agentes.bdr',liberado:false});assert.equal((await ficha.PATCH(req({}))).status,403);f.tabelas.conta_recursos.length=0;
});
test('diagnóstico distingue protocolos, identidades confirmadas e zero contatos/oportunidades reais',async()=>{
 const r=await diagnostico.GET();assert.equal(r.status,200);const d=await r.json();
 assert.equal(d.indicadores.capturas_recebidas,2);assert.equal(d.indicadores.registros_integracao,1);assert.equal(d.indicadores.integracao_cadastrado,1);
 assert.equal(d.indicadores.contatos_cadastrados,0);assert.equal(d.indicadores.oportunidades_pipeline,0);assert.equal(d.registros.length,1);
});
test('instanciar modelo não cria agentes institucionais; conhecimento e vínculos ficam no tenant',async()=>{
 const config=configuracaoPadrao('bdr');config.modelo='bdr_imobiliario';config.conhecimento='Ficha aprovada somente da empresa A';config.canais=[24];config.funis=[13];
 const payload={tipo:'bdr',nome:'BDR da empresa A',instrucao:'Atenda usando apenas a base aprovada desta empresa e encaminhe dúvidas ao humano.',ativo:false,configuracao:config};
 const r=await agentes.PATCH(req(payload));assert.equal(r.status,200);
 assert.equal(f.tabelas.agentes_workspace.length,1);assert.equal(f.tabelas.agentes_workspace[0].conta_id,a);assert.equal(f.tabelas.agentes_workspace[0].configuracao.modelo,'bdr_imobiliario');assert.equal(f.tabelas.agentes_workspace[0].ativo,false);
 assert.equal((await agentes.PATCH(req({...payload,configuracao:{...config,canais:[99]}}))).status,403);
 assert.equal((await agentes.PATCH(req({...payload,configuracao:{...config,autonomia:'autonomo'}}))).status,400);
});
