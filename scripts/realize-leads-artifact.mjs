import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {iniciarConsultaLeads,consumirPaginaLeads} from '../app/src/lib/superlogicaLeads.mjs';

export const WORKFLOW_LEADS='tDi9BFIJgcfudUkh';
/** Patches sobre o workflow existente. Não substitui credenciais ou ramo de diagnóstico. */
export function prepararLeadsPaginacao(original){
  if(original.id!==WORKFLOW_LEADS)throw Error('workflow_leads_incorreto');
  const w=structuredClone(original);w.active=false;delete w.activeVersion;
  const validar=w.nodes.find(n=>n.id==='f602425c-49c9-4e21-bb1e-2aa74fcd7308');
  const get=w.nodes.find(n=>n.id==='2fa596d9-6b0e-4188-a90e-bc96dbd0b221');
  const resultado=w.nodes.find(n=>n.id==='bb268309-43ec-42b6-9f87-6a1470e364a3');
  if(!validar||!get||!resultado||get.type!=='n8n-nodes-base.httpRequest'||
    get.parameters.url!=='https://8cjlgzfyye.execute-api.sa-east-1.amazonaws.com/production/leads'||
    get.credentials?.httpHeaderAuth?.id!=='C0adNbEFeHge9Tjp')throw Error('workflow_leads_divergiu');
  validar.parameters={jsCode:`${iniciarConsultaLeads.toString()}\nreturn [{json:iniciarConsultaLeads($input.first().json)}];`};
  get.parameters={...get.parameters,method:'GET',sendQuery:true,queryParameters:{parameters:[
    {name:'page',value:'={{ $json.page }}'},{name:'perPage',value:'={{ $json.perPage }}'}]},
    options:{...get.parameters.options,timeout:20000,response:{response:{fullResponse:true,neverError:true}}}};
  get.retryOnFail=false;get.onError='continueRegularOutput';
  resultado.parameters={jsCode:`${consumirPaginaLeads.toString()}\nreturn [{json:consumirPaginaLeads($('Preparar página LEADS').item.json,$input.first().json)}];`};
  const novos=[
    {id:'realize-leads-pagina',name:'Preparar página LEADS',type:'n8n-nodes-base.code',typeVersion:2,position:[500,0],parameters:{jsCode:'return $input.all();'}},
    {id:'realize-leads-continuar',name:'Há próxima página LEADS?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[1100,0],parameters:{conditions:{options:{typeValidation:'strict',version:2},conditions:[{id:'continuar',leftValue:'={{ $json.continuar === true }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}},
    {id:'realize-leads-resultado',name:'Resultado LEADS completo ou falha',type:'n8n-nodes-base.code',typeVersion:2,position:[1300,100],parameters:{jsCode:'return $input.all();'}},
  ];
  for(const n of novos){const i=w.nodes.findIndex(x=>x.id===n.id);if(i<0)w.nodes.push(n);else w.nodes[i]=n;}
  const edge=node=>({node,type:'main',index:0});
  w.connections[validar.name]={main:[[edge('Preparar página LEADS')]]};
  w.connections['Preparar página LEADS']={main:[[edge(get.name)]]};
  w.connections[get.name]={main:[[edge(resultado.name)]]};
  w.connections[resultado.name]={main:[[edge('Há próxima página LEADS?')]]};
  w.connections['Há próxima página LEADS?']={main:[[edge('Preparar página LEADS')],[edge('Resultado LEADS completo ou falha')]]};
  w.settings={...w.settings,saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false};
  return w;
}
// Export da parte de integração observada; a transformação operacional preserva o original inteiro.
export function criarConsultaLeads(){return prepararLeadsPaginacao({id:WORKFLOW_LEADS,name:'REALIZE - API LEADS | Consulta paginada',nodes:[
  {id:'3fac7d35-067c-4c7f-9b86-1609e85ee98a',name:'INTEGRAÇÃO - não executar manualmente',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.1,position:[0,0],parameters:{inputSource:'passthrough'}},
  {id:'f602425c-49c9-4e21-bb1e-2aa74fcd7308',name:'Validar parâmetros de integração (somente bridge)',type:'n8n-nodes-base.code',typeVersion:2,position:[250,0],parameters:{}},
  {id:'2fa596d9-6b0e-4188-a90e-bc96dbd0b221',name:'GET API LEADS Superlogica',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[700,0],parameters:{url:'https://8cjlgzfyye.execute-api.sa-east-1.amazonaws.com/production/leads',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth'},credentials:{httpHeaderAuth:{id:'C0adNbEFeHge9Tjp',name:'REALIZE - Superlogica LEADS - Authorization'}}},
  {id:'bb268309-43ec-42b6-9f87-6a1470e364a3',name:'Resposta LEADS - sem afirmar cadastro',type:'n8n-nodes-base.code',typeVersion:2,position:[900,0],parameters:{}}
],connections:{'INTEGRAÇÃO - não executar manualmente':{main:[[{node:'Validar parâmetros de integração (somente bridge)',type:'main',index:0}]]}},settings:{executionOrder:'v1'}});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const expected=criarConsultaLeads();
  if(process.argv.includes('--print'))console.log(JSON.stringify(expected));
  else if(!isDeepStrictEqual(JSON.parse(readFileSync(new URL('../n8n/realize-leads-paginacao.json',import.meta.url),'utf8')),expected))throw Error('leads_artifact_desatualizado');
}
