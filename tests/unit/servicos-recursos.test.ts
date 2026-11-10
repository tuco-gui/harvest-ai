import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readdirSync} from 'node:fs';
import {RECURSOS,recursoLiberado,efeitoPermitido,validarConcessoes,modulosCompativeis,aplicarConcessoes,type ContextoRecursos} from '../../app/src/lib/recursos.ts';
import {politicaDaRota,rotaSemContrato} from '../../app/src/lib/recursosRotas.ts';
import {filtrarConfiguracao} from '../../app/src/lib/configuracaoRecursos.ts';
const base=(modulos:string[]=[]):ContextoRecursos=>({modulos,concessoes:[],versao:0,slug:'cliente'});
const pacote=(...keys:string[])=>{
 const c=base();c.concessoes=Object.keys(RECURSOS).map(recurso=>({recurso,liberado:false}));
 const grant=(k:string)=>{for(const d of RECURSOS[k].depende??[])grant(d);c.concessoes.find(x=>x.recurso===k)!.liberado=true;};keys.forEach(grant);return c;
};
test('catálogo é hierárquico, conhecido e sem ciclos',()=>{
 function visitar(k:string,anteriores:string[]=[]){assert(!anteriores.includes(k),k);assert(Object.hasOwn(RECURSOS,k));for(const d of RECURSOS[k].depende??[])visitar(d,[...anteriores,k]);}
 Object.keys(RECURSOS).forEach(k=>visitar(k));assert(!recursoLiberado(base(),'__proto__'));assert(!efeitoPermitido(base(),['root'],'ler',true));
});
test('sem migração/concessões os módulos e acessos legados são preservados',()=>{
 for(const ms of [[],['whatsapp','ia','usuarios','chamados','status'],['crm'],['crm','crm_avancado','agentes','ia']]){
  assert.deepEqual(modulosCompativeis(base(ms)),ms,'não sintetizar flags legadas a partir de acesso herdado');
  assert.equal(recursoLiberado(base(ms),'crm.base'),ms.includes('crm'));
  assert.equal(recursoLiberado(base(ms),'agentes.bdr'),ms.includes('agentes'));
  assert(recursoLiberado(base(ms),'prospeccao.pesquisas'));
 }
});
test('combinações independentes não liberam outros produtos ou canais',()=>{
 const somenteProspect=pacote('prospeccao.pesquisas','prospeccao.enriquecimento','prospeccao.campanhas');
 assert(recursoLiberado(somenteProspect,'prospeccao.pesquisas'));assert(!recursoLiberado(somenteProspect,'crm.base'));assert(!recursoLiberado(somenteProspect,'inbox.envio'));
 const crmZap=pacote('crm.oportunidades','inbox.whatsapp','inbox.envio');assert(recursoLiberado(crmZap,'crm.base'));assert(!recursoLiberado(crmZap,'inbox.instagram'));assert(!recursoLiberado(crmZap,'agentes.bdr'));
 const crmInstagramIa=pacote('crm.base','inbox.instagram','agentes.bdr','agentes.instagram');assert(recursoLiberado(crmInstagramIa,'agentes.instagram'));assert(!recursoLiberado(crmInstagramIa,'inbox.facebook'));assert(!recursoLiberado(crmInstagramIa,'inbox.whatsapp'));
});
test('dependências explícitas e versão comercial não equivalem a ativação',()=>{
 assert(validarConcessoes(pacote(),[{recurso:'agentes.whatsapp',liberado:true}]).some(x=>x.includes('depende')));
 const c=pacote('crm.campos');assert(validarConcessoes(c,[{recurso:'crm.base',liberado:false}]).length);
 c.concessoes.find(x=>x.recurso==='crm.base')!.liberado=false;assert(!recursoLiberado(c,'crm.campos'));
 const z=base(['crm','agentes','crm_avancado']);assert.equal(validarConcessoes(z,[{recurso:'agentes.responder',liberado:true}]).length,0);
 assert(!('modo'in z));assert(!('aprovado_em'in z));
});
test('homologação temporária expira e não pode enviar/ativar nem por dependência',()=>{
 const now=Date.now(),c=pacote('agentes.whatsapp','agentes.responder');c.slug='figueira-marketing';
 c.concessoes.find(x=>x.recurso==='agentes.base')!.expira_em=new Date(now+60_000).toISOString();
 assert(efeitoPermitido(c,['agentes.whatsapp'],'configurar',false,now));assert(!efeitoPermitido(c,['agentes.whatsapp'],'enviar',false,now));
 assert(!efeitoPermitido(c,['agentes.responder'],'ativar',false,now));assert(!recursoLiberado(c,'agentes.whatsapp',now+120_000));
 assert(validarConcessoes(base(),[{recurso:'crm.base',liberado:true,expira_em:new Date(now+60_000).toISOString()}],now).length);
});
test('delegação permite suporte de recurso não contratado, sem mensagens/ativação',()=>{
 const c=pacote();assert(efeitoPermitido(c,['crm.base'],'configurar',true));
 assert(!efeitoPermitido(c,['inbox.envio'],'enviar',true));assert(!efeitoPermitido(c,['agentes.bdr'],'ativar',true));
 assert.equal(politicaDaRota('/api/agentes/bdr','POST',{acao:'processar'})?.efeito,'enviar');
  assert.equal(politicaDaRota('/api/crm/atendimentos/5514999999999/bdr','PATCH',{acao:'liberar'})?.efeito,'ativar');
  for(const method of ['POST','PATCH','PUT']){
   const p=politicaDaRota('/api/funis/13/automacoes/2',method,{ativo:true})!;
   assert.equal(p.efeito,'ativar');assert(!efeitoPermitido(c,p.recursos,p.efeito,true));
  }
});
test('trial não apaga bloqueio permanente, mesmo se o módulo legado estava habilitado',()=>{
 const now=Date.now();let c=base(['crm','crm_avancado','agentes']);c.slug='figueira-marketing';c.concessoes=[{recurso:'inbox.instagram',liberado:false}];
 c=aplicarConcessoes(c,[{recurso:'inbox.instagram',liberado:true,expira_em:new Date(now+60_000).toISOString()}]);
 assert.equal(c.concessoes.length,2);assert(recursoLiberado(c,'inbox.instagram',now));assert(!recursoLiberado(c,'inbox.instagram',now+120_000));
 c=aplicarConcessoes(c,[{recurso:'inbox.instagram',liberado:false}]);assert.equal(c.concessoes.length,1);assert(!recursoLiberado(c,'inbox.instagram',now));
});
test('todas as APIs atuais têm política ou fronteira explícita de autenticação própria',()=>{
 const root=new URL('../../app/src/app/api/',import.meta.url);
 function walk(url:URL,prefix=''){for(const e of readdirSync(url,{withFileTypes:true})){const name=prefix+'/'+e.name;if(e.isDirectory())walk(new URL(e.name+'/',url),name);else if(e.name==='route.ts'){
   const path='/api'+prefix.replace(/\[[^\]]+\]/g,'11111111-1111-4111-8111-111111111111');
   for(const method of ['GET','POST','PATCH','DELETE'])assert(politicaDaRota(path,method)||rotaSemContrato(path)||/^\/api\/(webhook|publico)\//.test(path),path+' '+method);
  }}}
 walk(root);
});
test('salvar uma conexão não altera campos de integrações não contratadas',()=>{
 const payload={serpapi_key:'fake',whatsapp_provider:'waha',evolution_url:'',ia_modelo:'',modo:'ia'};
 assert.deepEqual(filtrarConfiguracao(payload,['integracoes.serpapi']),{serpapi_key:'fake'});
 assert.deepEqual(politicaDaRota('/api/configuracoes','POST',{evolution_url:''})?.recursos,['integracoes.waha']);
});
