/** Regressão da migração social em transação sempre revertida. Não envia mensagens. */
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const container=process.env.HARVEST_POSTGRES_CONTAINER;
if(!container||!/^[a-zA-Z0-9_.-]+$/.test(container))throw Error('Defina HARVEST_POSTGRES_CONTAINER.');
const migracao=readFileSync(new URL('../sql/051_contatos_atendimentos_sociais.sql',import.meta.url),'utf8')
 .replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const testes=readFileSync(new URL('../tests/integration/crm-social-postgres.sql',import.meta.url),'utf8');
const sql='BEGIN;\n'+migracao+'\n'+testes+'\nROLLBACK;\n';
const result=spawnSync('ssh',['-i',process.env.HARVEST_SSH_KEY??process.env.HOME+'/.ssh/figueira_agencia_ed25519',
 '-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','root@77.37.40.97',
 'docker','exec','-i',container,'psql','-U','supabase_admin','-d','postgres','-X','-v','ON_ERROR_STOP=1'],
 {input:sql,encoding:'utf8',timeout:60000});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
if(result.error)throw result.error;
process.exitCode=result.status??1;
