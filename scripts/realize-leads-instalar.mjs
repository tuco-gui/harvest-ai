import {spawnSync} from 'node:child_process';
import {prepararLeadsPaginacao,WORKFLOW_LEADS} from './realize-leads-artifact.mjs';
import {iniciarConsultaLeads,consumirPaginaLeads} from '../app/src/lib/superlogicaLeads.mjs';
const container=process.env.REALIZE_N8N_CONTAINER;
if(!container||!/^[a-zA-Z0-9_.-]+$/.test(container))throw Error('Defina REALIZE_N8N_CONTAINER existente');
const apply=process.argv.includes('--apply');
const expected=process.env.REALIZE_LEADS_EXPECTED_VERSION??'bdaf62f8-b800-4645-bbb9-67e47a374729';
const script=`const {execFileSync}=require('node:child_process');const fs=require('node:fs');const{isDeepStrictEqual}=require('node:util');
const WORKFLOW_LEADS=${JSON.stringify(WORKFLOW_LEADS)};
${iniciarConsultaLeads.toString()}
${consumirPaginaLeads.toString()}
${prepararLeadsPaginacao.toString()}
const cli=args=>execFileSync('n8n',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const exportar=()=>{const s=cli(['export:workflow','--id='+WORKFLOW_LEADS]);const i=s.search(/\\[\\s*\\{/);if(i<0)throw Error('formato_export_nao_suportado');return JSON.parse(s.slice(i))[0];};
let original,dir;
try{
 original=exportar();if(original.versionId!==${JSON.stringify(expected)})throw Error('versao_divergiu');
 const next=prepararLeadsPaginacao(original);
 const core=new Set(['f602425c-49c9-4e21-bb1e-2aa74fcd7308','2fa596d9-6b0e-4188-a90e-bc96dbd0b221','bb268309-43ec-42b6-9f87-6a1470e364a3']);
 for(const n of original.nodes)if(!core.has(n.id)&&!isDeepStrictEqual(n,next.nodes.find(x=>x.id===n.id)))throw Error('ramo_existente_alterado');
 if(${JSON.stringify(apply)}){
  dir=fs.mkdtempSync('/tmp/harvest-leads-');fs.writeFileSync(dir+'/original.json',JSON.stringify([original]),{mode:0o600});
  fs.writeFileSync(dir+'/patch.json',JSON.stringify([next]),{mode:0o600});
  cli(['import:workflow','--input='+dir+'/patch.json']);cli(['publish:workflow','--id='+WORKFLOW_LEADS]);
  const after=exportar();if(!after.active||after.activeVersionId!==after.versionId||!isDeepStrictEqual(after.nodes,next.nodes))throw Error('publicacao_nao_confirmada');
  console.log(JSON.stringify({workflow:WORKFLOW_LEADS,operacao:'atualizacao_LEADS_somente_GET',publicado:true,versao_anterior:original.versionId,versao:after.versionId,credencial_preservada:true,diagnostico_preservado:true,backup:dir+'/original.json'}));
 }else console.log(JSON.stringify({workflow:WORKFLOW_LEADS,dry_run:true,versao:original.versionId,diagnostico_preservado:true}));
}catch(e){
 if(dir&&original){try{fs.writeFileSync(dir+'/restore.json',JSON.stringify([original]),{mode:0o600});cli(['import:workflow','--input='+dir+'/restore.json']);if(original.active)cli(['publish:workflow','--id='+WORKFLOW_LEADS]);}catch{console.log(JSON.stringify({erro:'verificar_backup_e_restauracao',backup:dir+'/original.json'}));}}
 const conhecido=['versao_divergiu','ramo_existente_alterado','workflow_leads_incorreto','workflow_leads_divergiu','publicacao_nao_confirmada'].includes(e?.message)?e.message:'falha_cli_ou_parse';
 console.log(JSON.stringify({erro:'atualizacao_LEADS_nao_concluida',motivo:conhecido,classe:e?.name,codigo:typeof e?.code==='string'?e.code:null}));process.exitCode=1;
}`;
const r=spawnSync('ssh',['-i',process.env.HARVEST_SSH_KEY??process.env.HOME+'/.ssh/figueira_agencia_ed25519','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','root@77.37.40.97','docker','exec','-i',container,'node','-'],{input:script,encoding:'utf8',timeout:120000,maxBuffer:1048576});
process.stdout.write(r.stdout??'');if(r.error)throw Error('operacao_timeout_verificar_versao');process.exitCode=r.status??1;
