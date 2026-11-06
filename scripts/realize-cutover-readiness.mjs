import {spawnSync} from 'node:child_process';
const container=process.env.HARVEST_POSTGRES_CONTAINER;
if(!container||!/^[a-zA-Z0-9_.-]+$/.test(container))throw Error('Defina HARVEST_POSTGRES_CONTAINER existente');
const sql=`BEGIN READ ONLY;SELECT json_build_object('schema_bdr_instalado',to_regclass('public.bdr_config') IS NOT NULL,
 'workspace_realize_existente',EXISTS(SELECT 1 FROM public.contas WHERE ativo AND (slug ILIKE '%realize%' OR nome ILIKE '%realize%')));ROLLBACK;`;
const r=spawnSync('ssh',['-i',process.env.HARVEST_SSH_KEY??process.env.HOME+'/.ssh/figueira_agencia_ed25519','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','root@77.37.40.97',
 'docker','exec','-i',container,'psql','-U','supabase_admin','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
if(r.status!==0)throw Error('readiness_schema_indisponivel');
const db=JSON.parse(r.stdout.split('\n').find(l=>l.startsWith('{')));
let status=0;try{status=(await fetch('https://harvest.figueiramarketing.com.br/api/webhook/bdr',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(15000)})).status;}catch{}
const bloqueios=[];
if(status!==401)bloqueios.push('endpoint_bdr_nao_publicado_ou_nao_verificado');
if(!db.schema_bdr_instalado)bloqueios.push('migration_bdr_nao_aplicada');
if(!db.workspace_realize_existente)bloqueios.push('workspace_realize_ausente');
console.log(JSON.stringify({operacao:'preflight_cutover_somente_leitura',endpoint_status:status,...db,infraestrutura_minima_pronta:bloqueios.length===0,cutover_permitido:false,bloqueios,
  exige_tambem:['autenticacao ponta a ponta','configuracao CRM e canal/funil Realize','drenagem das execucoes antigas','validarEscritorUnico nas versoes publicadas','preservacao dos protocolos']}));
if(bloqueios.length)process.exitCode=2;
