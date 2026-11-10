import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {adaptarLeadParaChild,analisarConsultaLeads,validarEscritorUnico} from '../../app/src/lib/superlogicaContrato.mjs';
import {prepararCutover} from '../../scripts/realize-cutover.mjs';
import {criarBridgeRealize} from '../../scripts/realize-bridge-artifact.mjs';
import {chamarBridgeSuperlogica} from '../../app/src/lib/superlogica.ts';

const p={acao:'cadastrar',cliente:'Teste controlado',telefone:'5514999999999',email:'teste@example.test',
  codigo_anuncio:'CA0653_MMOL',tenant_id:'11111111-1111-4111-8111-111111111111',idempotency_key:'22222222-2222-4222-8222-222222222222'};
// Projeção sanitizada dos nós/arestas observados em 06/11; não é export para importação.
function observados(){
  const source=(id,nodeId,sheet)=>({id,active:true,versionId:'observada',activeVersionId:'observada',nodes:[
    {id:'sheet',name:sheet,type:'n8n-nodes-base.googleSheets',parameters:{operation:'append'}},
    {id:'response',name:'Resposta',type:'n8n-nodes-base.respondToWebhook',parameters:{}},
    {id:nodeId,name:'Registrar no Superlógica — após salvar planilha',type:'n8n-nodes-base.executeWorkflow',parameters:{workflowId:{value:'njZxxrVJrrl6l96i'}}}],
    connections:{[sheet]:{main:[[{node:'Resposta'},{node:'Registrar no Superlógica — após salvar planilha'}]]}}});
  return [source('CZ3gAStDKp75yJtm','9129069e-ecff-4ad9-b4ec-51f562ba8008','Registrar Lead na Planilha Realize'),
    source('pqVU7Tceb9Xv8dHs','3bea5a77-e26f-4d25-8862-353d9709bf30','Salvar Chat Realize'),
    {id:'njZxxrVJrrl6l96i',active:true,versionId:'observada',activeVersionId:'observada',nodes:[{
      id:'618f1476-aa5f-47c9-ae90-9fd3fcae76f0',name:'Enviar ao Superlogica',type:'n8n-nodes-base.httpRequest',retryOnFail:true,maxTries:3,
      parameters:{method:'POST',url:'https://sr3qgnognj.execute-api.sa-east-1.amazonaws.com/production/cliente',options:{timeout:20000}},credentials:{httpMultipleHeadersAuth:{id:'referencia-protegida'}}}],connections:{}}];
}
function publicados(){return prepararCutover(observados(),{id:'credencial-existente',name:'Harvest existente'}).map(w=>({...w,active:true,versionId:'publicada-teste',activeVersionId:'publicada-teste'}));}
const artifact=JSON.parse(readFileSync(new URL('../../n8n/realize-superlogica-bridge.json',import.meta.url),'utf8'));
const code=(name,json,refs={})=>new Function('$json','$env','$',artifact.nodes.find(n=>n.name===name).parameters.jsCode)(json,
  {REALIZE_SUPERLOGICA_WORKSPACES:p.tenant_id},name=>({first:()=>({json:refs[name]})}))[0].json;
const consulta=leads=>({fonte:'api_leads',status_http:200,completa:true,leads});
const lead={id_superlogica:'crm-123',codigo_anuncio:'CA0653_MMOL',telefone:'(14) 99999-9999',email:p.email};

test('artefato n8n é gerado pelo mesmo contrato puro e fica inativo',()=>{
  assert.deepEqual(artifact,criarBridgeRealize());assert.equal(artifact.active,false);
});
test('adaptação explícita passa pelo preparador real do child, inclusive nome e telefone',()=>{
  const mapped=code('Adaptar contrato do child existente',p);
  assert.deepEqual(mapped,adaptarLeadParaChild(p));
  // Expressões do node Preparar lead Superlogica consultado em njZxxrVJrrl6l96i.
  const preparar=x=>{const nome=String(x['Nome']||x.nome||'').trim();const telefone=String(x['WhatsApp']||x.whatsapp||'').replace(/\D/g,'');
    const email=String(x['E-mail']||x.email||'').trim();if(nome.length<3||telefone.length<10)throw Error('Lead invalido para Superlogica');
    return {codigo_anuncio:'CA0653_MMOL',cliente:nome,telefone,email};};
  assert.throws(()=>preparar(p));assert.deepEqual(preparar(mapped),{codigo_anuncio:'CA0653_MMOL',cliente:p.cliente,telefone:p.telefone,email:p.email});
});
test('renda, termo UTM e gclid são preservados na adaptação sem novo campo CRM',()=>{
  const input={...p,origem:{utm_source:'google',utm_campaign:'alea_botucatu_search_leads',
    renda_familiar:'R$ 3.001 a R$ 5.000',utm_term:'casas alea botucatu',gclid:'teste-gclid'}};
  const mapped=adaptarLeadParaChild(input);
  assert.equal(mapped['Renda familiar'],'R$ 3.001 a R$ 5.000');
  assert.equal(mapped.Termo,'casas alea botucatu');
  assert.equal(mapped.gclid,'teste-gclid');
  assert.deepEqual(code('Adaptar contrato do child existente',input),mapped);
});

