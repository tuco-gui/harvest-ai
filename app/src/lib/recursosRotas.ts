import type {Efeito} from './recursos.ts';
import {CAMPOS_RECURSO} from './configuracaoRecursos.ts';
export type PoliticaRota={recursos:string[];efeito:Efeito;qualquer?:boolean};
const p=(recursos:string[],efeito:Efeito='ler',qualquer=false):PoliticaRota=>({recursos,efeito,qualquer});
export const tipoCanalRecurso=(t:unknown)=>t==='instagram_dm'||t==='instagram'?'inbox.instagram':t==='facebook_messenger'||t==='facebook'?'inbox.facebook':t==='webchat'?'inbox.webchat':'inbox.whatsapp';
export function rotaSemContrato(path:string){
 return /^\/api\/(?:auth\/esqueci-senha|perfil(?:\/(?:senha|avatar))?|conta-ativa|contas(?:\/[^/]+\/servicos)?|acesso-delegado|sistema\/smtp)$/.test(path)||
  /^\/(?:entrar|esqueci-senha|verificar-codigo|contas(?:\/[^/]+(?:\/servicos)?)?|equipe|sistema|perfil)$/.test(path);
}
/** Toda API do produto tem política, inclusive métodos de escrita e ações tipadas. */
export function politicaDaRota(path:string,method='GET',b:Record<string,unknown>={}):PoliticaRota|null{
 const write=!['GET','HEAD','OPTIONS'].includes(method);const e:Efeito=write?'configurar':'ler';
 if(rotaSemContrato(path)||path.startsWith('/api/webhook/')||path.startsWith('/api/publico/')||path.startsWith('/webchat/'))return null;
 if(path==='/api/cep')return p(['prospeccao.base','crm.base'],e,true);
 if(path==='/api/configuracoes'){
  return p([...new Set(Object.keys(b).map(k=>CAMPOS_RECURSO[k]).filter(Boolean))],e);
 }
 if(path==='/api/configuracoes/ia')return p(['integracoes.ia'],e);
 if(/^\/api\/(?:busca|buscas)$/.test(path))return p(['prospeccao.pesquisas'],e);
 if(path==='/api/enriquecer')return p(['prospeccao.enriquecimento'],e);
 if(path==='/api/validar')return p(['prospeccao.base','inbox.whatsapp'],e);
 if(path==='/api/disparo')return p(['prospeccao.disparos'],'enviar');
 if(path==='/api/testar')return p([b.qual==='ia'?'integracoes.ia':b.qual==='serpapi'?'integracoes.serpapi':b.qual==='whatsapp'?'integracoes.waha':'integracoes.enriquecimento'],'simular');
 if(path.startsWith('/api/campanhas'))return p(['prospeccao.campanhas'],e);
 if(path==='/api/leads/importar')return p(['prospeccao.importacao'],e);
 if(path==='/api/leads/exportar')return p(['prospeccao.exportacao'],e);
 if(path.startsWith('/api/leads/'))return p(['prospeccao.base'],e);
 if(path.startsWith('/api/optouts'))return p(['inbox.atendimento'],e);
 if(path.startsWith('/api/inbox'))return p(['inbox.whatsapp','inbox.atendimento'],e);
 if(path.startsWith('/api/conversas'))return p(['sistema.chamados'],e);
 if(path==='/api/usuarios')return p(['sistema.usuarios'],e);
 if(path.startsWith('/api/sistema/'))return p([],e);
  if(path.startsWith('/api/agentes')){
   if(path.endsWith('/bdr/registros'))return p(['integracoes.superlogica',...(write?['crm.contatos','crm.oportunidades']:[])],e);
  const ks=['agentes.base'];if(b.tipo==='bdr'||path.startsWith('/api/agentes/bdr'))ks.push('agentes.bdr');
  if(b.tipo==='recepcao'||b.tipo==='suporte')ks.push('agentes.atendimento');
  if(b.acao==='processar')return p([...ks,'agentes.responder'],'enviar');
   return p(ks,path.endsWith('/testar')?'simular':b.ativo===true||b.modo==='producao'||b.modo==='homologacao'?'ativar':e);
 }
 if(path.startsWith('/api/waha/'))return p(['inbox.whatsapp','integracoes.waha'],e);
 if(path.startsWith('/api/canais/chatwoot'))return p(['integracoes.chatwoot'],e);
 if(path.startsWith('/api/canais'))return p(['inbox.whatsapp'],e);
 if(path.startsWith('/api/zernio/'))return p(['integracoes.zernio'],e);
 if(path.startsWith('/api/meta/'))return p(['integracoes.meta',...(String(b.plataforma??path).includes('instagram')?['inbox.instagram']:String(b.plataforma??path).includes('facebook')?['inbox.facebook']:[])],e);
 if(path.startsWith('/api/integracoes/meta/'))return p(['integracoes.meta',...(b.tipo?[tipoCanalRecurso(b.tipo)]:[])],e);
 if(path==='/api/integracoes')return write?p([tipoCanalRecurso(b.tipo)],e):p(['inbox.whatsapp','inbox.instagram','inbox.facebook','inbox.webchat'],e,true);
  if(/^\/api\/funis\/[^/]+\/automacoes/.test(path))return p(['crm.automacoes'],['POST','PATCH','PUT'].includes(method)?'ativar':e);
 if(/^\/api\/funis\/[^/]+\/fontes/.test(path))return p(['crm.funis',...(b.tipo?[tipoCanalRecurso(b.tipo)]:[])],e);
 if(path.startsWith('/api/funis'))return p(['crm.funis'],e);
 if(path.startsWith('/api/crm/conversas-externas'))return p(['inbox.atendimento',...(write?['inbox.envio']:[])],write&&method==='POST'?'enviar':e);
 if(path.endsWith('/bdr')&&path.startsWith('/api/crm/atendimentos')&&(b.acao==='liberar'||b.consentimento===true))return p(['inbox.atendimento','agentes.bdr','agentes.responder'],'ativar');
  if(path.startsWith('/api/crm/atendimentos'))return p(['inbox.atendimento',...(path.endsWith('/chatwoot')?['integracoes.chatwoot']:[]),...(path.endsWith('/chatwoot')||method==='PATCH'?['inbox.transferencias']:[])],e);
 if(path.startsWith('/api/crm/cadastros/')){const entidade=path.split('/')[4];return p([entidade==='contatos'?'crm.contatos':entidade==='empresas'?'crm.empresas':'crm.produtos'],e);}
 if(path.startsWith('/api/crm/campos-personalizados'))return p(['crm.campos'],e);
 if(path.startsWith('/api/crm/tarefas')||path.startsWith('/api/crm/agenda'))return p(['crm.tarefas'],e);
 if(path.startsWith('/api/crm/etiquetas'))return p(['crm.base'],e);
 if(path.startsWith('/api/crm/oportunidades'))return p(['crm.oportunidades',...(path.endsWith('/mensagens')&&write?['inbox.envio']:[]),...(path.endsWith('/campos')?['crm.campos']:[])],path.endsWith('/mensagens')&&method==='POST'?'enviar':e);
 if(path.startsWith('/api/analytics'))return p([path.endsWith('/relatorios')?'analytics.relatorios':'analytics.dashboards']);
 if(path==='/')return p(['prospeccao.base']);
 if(path.startsWith('/campanhas'))return p(['prospeccao.campanhas']);
 if(path==='/inbox'||path.startsWith('/crm/atendimentos'))return p(['inbox.atendimento']);
 if(path.startsWith('/crm/cadastros/'))return p([path.includes('contatos')?'crm.contatos':path.includes('empresas')?'crm.empresas':'crm.produtos']);
 if(path.startsWith('/crm/contatos'))return p(['crm.contatos']);
 if(path.startsWith('/crm/campos-personalizados'))return p(['crm.campos']);
 if(path.startsWith('/crm/agenda')||path.startsWith('/crm/tarefas'))return p(['crm.tarefas']);
 if(path.startsWith('/crm'))return p(['crm.base']);
 if(path.startsWith('/funis'))return p(['crm.funis']);
 if(path.startsWith('/agentes'))return p(['agentes.base']);
 if(path.startsWith('/analytics'))return p([path.endsWith('/relatorios')?'analytics.relatorios':'analytics.dashboards']);
 if(path.startsWith('/usuarios'))return p(['sistema.usuarios']);
 if(path.startsWith('/chamados'))return p(['sistema.chamados']);
 if(path.startsWith('/status'))return p(['sistema.status']);
 if(path.startsWith('/configuracoes'))return p([]);
 return null;
}
export function requerInspecaoCorpo(path:string){return /^\/api\/(?:configuracoes|agentes|integracoes|meta|zernio|testar|funis\/[^/]+\/fontes|crm\/atendimentos\/[^/]+\/bdr)/.test(path);}
