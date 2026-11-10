import assert from 'node:assert/strict';
import {test} from 'node:test';
import {autorizarRequisicao} from '../../app/src/lib/recursosHttp.ts';
import {resolverWorkspace} from '../../app/src/lib/workspaceContexto.ts';
import {carregarRecursos} from '../../app/src/lib/servicosWorkspace.ts';
import {carregarEstadosServicos} from '../../app/src/lib/estadosServicos.ts';
import {servicosDb} from '../helpers/servicos-db.ts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',d='33333333-3333-4333-8333-333333333333';
const perfil={id:'root',papel:'super_admin',conta_id:a};
function fixture(){return servicosDb({contas:[{id:a,ativo:true,slug:'cliente-a',modulos_habilitados:['crm','crm_avancado','agentes','ia'],recursos_versao:0},{id:b,ativo:true,slug:'cliente-b',modulos_habilitados:['crm'],recursos_versao:0}],
 conta_recursos:[{conta_id:a,recurso:'crm.base',liberado:false}],workspace_delegacoes:[],servicos_auditoria:[],conta_usuarios:[{user_id:'cliente',conta_id:a,papel:'admin',ativo:true}]});}
test('não há bypass de contrato só por papel global; contexto delegado é explícito e auditado',async()=>{
 const f=fixture();assert.equal((await autorizarRequisicao(f.db,perfil,'/api/crm/oportunidades','GET',{})).status,403);
 f.tabelas.workspace_delegacoes.push({id:d,conta_id:a,ator_id:'root',modo:'suporte',motivo:'Configurar cliente',expira_em:new Date(Date.now()+60_000).toISOString(),encerrado_em:null});
 assert((await autorizarRequisicao(f.db,perfil,'/api/crm/oportunidades','GET',{},d)).ok);
 assert.equal((await autorizarRequisicao(f.db,perfil,'/api/disparo','POST',{},d)).status,403);
 assert(f.tabelas.servicos_auditoria.some(e=>e.evento==='acesso_delegado'&&e.ator_id==='root'&&e.workspace_id===a));
 assert(f.tabelas.servicos_auditoria.every(e=>!('mensagem'in e.detalhes)));
});
test('delegação é vinculada a ator/workspace, expira e não se converte silenciosamente em envio normal',async()=>{
 const f=fixture();f.tabelas.workspace_delegacoes.push({id:d,conta_id:a,ator_id:'root',modo:'homologacao',motivo:'Teste controlado',expira_em:new Date(Date.now()-1).toISOString()});
 assert.equal((await autorizarRequisicao(f.db,perfil,'/api/disparo','POST',{},d)).status,403);
 f.tabelas.workspace_delegacoes[0].expira_em=new Date(Date.now()+60_000).toISOString();
 assert.equal((await autorizarRequisicao(f.db,{...perfil,conta_id:b},'/api/crm/oportunidades','GET',{},d)).status,403);
 assert.equal((await autorizarRequisicao(f.db,{...perfil,id:'outro'},'/api/crm/oportunidades','GET',{},d)).status,403);
});
test('cliente não escolhe tenant alheio pelo cookie/corpo e não assume papel global',async()=>{
 const f=fixture();const p={id:'cliente',papel:'admin',conta_id:a};
 const x=await resolverWorkspace(f.db,p,b);assert.equal(x.contaId,null);assert.equal(x.papel,'operador');
 assert.equal((await autorizarRequisicao(f.db,{id:p.id,papel:'admin',conta_id:a},'/api/crm/oportunidades','GET',{conta_id:b})).status,403);
 assert((await autorizarRequisicao(f.db,{id:'cliente-b',papel:'admin',conta_id:b},'/api/crm/oportunidades','GET',{})).ok);
});
test('origem tipada usa a fonte pertencente à workspace, não o tipo fornecido pelo navegador',async()=>{
 const f=fixture();f.tabelas.conta_recursos.push({conta_id:a,recurso:'inbox.facebook',liberado:false});
 f.tabelas.crm_fontes_funil=[{id:'fonte-b',conta_id:b,tipo:'instagram_dm'},{id:'fonte-a',conta_id:a,tipo:'facebook_messenger'}];
 assert.equal((await autorizarRequisicao(f.db,perfil,'/api/zernio/iniciar','POST',{fonte_id:'fonte-b',tipo:'instagram_dm'})).status,404);
 assert.equal((await autorizarRequisicao(f.db,perfil,'/api/zernio/iniciar','POST',{fonte_id:'fonte-a',tipo:'instagram_dm'})).status,403);
});
test('falha de dados não concede acesso; ausência da migration preserva somente legado',async()=>{
 const f=fixture();const sem=servicosDb(f.tabelas,{conta_recursos:{code:'42P01'}});const c=await carregarRecursos(sem.db,a);assert.equal(c.migrada,false);
 assert((await autorizarRequisicao(sem.db,{...perfil,papel:'admin'},'/api/crm/oportunidades','GET',{})).ok);
 const falha=servicosDb(f.tabelas,{conta_recursos:{code:'XX000'}});await assert.rejects(()=>carregarRecursos(falha.db,a),/indisponiveis/);
 assert.equal((await autorizarRequisicao(f.db,perfil,'/api/recurso-sem-politica','POST',{})).status,403);
});
test('configurado, conectado, ativado e IA autorizada são estados independentes, sem credenciais na resposta',async()=>{
 const f=fixture();f.tabelas.conta_credenciais=[{conta_id:a,serpapi_key:'fake-key-nao-retornar',ia_key:'fake-ia-nao-retornar'}];
 f.tabelas.whatsapp_canais=[{conta_id:a,ativo:true,status:'desconectado',numero:null}];
 f.tabelas.agentes_workspace=[{conta_id:a,tipo:'bdr',ativo:true}];f.tabelas.bdr_config=[{conta_id:a,modo:'simulacao',aprovado_em:null,aprovado_por:null}];
 const e=await carregarEstadosServicos(f.db,a);assert(e['integracoes.ia'].configurado);assert(e['inbox.whatsapp'].ativado);assert(!e['inbox.whatsapp'].conectado);assert(!e['agentes.base'].ia_autorizada);
 assert(!JSON.stringify(e).includes('fake-'));assert(!JSON.stringify(e).includes('token_cifrado'));
});
