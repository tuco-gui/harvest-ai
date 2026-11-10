import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {servicosDb} from '../helpers/servicos-db.ts';
import {provisionarChatwoot} from '../../app/src/lib/chatwootProvisionamento.ts';
const original=globalThis.fetch;
after(()=>{globalThis.fetch=original;for(const k of ['CHATWOOT_API_URL','CHATWOOT_API_TOKEN','CHATWOOT_PLATFORM_APP_TOKEN','CHATWOOT_SERVICE_USER_ID'])delete process.env[k];});
test('provisionamento não usa token de usuário como Platform App nem chama rede sem configuração',async()=>{
 const f=servicosDb({});let calls=0;globalThis.fetch=async()=>{calls++;throw Error('não chamar');};
 process.env.CHATWOOT_API_URL='https://chatwoot.teste.invalid';process.env.CHATWOOT_API_TOKEN='fake-user';
 await assert.rejects(provisionarChatwoot(f.db,'a','admin'),/nao_configurada/);assert.equal(calls,0);
});
test('conta própria é reservada uma vez, usuário técnico confirmado e vínculo Twenty preservado',async()=>{
 Object.assign(process.env,{CHATWOOT_PLATFORM_APP_TOKEN:'fake-platform',CHATWOOT_SERVICE_USER_ID:'7'});
 const f=servicosDb({contas:[{id:'a',ativo:true,nome:'Cliente A'}],chatwoot_provisionamentos:[],crm_vinculos:[{conta_id:'a',twenty_workspace_id:'twenty-a'}],servicos_auditoria:[]});
 f.db.rpc=async()=>{if(f.tabelas.chatwoot_provisionamentos.length)return {data:false,error:null};f.tabelas.chatwoot_provisionamentos.push({conta_id:'a',estado:'reservado'});return {data:true,error:null};};
 let creates=0;globalThis.fetch=async(url,init)=>{
  const path=new URL(String(url)).pathname;
  if(path==='/platform/api/v1/accounts'){creates++;assert.equal((init?.headers as any).api_access_token,'fake-platform');return Response.json({id:11});}
  if(path.endsWith('/account_users'))return Response.json({account_id:11,user_id:7,role:'administrator'});
  if(path==='/api/v1/accounts/11/inboxes'){assert.equal((init?.headers as any).api_access_token,'fake-user');return Response.json({payload:[]});}
  throw Error('Rota inesperada');
 };
 assert.equal(await provisionarChatwoot(f.db,'a','admin'),11);assert.equal(f.tabelas.crm_vinculos[0].twenty_workspace_id,'twenty-a');
 await assert.rejects(provisionarChatwoot(f.db,'a','admin'),/reconciliacao/);assert.equal(creates,1);
 assert.equal(f.tabelas.chatwoot_provisionamentos[0].estado,'pronto');assert.equal(f.tabelas.servicos_auditoria[0].workspace_id,'a');
});
test('timeout depois do POST deixa estado incerto e não repete criação',async()=>{
 const f=servicosDb({contas:[{id:'b',ativo:true,nome:'Cliente B'}],chatwoot_provisionamentos:[]});
 f.db.rpc=async()=>{if(f.tabelas.chatwoot_provisionamentos.length)return {data:false};f.tabelas.chatwoot_provisionamentos.push({conta_id:'b',estado:'reservado'});return {data:true};};
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('timeout após escrita remota');};
 await assert.rejects(provisionarChatwoot(f.db,'b','admin'));await assert.rejects(provisionarChatwoot(f.db,'b','admin'));
 assert.equal(calls,1);assert.equal(f.tabelas.chatwoot_provisionamentos[0].estado,'incerto');assert.equal(f.tabelas.crm_vinculos?.length??0,0);
});
test('404 na leitura de inboxes não comprova acesso à conta recém-criada',async()=>{
 const f=servicosDb({contas:[{id:'c',ativo:true,nome:'Cliente C'}],chatwoot_provisionamentos:[]});
 f.db.rpc=async()=>{f.tabelas.chatwoot_provisionamentos.push({conta_id:'c',estado:'reservado'});return {data:true};};
 globalThis.fetch=async url=>{
  const path=new URL(String(url)).pathname;
  if(path==='/platform/api/v1/accounts')return Response.json({id:33});
  if(path.endsWith('/account_users'))return Response.json({account_id:33,user_id:7,role:'administrator'});
  return Response.json({erro:'Não encontrado'},{status:404});
 };
 await assert.rejects(provisionarChatwoot(f.db,'c','admin'),/reconciliacao/);
 assert.equal(f.tabelas.crm_vinculos?.length??0,0);assert.equal(f.tabelas.chatwoot_provisionamentos[0].estado,'incerto');
});
