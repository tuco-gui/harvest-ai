/** Contrato do produto Harvest. Não altera ativação de canais/agentes. */
type Definicao = {nome:string;grupo:string;depende?:string[];legado:string[];ponte?:string[]};
export const RECURSOS:Record<string,Definicao> = {
 'prospeccao.base':{nome:'Base de prospecção',grupo:'Prospecção',legado:['*']},
 'prospeccao.pesquisas':{nome:'Pesquisas',grupo:'Prospecção',depende:['prospeccao.base'],legado:['*']},
 'prospeccao.enriquecimento':{nome:'Enriquecimento',grupo:'Prospecção',depende:['prospeccao.base'],legado:['*']},
 'prospeccao.campanhas':{nome:'Campanhas',grupo:'Prospecção',depende:['prospeccao.base'],legado:['*']},
 'prospeccao.importacao':{nome:'Importação de leads',grupo:'Prospecção',depende:['prospeccao.base'],legado:['*']},
 'prospeccao.exportacao':{nome:'Exportação de leads',grupo:'Prospecção',depende:['prospeccao.base'],legado:['*']},
 'prospeccao.disparos':{nome:'Abordagem por WhatsApp',grupo:'Prospecção',depende:['prospeccao.campanhas','inbox.whatsapp','inbox.envio'],legado:['*']},
 'crm.base':{nome:'CRM',grupo:'CRM',legado:['crm'],ponte:['crm']},
 'crm.contatos':{nome:'Contatos',grupo:'CRM',depende:['crm.base'],legado:['crm','crm_avancado'],ponte:['crm','crm_avancado']},
 'crm.empresas':{nome:'Empresas',grupo:'CRM',depende:['crm.base'],legado:['crm','crm_avancado'],ponte:['crm','crm_avancado']},
 'crm.produtos':{nome:'Catálogo de produtos',grupo:'CRM',depende:['crm.base'],legado:['crm','crm_avancado'],ponte:['crm','crm_avancado']},
 'crm.oportunidades':{nome:'Oportunidades',grupo:'CRM',depende:['crm.base'],legado:['crm'],ponte:['crm']},
 'crm.funis':{nome:'Funis',grupo:'CRM',depende:['crm.base'],legado:['crm'],ponte:['crm']},
 'crm.campos':{nome:'Campos personalizados',grupo:'CRM',depende:['crm.base'],legado:['crm','crm_avancado'],ponte:['crm','crm_avancado']},
 'crm.tarefas':{nome:'Agenda e tarefas',grupo:'CRM',depende:['crm.base'],legado:['crm','crm_avancado'],ponte:['crm','crm_avancado']},
 'crm.automacoes':{nome:'Automações comerciais',grupo:'CRM',depende:['crm.funis'],legado:['crm'],ponte:['crm']},
 'inbox.base':{nome:'Inbox',grupo:'Inbox',legado:['*']},
 'inbox.atendimento':{nome:'Atendimento e histórico',grupo:'Inbox',depende:['inbox.base'],legado:['*'],ponte:['crm','crm_avancado']},
 'inbox.whatsapp':{nome:'WhatsApp',grupo:'Inbox',depende:['inbox.base'],legado:['*'],ponte:['whatsapp']},
 'inbox.instagram':{nome:'Instagram Direct',grupo:'Inbox',depende:['inbox.atendimento'],legado:['crm_avancado'],ponte:['crm','crm_avancado']},
 'inbox.facebook':{nome:'Facebook Messenger',grupo:'Inbox',depende:['inbox.atendimento'],legado:['crm_avancado'],ponte:['crm','crm_avancado']},
 'inbox.webchat':{nome:'Webchat',grupo:'Inbox',depende:['inbox.atendimento'],legado:['crm_avancado'],ponte:['crm','crm_avancado']},
 'inbox.anexos':{nome:'Anexos e mídia',grupo:'Inbox',depende:['inbox.atendimento'],legado:['*']},
 'inbox.transferencias':{nome:'Transferências humanas',grupo:'Inbox',depende:['inbox.atendimento'],legado:['*']},
 'inbox.envio':{nome:'Envio manual de respostas',grupo:'Inbox',depende:['inbox.atendimento'],legado:['*']},
 'agentes.base':{nome:'Agentes de IA',grupo:'Agentes de IA',legado:['agentes'],ponte:['agentes']},
 'agentes.atendimento':{nome:'Agente de atendimento',grupo:'Agentes de IA',depende:['agentes.base'],legado:['agentes'],ponte:['agentes']},
 'agentes.bdr':{nome:'BDR e qualificação',grupo:'Agentes de IA',depende:['agentes.base'],legado:['agentes'],ponte:['agentes']},
 'agentes.automacoes':{nome:'Orquestração de agentes',grupo:'Agentes de IA',depende:['agentes.base'],legado:['agentes'],ponte:['agentes']},
 'agentes.whatsapp':{nome:'IA autorizada no WhatsApp',grupo:'Agentes de IA',depende:['agentes.base','inbox.whatsapp'],legado:['agentes'],ponte:['agentes','ia']},
 'agentes.instagram':{nome:'IA autorizada no Instagram',grupo:'Agentes de IA',depende:['agentes.base','inbox.instagram'],legado:['agentes','ia','crm_avancado'],ponte:['agentes','ia','crm_avancado']},
 'agentes.facebook':{nome:'IA autorizada no Messenger',grupo:'Agentes de IA',depende:['agentes.base','inbox.facebook'],legado:['agentes','ia','crm_avancado'],ponte:['agentes','ia','crm_avancado']},
 'agentes.responder':{nome:'Permissão de resposta automática (exige homologação operacional)',grupo:'Agentes de IA',depende:['agentes.base','inbox.envio'],legado:['agentes'],ponte:['agentes','ia']},
 'analytics.relatorios':{nome:'Relatórios e indicadores',grupo:'Analytics',legado:['analytics']},
 'analytics.dashboards':{nome:'Dashboards',grupo:'Analytics',depende:['analytics.relatorios'],legado:['analytics']},
 'integracoes.serpapi':{nome:'SerpAPI',grupo:'Integrações externas',depende:['prospeccao.pesquisas'],legado:['*']},
 'integracoes.enriquecimento':{nome:'Provedores de enriquecimento',grupo:'Integrações externas',depende:['prospeccao.enriquecimento'],legado:['*']},
 'integracoes.ia':{nome:'Conexão de IA',grupo:'Integrações externas',legado:['*'],ponte:['ia']},
 'integracoes.waha':{nome:'WAHA / Evolution',grupo:'Integrações externas',depende:['inbox.whatsapp'],legado:['*'],ponte:['whatsapp']},
 'integracoes.meta':{nome:'Meta OAuth',grupo:'Integrações externas',legado:['crm_avancado'],ponte:['crm_avancado']},
 'integracoes.zernio':{nome:'Zernio',grupo:'Integrações externas',legado:['crm_avancado'],ponte:['crm_avancado']},
 'integracoes.chatwoot':{nome:'Chatwoot',grupo:'Integrações externas',depende:['inbox.base'],legado:['*']},
 'integracoes.twenty':{nome:'Twenty CRM',grupo:'Integrações externas',depende:['crm.base'],legado:['crm'],ponte:['crm']},
 'integracoes.superlogica':{nome:'Superlógica / n8n',grupo:'Integrações externas',depende:['crm.base'],legado:['crm','agentes','crm_avancado'],ponte:['crm','agentes','crm_avancado']},
 'sistema.usuarios':{nome:'Equipe e permissões de usuários',grupo:'Administração',legado:['*'],ponte:['usuarios']},
 'sistema.chamados':{nome:'Chamados',grupo:'Administração',legado:['*'],ponte:['chamados']},
 'sistema.status':{nome:'Saúde operacional',grupo:'Administração',legado:['*'],ponte:['status']},
};
export type Concessao={recurso:string;liberado:boolean;expira_em?:string|null};
export type ContextoRecursos={modulos:string[]|null;concessoes:Concessao[];versao:number;slug:string};
export type Efeito='ler'|'configurar'|'enviar'|'ativar'|'simular';
export const MODULOS_LEGADO_PADRAO=['whatsapp','ia','usuarios','chamados','status'];
export function recursoConhecido(k:unknown):k is string{return typeof k==='string'&&Object.hasOwn(RECURSOS,k);}
export function concessaoVigente(c:Concessao,agora=Date.now()){return !c.expira_em||Date.parse(c.expira_em)>agora;}
function concessaoAtual(c:ContextoRecursos,k:string,agora:number){
 return c.concessoes.find(x=>x.recurso===k&&!!x.expira_em&&concessaoVigente(x,agora))??c.concessoes.find(x=>x.recurso===k&&!x.expira_em);
}
/** Trial é camada separada: sua expiração restaura o override permanente anterior. */
export function aplicarConcessoes(c:ContextoRecursos,mudancas:Concessao[]):ContextoRecursos{
 let concessoes=[...c.concessoes];
 for(const x of mudancas){concessoes=concessoes.filter(old=>old.recurso!==x.recurso||(!!x.expira_em&&!old.expira_em));concessoes.push(x);}
 return {...c,concessoes};
}
/** Ausência de override herda exatamente o acesso histórico. Dependências não retiram direitos legados. */
export function recursoLiberado(c:ContextoRecursos,k:string,agora=Date.now(),visitados=new Set<string>()):boolean{
 if(!recursoConhecido(k)||visitados.has(k))return false;
 const atual=concessaoAtual(c,k,agora);
 const legado=RECURSOS[k].legado;
 if(atual?!atual.liberado:!(legado.includes('*')||legado.every(m=>(c.modulos??MODULOS_LEGADO_PADRAO).includes(m))))return false;
 const prox=new Set(visitados).add(k);
 return (RECURSOS[k].depende??[]).every(dep=>recursoLiberado(c,dep,agora,prox));
}
export function origemPermissao(c:ContextoRecursos,k:string,agora=Date.now()){
 const x=concessaoAtual(c,k,agora);
 return x?(x.expira_em?'temporario':'explicito'):'legado';
}
export function modulosCompativeis(c:ContextoRecursos):string[]{
 const ms=new Set(c.modulos??MODULOS_LEGADO_PADRAO);
 for(const [k,d]of Object.entries(RECURSOS))if(c.concessoes.some(x=>x.recurso===k&&x.liberado&&concessaoVigente(x))&&recursoLiberado(c,k))for(const m of d.ponte??[])ms.add(m);
 return [...ms];
}
export function validarConcessoes(c:ContextoRecursos,mudancas:Concessao[],agora=Date.now()):string[]{
 const erros:string[]=[];const keys=new Set<string>();
 for(const x of mudancas){if(!recursoConhecido(x.recurso)||typeof x.liberado!=='boolean'||keys.has(x.recurso)||(x.expira_em!=null&&typeof x.expira_em!=='string'))erros.push('Recurso inválido ou repetido.');keys.add(x.recurso);
  if(x.expira_em&&(!x.liberado||c.slug!=='figueira-marketing'||!Number.isFinite(Date.parse(x.expira_em))||Date.parse(x.expira_em)<=agora||Date.parse(x.expira_em)>agora+24*3600_000))erros.push('Concessão temporária exige Figueira Marketing e prazo de até 24 horas.');}
 if(erros.length)return erros;
 const next=aplicarConcessoes(c,mudancas);
 for(const x of mudancas)if(x.liberado)for(const dep of RECURSOS[x.recurso].depende??[])if(!recursoLiberado(next,dep,agora))erros.push(`${RECURSOS[x.recurso].nome} depende de ${RECURSOS[dep].nome}.`);
 // Não desativar silenciosamente filhos explicitamente contratados.
 for(const x of next.concessoes)if(x.liberado&&concessaoVigente(x,agora))for(const dep of RECURSOS[x.recurso]?.depende??[])if(!recursoLiberado(next,dep,agora))erros.push(`Revise também ${RECURSOS[x.recurso].nome}: dependência desabilitada.`);
 return [...new Set(erros)];
}
export function efeitoPermitido(c:ContextoRecursos,ks:string[],efeito:Efeito,delegado=false,agora=Date.now()):boolean{
 if(ks.some(k=>!recursoConhecido(k)))return false;
 const temporario=(k:string):boolean=>origemPermissao(c,k,agora)==='temporario'||(RECURSOS[k]?.depende??[]).some(temporario);
 if((delegado||ks.some(temporario))&&['enviar','ativar'].includes(efeito))return false;
 return delegado||ks.every(k=>recursoLiberado(c,k,agora));
}
