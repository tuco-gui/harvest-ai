import {readFile,readdir} from 'node:fs/promises';
export async function schemaHarvest(db,ate=54){
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated;
  CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);`);
 const dir=new URL('../../sql/',import.meta.url);
 for(const file of(await readdir(dir)).filter(n=>/^\d{3}_.*\.sql$/.test(n)&&Number(n.slice(0,3))<=ate).sort()){
  let sql=await readFile(new URL(file,dir),'utf8');
  if(file==='028_funis_pipeline.sql')sql=sql.split('-- FUNIL PADRÃO:')[0];
  try{await db.exec(sql);}catch(e){throw Error(`Schema ${file}: ${e.message}`);}
 }
}
