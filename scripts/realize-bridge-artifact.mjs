import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {telefoneCRM,adaptarLeadParaChild,validarEscritorUnico,analisarConsultaLeads} from '../app/src/lib/superlogicaContrato.mjs';

export function criarBridgeRealize(){
  const nodes=[],connections={};
  const node=(name,type,parameters,extra={})=>{nodes.push({id:'realize-'+nodes.length,name,type:'n8n-nodes-base.'+type,
    typeVersion:type==='code'?2:type==='if'?2.2:type==='executeWorkflow'?1.3:type==='httpRequest'?4.2:1,
    position:[nodes.length*220,0],parameters,...extra});return name;};
  const link=(from,to,index=0)=>{const c=connections[from]??={main:[]};c.main[index]??=[];c.main[index].push({node:to,type:'main',index:0});};
  const code=(name,jsCode)=>node(name,'code',{jsCode});
  const begin=node('Harvest autenticado','webhook',{httpMethod:'POST',path:'realize-harvest-superlogica',authentication:'headerAuth',responseMode:'responseNode',options:{}},{typeVersion:2});
  const validar=code('Validar tenant e contrato',`const p=$json.body;\nif(!p||!($env.REALIZE_SUPERLOGICA_WORKSPACES||'').split(',').map(x=>x.trim()).includes(p.tenant_id)||p.codigo_anuncio!=='CA0653_MMOL'||!/^[0-9a-f-]{36}$/i.test(p.idempotency_key||'')||!['cadastrar','consultar'].includes(p.acao))throw Error('contrato_recusado');\nreturn [{json:p}];`);
  link(begin,validar);let previous=validar;
  for(const [label,id]of [['Ler LP publicada','CZ3gAStDKp75yJtm'],['Ler minichat publicado','pqVU7Tceb9Xv8dHs'],['Ler child publicado','njZxxrVJrrl6l96i']]){
    const n=node(label,'n8n',{resource:'workflow',operation:'get',workflowId:{__rl:true,mode:'id',value:id}});
    link(previous,n);previous=n;
  }
  const guard=code('Verificar escritor exclusivo',`${validarEscritorUnico.toString()}\nvalidarEscritorUnico([$('Ler LP publicada').first().json,$('Ler minichat publicado').first().json,$('Ler child publicado').first().json]);\nreturn [{json:$('Validar tenant e contrato').first().json}];`);link(previous,guard);
  const condition=(name,left)=>node(name,'if',{conditions:{options:{typeValidation:'strict',version:2},conditions:[{id:name,leftValue:left,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
  const apto=condition('LEADS configurado',"={{ Boolean($env.REALIZE_SUPERLOGICA_LEADS_WORKFLOW_ID) }}");link(guard,apto);
  const consulta=node('Consultar API LEADS antes da escrita','executeWorkflow',{source:'database',workflowId:{__rl:true,mode:'id',value:'={{ $env.REALIZE_SUPERLOGICA_LEADS_WORKFLOW_ID }}'},mode:'once',options:{waitForSubWorkflow:true}}, {retryOnFail:false,onError:'continueRegularOutput'});link(apto,consulta);
  const resultado=code('Conferir identidade e imóvel',`${telefoneCRM.toString()}\n${analisarConsultaLeads.toString()}\nconst p=$('Verificar escritor exclusivo').first().json;\nconst r=analisarConsultaLeads(p,$json);\nreturn [{json:r.status==='ausente'?(p.acao==='cadastrar'?{...p,autorizado_post:true}:{status:'reconciliar',confirmado_crm:false}):r}];`);link(consulta,resultado);
  const escrever=condition('POST explicitamente autorizado',"={{ $json.autorizado_post === true }}");link(resultado,escrever);
  const mapear=code('Adaptar contrato do child existente',`${telefoneCRM.toString()}\n${adaptarLeadParaChild.toString()}\nreturn [{json:adaptarLeadParaChild($json)}];`);link(escrever,mapear);
  const child=node('Executar child existente uma vez','executeWorkflow',{source:'database',workflowId:{__rl:true,mode:'id',value:'njZxxrVJrrl6l96i'},mode:'once',options:{waitForSubWorkflow:true}},{retryOnFail:false,onError:'continueRegularOutput'});link(mapear,child);
  const incerto=code('Resultado de escrita exige reconciliação',"// Nem HTTP 200, status success ou resposta SIMULADO confirmam CRM.\nreturn [{json:{status:'reconciliar',confirmado_crm:false,erro:'confirmar_por_api_leads',status_http:Number.isInteger($json.statusCode)?$json.statusCode:null}}];");link(child,incerto);
  const ausente=code('Sem consulta não executar POST',"return [{json:{status:'nao_enviado',post_executado:false}}];");link(apto,ausente,1);
  const resposta=node('Resultado sanitizado','respondToWebhook',{respondWith:'json',responseBody:'={{ $json }}',options:{}},{typeVersion:1.4});
  link(escrever,resposta,1);link(incerto,resposta);link(ausente,resposta);
  return {name:'REALIZE — Harvest | Bridge Superlógica (cutover protegido)',active:false,nodes,connections,
    settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none'}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const expected=criarBridgeRealize();
  if(process.argv.includes('--write'))writeFileSync(new URL('../n8n/realize-superlogica-bridge.json',import.meta.url),JSON.stringify(expected));
  else if(process.argv.includes('--print'))console.log(JSON.stringify(expected));
  else if(!isDeepStrictEqual(JSON.parse(readFileSync(new URL('../n8n/realize-superlogica-bridge.json',import.meta.url),'utf8')),expected))throw Error('bridge_artifact_desatualizado');
}