test('cutover preserva planilha/resposta/credenciais e recusa escritor legado, misto ou com retry',()=>{
  const original=observados(),copia=structuredClone(original);
  assert.throws(()=>validarEscritorUnico(original));
  const changed=prepararCutover(original,{id:'credencial-existente'});assert.deepEqual(original,copia);
  assert(changed.every(w=>!w.active));assert.deepEqual(changed[2].nodes[0].credentials,original[2].nodes[0].credentials);
  const ready=publicados();assert(validarEscritorUnico(ready));
  for(let i=0;i<2;i++)assert.deepEqual(ready[i].connections,original[i].connections);
  assert.throws(()=>validarEscritorUnico([ready[0],original[1],ready[2]]),/escritor_legado/);
  const retries=structuredClone(ready);retries[2].nodes[0].retryOnFail=true;assert.throws(()=>validarEscritorUnico(retries),/child_sem_protecao/);
  const draft=structuredClone(ready);draft[0].versionId='rascunho';assert.throws(()=>validarEscritorUnico(draft),/versao_publicada/);
});
test('renda, UTMs, GCLID, protocolo e comentário não se perdem no adapter gerado',()=>{
  const input={...p,comentarioLead:'Protocolo AB-TESTE | Renda familiar: faixa declarada',origem:{source_channel:'lp',renda_familiar:'3 a 5 mil',
    utm_source:'google',utm_medium:'cpc',utm_campaign:'teste',utm_term:'termo recebido',utm_content:'grupo-a',gclid:'gclid-ficticio',protocolo:'AB-TESTE'}};
  const mapped=adaptarLeadParaChild(input);assert.equal(mapped['Renda familiar'],'3 a 5 mil');assert.equal(mapped.Termo,'termo recebido');
  assert.equal(mapped.gclid,'gclid-ficticio');assert.equal(mapped.protocolo_origem,'AB-TESTE');assert.equal(mapped.comentarioLead,input.comentarioLead);
  assert.deepEqual(mapped.origem,input.origem);assert.deepEqual(code('Adaptar contrato do child existente',input),mapped);
  assert(!('responsavel' in mapped));assert(!('usuario_id' in mapped));
});
test('HTTP 200, success, simulação, consulta incompleta e cadastros múltiplos não confirmam CRM',()=>{
  for(const r of [{status:'SIMULADO',message:'Sem envio externo'},{statusCode:200,body:{ok:true}},
    {status:'cadastrado',confirmado_crm:true}, {...consulta([]),completa:false},consulta([lead,{...lead,id_superlogica:'crm-456'}])])
    assert.equal(analisarConsultaLeads(p,r).status,'reconciliar');
  assert.equal(analisarConsultaLeads(p,consulta([{...lead,codigo_anuncio:'OUTRO'}])).status,'reconciliar');
  assert.equal(analisarConsultaLeads(p,consulta([lead])).status,'cadastrado');
});
test('integração dos Code nodes: escrita ambígua → somente consulta; duplicado não executa child',async()=>{
  let posts=0,crm=[];const original=globalThis.fetch;
  process.env.REALIZE_SUPERLOGICA_N8N_URL='https://n8n.fake.test';process.env.REALIZE_SUPERLOGICA_N8N_TOKEN='fake';
  globalThis.fetch=async(_url,init)=>{
    const req=JSON.parse(init.body);const ws=publicados();
    code('Verificar escritor exclusivo',{}, {'Ler LP publicada':ws[0],'Ler minichat publicado':ws[1],'Ler child publicado':ws[2],'Validar tenant e contrato':req});
    let result=code('Conferir identidade e imóvel',consulta(crm),{'Verificar escritor exclusivo':req});
    if(result.autorizado_post){posts++;code('Adaptar contrato do child existente',result);
      crm=[lead];result=code('Resultado de escrita exige reconciliação',{statusCode:200,body:{mensagem:'Recebido'}});}
    return Response.json(result);
  };
  try{
    assert.equal((await chamarBridgeSuperlogica(p)).status,'reconciliar');assert.equal(posts,1);
    assert.equal((await chamarBridgeSuperlogica({...p,acao:'consultar'})).status,'cadastrado');assert.equal(posts,1);
    assert.equal((await chamarBridgeSuperlogica(p)).status,'cadastrado');assert.equal(posts,1,'duplicado reconhecido pela consulta, sem POST');
    crm=[];assert.equal((await chamarBridgeSuperlogica({...p,acao:'consultar'})).status,'reconciliar');assert.equal(posts,1,'consulta vazia não volta a cadastrar');
  }finally{globalThis.fetch=original;delete process.env.REALIZE_SUPERLOGICA_N8N_URL;delete process.env.REALIZE_SUPERLOGICA_N8N_TOKEN;}
});
