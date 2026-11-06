import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '../../app/node_modules/@electric-sql/pglite/dist/index.js';

test('PostgreSQL real: RLS, isolamento, dedupe concorrente, primeira origem, stop on reply e handoff',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE contas(id uuid PRIMARY KEY);
      CREATE TABLE perfis(id uuid PRIMARY KEY);
      CREATE TABLE whatsapp_canais(id bigint PRIMARY KEY,conta_id uuid REFERENCES contas(id));
      CREATE TABLE funis(id bigint PRIMARY KEY,conta_id uuid REFERENCES contas(id),canal_padrao_id bigint);
      CREATE TABLE prospecta_leads(id bigserial PRIMARY KEY,conta_id uuid REFERENCES contas(id),empresa text,telefone text,origem text,status text);
      CREATE TABLE inbound_eventos(id bigserial PRIMARY KEY,conta_id uuid REFERENCES contas(id),canal_id bigint,funil_id bigint,
        telefone text,nome_contato text,mensagem text,lead_id bigint);
      CREATE TABLE prospecta_mensagens(id bigserial PRIMARY KEY);
      CREATE TABLE crm_vinculos(conta_id uuid PRIMARY KEY REFERENCES contas(id));
      CREATE TABLE chatwoot_inboxes(id bigint PRIMARY KEY,conta_id uuid REFERENCES contas(id),
        chatwoot_account_id int,chatwoot_inbox_id int,ativo boolean DEFAULT true);`);
    await db.exec(await readFile(new URL('../../sql/054_realize_bdr.sql',import.meta.url),'utf8'));
    const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
    await db.query('INSERT INTO contas VALUES ($1),($2)',[a,b]);
    await db.query('INSERT INTO whatsapp_canais VALUES(1,$1),(2,$2)',[a,b]);
    await db.query('INSERT INTO funis VALUES(1,$1,1),(2,$2,2)',[a,b]);
    await assert.rejects(db.query('INSERT INTO bdr_config(conta_id,canal_id,funil_id) VALUES($1,2,1)',[a]),/Canal fora/);
    await assert.rejects(db.query('INSERT INTO bdr_config(conta_id,canal_id,funil_id) VALUES($1,1,2)',[a]),/Funil fora/);
    await db.query('INSERT INTO bdr_config(conta_id,canal_id,funil_id) VALUES($1,1,1),($2,2,2)',[a,b]);
    const cfg=await db.query('SELECT modo,crm_habilitado FROM bdr_config');
    assert(cfg.rows.every(x=>x.modo==='simulacao'&&!x.crm_habilitado));
    await assert.rejects(db.query("UPDATE bdr_config SET modo='producao' WHERE conta_id=$1",[a]),/check constraint/);
    const capture=(conta,chave,tel='5514999999999',email=null,origem={source_channel:'lp',utm_source:'google'})=>db.query(
      'SELECT superlogica_capturar($1,$2,$3,$4,$5,$6::jsonb) id',[conta,chave,'Contato Teste',tel,email,JSON.stringify(origem)]);
    const captures=await Promise.all([capture(a,'lp:protocolo-1'),capture(a,'lp:protocolo-1')]);
    assert.equal(captures[0].rows[0].id,captures[1].rows[0].id);
    await capture(a,'whatsapp:1:externo','5514999999999','teste@example.test',{source_channel:'whatsapp'});
    const rows=await db.query('SELECT * FROM superlogica_registros WHERE conta_id=$1',[a]);
    assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].origem.utm_source,'google');assert.equal(rows.rows[0].email,'teste@example.test');
    const outro=await capture(b,'lp:protocolo-1');assert.notEqual(outro.rows[0].id,rows.rows[0].id);
    await assert.rejects(db.query('INSERT INTO superlogica_entradas(conta_id,chave,registro_id) VALUES($1,$2,$3)',[b,'fraude',rows.rows[0].id]),/foreign key/);
    await db.query("INSERT INTO inbound_eventos(id,conta_id,canal_id,funil_id,telefone,nome_contato,mensagem) VALUES(1,$1,1,1,'5514999999999','Teste','Olá'),(2,$1,1,1,'5514999999999','Teste','Quero visita')",[a]);
    const receive=()=>db.query('SELECT bdr_receber($1,1,NULL) id',[a]);
    const ids=await Promise.all([receive(),receive()]);assert.equal(ids[0].rows[0].id,ids[1].rows[0].id);
    const id=ids[0].rows[0].id;
    assert.equal((await db.query('SELECT count(*)::int n FROM bdr_sessoes')).rows[0].n,1);
    assert.equal((await db.query('SELECT count(*)::int n FROM prospecta_leads')).rows[0].n,1);
    assert.equal((await db.query('SELECT bdr_reservar($1,$2,0) ok',[b,id])).rows[0].ok,false);
    assert.equal((await db.query('SELECT bdr_reservar($1,$2,0) ok',[a,id])).rows[0].ok,true);
    assert.equal((await db.query('SELECT bdr_reservar($1,$2,0) ok',[a,id])).rows[0].ok,false);
    await db.query("UPDATE bdr_sessoes SET proximo_followup=now(),estado='humano_assumiu' WHERE id=$1",[id]);
    await db.query('SELECT bdr_receber($1,2,NULL)',[a]);
    const after=(await db.query('SELECT * FROM bdr_sessoes WHERE id=$1',[id])).rows[0];
    assert.equal(after.estado,'humano_assumiu');assert.equal(after.proximo_followup,null);assert.equal(after.versao,1);
    await db.query("SELECT bdr_receber($1,2,'opt_out')",[a]); // replay cannot change state
    assert.equal((await db.query('SELECT estado FROM bdr_sessoes WHERE id=$1',[id])).rows[0].estado,'humano_assumiu');
    await db.query("INSERT INTO inbound_eventos(id,conta_id,canal_id,funil_id,telefone,nome_contato,mensagem) VALUES(3,$1,1,1,'5514999999999','Teste','Pare')",[a]);
    await db.query("SELECT bdr_receber($1,3,'opt_out')",[a]);
    assert.equal((await db.query('SELECT estado FROM bdr_sessoes WHERE id=$1',[id])).rows[0].estado,'opt_out');
    const kpis=(await db.query('SELECT bdr_kpis($1) kpis',[a])).rows[0].kpis;
    assert.equal(kpis.respondidos,1);assert.equal(kpis.recebidos,1);assert.equal(kpis.visitas_confirmadas_humano,0);
    await db.query("INSERT INTO inbound_eventos(id,conta_id,canal_id,telefone,mensagem_fisica_id) VALUES(4,$1,1,'5514999999999','fisica-1')",[a]);
    await assert.rejects(db.query("INSERT INTO inbound_eventos(id,conta_id,canal_id,telefone,mensagem_fisica_id) VALUES(5,$1,1,'5514999999999','fisica-1')",[a]),/unique constraint/);
    await db.query("INSERT INTO inbound_eventos(id,conta_id,canal_id,telefone,mensagem_fisica_id) VALUES(6,$1,2,'5514999999999','fisica-1')",[b]);
    await assert.rejects(db.query('INSERT INTO chatwoot_inboxes(id,conta_id,whatsapp_canal_id) VALUES(1,$1,2)',[a]),/fora da workspace/);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query('SELECT * FROM bdr_sessoes'),/permission denied/);
    await assert.rejects(db.query('SELECT bdr_receber($1,1,NULL)',[a]),/permission denied/);
    await db.exec('RESET ROLE');
    console.log('Migration 054: isolamento, captura idempotente, primeira origem, locks e handoff validados em PostgreSQL WASM.');
  } finally {await db.close();}
});
