import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '../../app/node_modules/@electric-sql/pglite/dist/index.js';

test('054 contra DDL das migrations anteriores, com constraints e funções reais',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);`);
    const dir=new URL('../../sql/',import.meta.url);
    for(const file of (await readdir(dir)).filter(n=>/^\d{3}_.*\.sql$/.test(n)&&Number(n.slice(0,3))<54).sort()){
      let sql=await readFile(new URL(file,dir),'utf8');
      // 028 contém um seed legado inválido (RECORD[]/conta_modulos). Seu DDL é preservado;
      // o seed de contas preexistentes não participa da reprodução do schema nem da 054.
      if(file==='028_funis_pipeline.sql')sql=sql.split('-- FUNIL PADRÃO:')[0];
      try{await db.exec(sql);}catch(e){throw Error(`Migration anterior ${file}: ${e.message}`);}
    }
    await db.exec(await readFile(new URL('054_realize_bdr.sql',dir),'utf8'));
    await db.exec(await readFile(new URL('../integration/bdr-postgres.sql',import.meta.url),'utf8'));
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='crm_validar_atendimento_canal'")).rows[0].n,1);
  }finally{await db.close();}
});
