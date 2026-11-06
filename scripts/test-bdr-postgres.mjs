import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Mesmo acesso SSH já usado por test-crm-social-sql.mjs. Nunca COMMIT, import ou deploy.
if(!process.argv.includes('--rollback-only'))throw Error('Exige --rollback-only explícito');
const container=process.env.HARVEST_POSTGRES_CONTAINER;
if(!container||!/^[a-zA-Z0-9_.-]+$/.test(container))throw Error('Defina HARVEST_POSTGRES_CONTAINER');
const migration=readFileSync(new URL('../sql/054_realize_bdr.sql',import.meta.url),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const tests=readFileSync(new URL('../tests/integration/bdr-postgres.sql',import.meta.url),'utf8');
const sql=`BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='20s';\n${migration}\n${tests}\nROLLBACK;\nSELECT to_regclass('public.bdr_config') IS NULL AS rollback_confirmado;`;
const r=spawnSync('ssh',['-i',process.env.HARVEST_SSH_KEY??process.env.HOME+'/.ssh/figueira_agencia_ed25519','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','root@77.37.40.97',
 'docker','exec','-i',container,'psql','-U','supabase_admin','-d','postgres','-X','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:60000});
process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1;
