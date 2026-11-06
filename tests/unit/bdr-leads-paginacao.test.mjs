import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consultarLeadsPaginado,iniciarConsultaLeads} from '../../app/src/lib/superlogicaLeads.mjs';
import {analisarConsultaLeads} from '../../app/src/lib/superlogicaContrato.mjs';
import {criarConsultaLeads,prepararLeadsPaginacao} from '../../scripts/realize-leads-artifact.mjs';
import {readFileSync} from 'node:fs';
const pedido={acao:'consultar',tenant_id:'11111111-1111-4111-8111-111111111111',idempotency_key:'teste',codigo_anuncio:'CA0653_MMOL',telefone:'5514999999999',email:'qa@example.test'};
const registro=(id,alvo=false,codigo='CA0653_MMOL')=>({id,telefone:alvo?'(14) 99999-9999':'11988888888',email:alvo?pedido.email:'outro@example.test',imoveis:[{codigo}]});
const pagina=(page,data,total=3,perPage=1)=>({statusCode:200,body:{data,total,page,perPage,lastPage:Math.ceil(total/perPage)}});
test('paginação completa encontra identidade na última página e só então confirma imóvel',async()=>{
  const chamadas=[];
  const r=await consultarLeadsPaginado(pedido,async q=>{chamadas.push(q);return pagina(q.page,[registro(q.page,q.page===3)]);},{perPage:1});
  assert.equal(r.completa,true);assert.equal(r.paginas_lidas,3);assert.equal(r.total,3);
  assert.equal(analisarConsultaLeads(pedido,r).id_superlogica,'3');
  assert.deepEqual(chamadas.map(c=>c.page),[1,2,3]);
});
test('identidade em imóvel divergente ou cadastros duplicados exige reconciliação',async()=>{
  const r=await consultarLeadsPaginado(pedido,async()=>pagina(1,[registro(1,true,'OUTRO')],1));
  assert.equal(analisarConsultaLeads(pedido,r).erro,'identidade_ou_imovel_divergente');
  const duplicado=await consultarLeadsPaginado(pedido,async q=>pagina(q.page,[registro(q.page,true)],2),{perPage:1});
  assert.equal(analisarConsultaLeads(pedido,duplicado).erro,'multiplos_cadastros_crm');
  const multi=registro(1,true,'OUTRO');multi.imoveis.push({codigo:'CA0653_MMOL'});
  assert.equal(analisarConsultaLeads(pedido,await consultarLeadsPaginado(pedido,async()=>pagina(1,[multi],1))).status,'cadastrado');
  const semImovel={...registro(1,true),imoveis:null};
  assert.equal(analisarConsultaLeads(pedido,await consultarLeadsPaginado(pedido,async()=>pagina(1,[semImovel],1))).status,'reconciliar');
});
test('consulta completa sem identidade correspondente prova ausência; outras pessoas não confundem imóvel',async()=>{
  const r=await consultarLeadsPaginado(pedido,async q=>pagina(q.page,[registro(q.page,false)],2),{perPage:1});
  assert(r.completa);assert.deepEqual(r.leads,[]);assert.equal(analisarConsultaLeads(pedido,r).status,'ausente');
});
test('página vazia/parcial, página repetida, IDs repetidos ou total mutável nunca confirmam',async()=>{
  for(const gerar of [
    q=>pagina(q.page,[]),q=>pagina(1,[registro(q.page,true)]),
    q=>pagina(q.page,[registro(1,true)]),q=>pagina(q.page,[registro(q.page,true)],q.page===1?3:4),
  ]){
    const r=await consultarLeadsPaginado(pedido,async q=>gerar(q),{perPage:1});
    assert.equal(r.completa,false);assert.equal(analisarConsultaLeads(pedido,r).status,'reconciliar');
    assert.deepEqual(r.leads,[]);
  }
});
test('HTTP 200 ambíguo, erro em página seguinte e timeout não aproveitam confirmação parcial',async()=>{
  for(const gerar of [()=>({statusCode:200,body:{ok:true}}),
    q=>q.page===1?pagina(1,[registro(1,true)]):{statusCode:503},
    q=>{if(q.page===2)throw Error('timeout contendo PII que não deve vazar');return pagina(1,[registro(1,true)]);},
  ]){
    const r=await consultarLeadsPaginado(pedido,async q=>gerar(q),{perPage:1});
    assert(!r.completa);assert.equal(analisarConsultaLeads(pedido,r).status,'reconciliar');assert(!JSON.stringify(r).includes('PII'));
  }
});
test('limites de páginas/registros e metadados incoerentes interrompem leitura',async()=>{
  let calls=0;
  const r=await consultarLeadsPaginado(pedido,async()=>{calls++;return pagina(1,[registro(1)],100);},{perPage:1,maxPages:2});
  assert.equal(calls,1);assert.equal(r.erro,'limite_consulta_excedido');
  const vazio=await consultarLeadsPaginado(pedido,async()=>({statusCode:200,body:{data:[],total:0,page:1,perPage:100,lastPage:0}}));
  assert(vazio.completa);assert.equal(analisarConsultaLeads(pedido,vazio).status,'ausente');
});
test('schema observado aceita page/perPage como strings decimais estritas, nunca coerção ambígua',async()=>{
  assert.equal(iniciarConsultaLeads({...pedido,acao:'cadastrar'}).pedido.acao,'consultar','preflight do bridge sempre se torna leitura GET');
  const r=await consultarLeadsPaginado(pedido,async()=>({statusCode:200,body:{data:[registro(1,true)],total:1,page:'1',perPage:'100',lastPage:1}}));
  assert(r.completa);assert.equal(analisarConsultaLeads(pedido,r).status,'cadastrado');
  for(const page of ['1x','1.0','1e0','',null]){
    assert.equal((await consultarLeadsPaginado(pedido,async()=>({statusCode:200,body:{data:[],total:0,page,perPage:'100',lastPage:0}}))).completa,false);
  }
});
test('patch do workflow LEADS mantém credencial instalada e diagnóstico, com export inativo',()=>{
  const artifact=JSON.parse(readFileSync(new URL('../../n8n/realize-leads-paginacao.json',import.meta.url),'utf8'));
  assert.deepEqual(artifact,criarConsultaLeads());
  const original={...artifact,nodes:[...artifact.nodes,{id:'diagnostico',name:'Diagnóstico existente',parameters:{valor:'preservar'}}],active:true};
  const result=prepararLeadsPaginacao(original);
  assert.equal(result.active,false);assert.equal(result.nodes.find(n=>n.id==='diagnostico').parameters.valor,'preservar');
  assert.deepEqual(result.nodes.find(n=>n.id==='2fa596d9-6b0e-4188-a90e-bc96dbd0b221').credentials,
    original.nodes.find(n=>n.id==='2fa596d9-6b0e-4188-a90e-bc96dbd0b221').credentials);
});
