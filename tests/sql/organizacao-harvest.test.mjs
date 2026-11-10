import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '../../app/node_modules/@electric-sql/pglite/dist/index.js';
import {schemaHarvest} from './schema-harvest.mjs';
test('056–058: configuração genérica, reserva Chatwoot e vínculos CRM idempotentes sem redistribuição',async()=>{
 const db=new PGlite();try{
  await schemaHarvest(db,58);
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',root='33333333-3333-4333-8333-333333333333';
  await db.query("INSERT INTO contas(id,nome,slug) VALUES($1,'Realize teste','realize-teste'),($2,'Outra empresa','outra-teste')",[a,b]);
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'root@teste.invalid')",[root]);
  await db.query("UPDATE perfis SET papel='super_admin' WHERE id=$1",[root]);
  const canal=(await db.query("INSERT INTO whatsapp_canais(conta_id,provider,nome) VALUES($1,'waha','Canal teste') RETURNING id",[a])).rows[0].id;
  const funil=(await db.query("INSERT INTO funis(conta_id,nome,canal_padrao_id) VALUES($1,'Funil teste',$2) RETURNING id",[a,canal])).rows[0].id;
  await db.query("INSERT INTO bdr_config(conta_id,canal_id,funil_id,codigo_anuncio) VALUES($1,$2,$3,'AP0002_OUTRO')",[a,canal,funil]);
  const cfg=(await db.query('SELECT * FROM bdr_config WHERE conta_id=$1',[a])).rows[0];assert.equal(cfg.modo,'simulacao');assert.equal(cfg.distribuicao_crm_validada,null);
  assert.equal((await db.query('SELECT chatwoot_reservar_provisionamento($1,$2) ok',[a,root])).rows[0].ok,true);
  assert.equal((await db.query('SELECT chatwoot_reservar_provisionamento($1,$2) ok',[a,root])).rows[0].ok,false);
  await db.query('INSERT INTO crm_vinculos(conta_id,chatwoot_account_id) VALUES($1,10)',[a]);
  await assert.rejects(db.query('INSERT INTO crm_vinculos(conta_id,chatwoot_account_id) VALUES($1,10)',[b]),/unique/);
  const r=(await db.query("SELECT superlogica_capturar($1,'lp:PROTO-001','Pessoa teste','5514999999999','pessoa@teste.invalid','{\"source_channel\":\"lp\"}') id",[a])).rows[0].id;
  assert.equal((await db.query('SELECT count(*)::int n FROM crm_contatos WHERE conta_id=$1',[a])).rows[0].n,0);
  const link=()=>db.query('SELECT superlogica_vincular_crm($1,$2,$3) v',[a,r,root]);
  const v=(await link()).rows[0].v;assert(v.contato_id&&v.lead_id&&v.oportunidade_id);
  await db.query("UPDATE oportunidades SET owner_id=$1,estagio='qualificando' WHERE id=$2",[root,v.oportunidade_id]);
  assert.deepEqual((await link()).rows[0].v,v);
  assert.equal((await db.query('SELECT count(*)::int n FROM crm_contatos WHERE conta_id=$1',[a])).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM oportunidades WHERE conta_id=$1',[b])).rows[0].n,0);
  const op=(await db.query('SELECT owner_id,estagio FROM oportunidades WHERE id=$1',[v.oportunidade_id])).rows[0];assert.equal(op.owner_id,root);assert.equal(op.estagio,'qualificando');
  await assert.rejects(db.query("UPDATE bdr_config SET codigo_anuncio='CA9999' WHERE conta_id=$1",[a]),/histórico/);
  assert.deepEqual((await db.query('SELECT * FROM bdr_config WHERE conta_id=$1',[a])).rows[0],cfg);
  await assert.rejects(db.query('SELECT superlogica_vincular_crm($1,$2,$3)',[b,r,root]),/não encontrada/);
  await db.query("INSERT INTO crm_contatos(conta_id,nome,telefone) VALUES($1,'Duplicado','5514999999999')",[a]);
  await assert.rejects(link(),/ambíguos/);
  await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT * FROM chatwoot_provisionamentos'),/permission denied/);await db.exec('RESET ROLE');
 }finally{await db.close();}
});
