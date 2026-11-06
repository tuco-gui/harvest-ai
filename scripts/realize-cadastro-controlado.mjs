import {spawnSync} from 'node:child_process';
import {iniciarConsultaLeads,consumirPaginaLeads,consultarLeadsPaginado} from '../app/src/lib/superlogicaLeads.mjs';
import {telefoneCRM,adaptarLeadParaChild,analisarConsultaLeads} from '../app/src/lib/superlogicaContrato.mjs';
if(!process.argv.includes('--cadastro-controlado'))throw Error('Exige --cadastro-controlado explícito');
const container=process.env.REALIZE_N8N_CONTAINER;
if(!container||!/^[a-zA-Z0-9_.-]+$/.test(container))throw Error('Defina REALIZE_N8N_CONTAINER existente');
const script=`const{execFileSync}=require('node:child_process');const fs=require('node:fs');const crypto=require('node:crypto');
${iniciarConsultaLeads.toString()}
${consumirPaginaLeads.toString()}
${consultarLeadsPaginado.toString()}
${telefoneCRM.toString()}
${adaptarLeadParaChild.toString()}
${analisarConsultaLeads.toString()}
const cli=args=>execFileSync('n8n',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const array=s=>JSON.parse(s.slice(s.search(/\\[\\s*\\{/)));
const cred=(id,type)=>{const c=array(cli(['export:credentials','--id='+id,'--decrypted']))[0];if(c.id!==id||c.type!==type)throw Error('credencial_incorreta');return c.data;};
const wf=id=>array(cli(['export:workflow','--id='+id]))[0];
(async()=>{let postTentado=false;try{
 const teste=wf('eb7ff4f5886085e98c2569f5');
 if(teste.active||!teste.name.startsWith('TESTE CONTROLADO - REALIZE'))throw Error('teste_nao_controlado');
 const telefone=telefoneCRM(teste.nodes.find(n=>n.name==='Realize - Configuracao')?.parameters.assignments?.assignments?.find(a=>a.name==='destinatario')?.value);
 if(!telefone)throw Error('contato_de_teste_nao_identificado');
 const hash=crypto.createHash('sha256').update(telefone).digest('hex');
 const arquivo='/tmp/harvest-realize-cadastro-controlado.json';let checkpoint;
 if(fs.existsSync(arquivo)){checkpoint=JSON.parse(fs.readFileSync(arquivo,'utf8'));if(checkpoint.contato_hash!==hash)throw Error('checkpoint_outro_contato');}
 else checkpoint={contato_hash:hash,protocolo:'HARVEST-QA-'+crypto.randomUUID(),post_reservado:false};
 const p={acao:'consultar',tenant_id:'11111111-1111-4111-8111-111111111111',idempotency_key:checkpoint.protocolo,codigo_anuncio:'CA0653_MMOL',telefone,email:''};
 const auth=cred('C0adNbEFeHge9Tjp','httpHeaderAuth');
 const consultar=()=>consultarLeadsPaginado(p,async({page,perPage})=>{const u=new URL('https://8cjlgzfyye.execute-api.sa-east-1.amazonaws.com/production/leads');u.searchParams.set('page',page);u.searchParams.set('perPage',perPage);
  const r=await fetch(u,{method:'GET',headers:{[auth.name]:auth.value},redirect:'error',signal:AbortSignal.timeout(20000)});return {statusCode:r.status,body:await r.json()};});
 let leitura=await consultar(),resultado=analisarConsultaLeads(p,leitura);
 if(resultado.status==='ausente'&&!checkpoint.post_reservado){
  const child=wf('njZxxrVJrrl6l96i'),http=child.nodes.find(n=>n.id==='618f1476-aa5f-47c9-ae90-9fd3fcae76f0');
  if(http?.parameters.url!=='https://sr3qgnognj.execute-api.sa-east-1.amazonaws.com/production/cliente'||http.credentials?.httpMultipleHeadersAuth?.id!=='fnEviCMC95D9xcA2')throw Error('child_ou_credencial_divergiu');
  const input=adaptarLeadParaChild({...p,cliente:'TESTE CONTROLADO HARVEST ALEA - NAO ABORDAR',midia:'Harvest homologacao controlada'});
  input.Origem='HOMOLOGACAO CONTROLADA - NAO ABORDAR';input.Campanha='Harvest PR46';
  const preparar=child.nodes.find(n=>n.id==='15916359-d071-4e3c-9497-47891316b8cb');
  const body=new Function('$input',preparar.parameters.jsCode)({all:()=>[{json:input}]})[0].json;
  if(body.codigo_anuncio!=='CA0653_MMOL'||body.telefone!==telefone||!body.comentarioLead.includes(checkpoint.protocolo))throw Error('contrato_child_invalido');
  const escrita=cred('fnEviCMC95D9xcA2','httpMultipleHeadersAuth');const headers={'Content-Type':'application/json'};
  for(const h of escrita.headers?.values??[])headers[h.name]=h.value;
  if(Object.keys(headers).length<2)throw Error('headers_credencial_ausentes');
  // Exclusão mútua também entre duas execuções simultâneas do harness.
  fs.writeFileSync(arquivo+'.post-reservado',JSON.stringify({protocolo:checkpoint.protocolo,reservado_em:new Date().toISOString()}),{mode:0o600,flag:'wx'});
  checkpoint.post_reservado=true;checkpoint.reservado_em=new Date().toISOString();
  fs.writeFileSync(arquivo,JSON.stringify(checkpoint),{mode:0o600,flag:fs.existsSync(arquivo)?'w':'wx'});
  postTentado=true;let status;
  try{const r=await fetch(http.parameters.url,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});status=r.status;await r.arrayBuffer();}catch{status=0;}
  checkpoint.status_http_escrita=status;fs.writeFileSync(arquivo,JSON.stringify(checkpoint),{mode:0o600});
  for(let i=0;i<3;i++){await new Promise(r=>setTimeout(r,2000));leitura=await consultar();resultado=analisarConsultaLeads(p,leitura);if(resultado.status==='cadastrado')break;}
 }
 if(resultado.status==='cadastrado'){
  checkpoint.id_superlogica=resultado.id_superlogica;checkpoint.confirmado_em=new Date().toISOString();fs.writeFileSync(arquivo,JSON.stringify(checkpoint),{mode:0o600});
 }
 console.log(JSON.stringify({operacao:'homologacao_cadastro_controlado',confirmado_crm:resultado.status==='cadastrado',status:resultado.status,erro:resultado.erro??leitura.erro??null,id_superlogica:resultado.id_superlogica??null,protocolo:checkpoint.protocolo,post_nesta_execucao:postTentado,status_http_escrita:checkpoint.status_http_escrita??null,consulta_completa:leitura.completa,total:leitura.total,paginas_lidas:leitura.paginas_lidas,whatsapp_enviado:false,planilha_alterada:false}));
 if(resultado.status!=='cadastrado')process.exitCode=2;
}catch{console.log(JSON.stringify({operacao:'homologacao_cadastro_controlado',confirmado_crm:false,post_nesta_execucao:postTentado,erro:'homologacao_nao_confirmada_sem_dados_sensiveis'}));process.exitCode=1;}})();`;
const r=spawnSync('ssh',['-i',process.env.HARVEST_SSH_KEY??process.env.HOME+'/.ssh/figueira_agencia_ed25519','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','root@77.37.40.97','docker','exec','-i',container,'node','-'],{input:script,encoding:'utf8',timeout:300000,maxBuffer:1048576});
process.stdout.write(r.stdout??'');if(r.error)throw Error('verificar_checkpoint_antes_de_repetir');process.exitCode=r.status??1;
