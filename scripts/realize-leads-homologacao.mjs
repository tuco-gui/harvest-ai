import {spawnSync} from 'node:child_process';
import {iniciarConsultaLeads,consumirPaginaLeads,consultarLeadsPaginado} from '../app/src/lib/superlogicaLeads.mjs';
// GET somente. A credencial é utilizada dentro do container n8n, em memória;
// nunca retorna ao processo local, ao repositório ou aos logs do harness.
const container=process.env.REALIZE_N8N_CONTAINER;
if(!container||!/^[a-zA-Z0-9_.-]+$/.test(container))throw Error('Defina REALIZE_N8N_CONTAINER existente');
const script=`const {execFileSync}=require('node:child_process');
${iniciarConsultaLeads.toString()}
${consumirPaginaLeads.toString()}
${consultarLeadsPaginado.toString()}
(async()=>{
 try{
  const raw=execFileSync('n8n',['export:credentials','--id=C0adNbEFeHge9Tjp','--decrypted'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const start=raw.indexOf('[{')>=0?raw.indexOf('[{'):raw.indexOf('[\\n');
  const c=JSON.parse(raw.slice(start))[0];
  if(c.id!=='C0adNbEFeHge9Tjp'||c.type!=='httpHeaderAuth'||!c.data?.name||!c.data?.value)throw Error('credencial_invalida');
  const p={acao:'consultar',tenant_id:'11111111-1111-4111-8111-111111111111',idempotency_key:'diagnostico-get',codigo_anuncio:'CA0653_MMOL',email:'harvest-controlled-read@example.invalid'};
  let estrutura,invalido;
  const r=await consultarLeadsPaginado(p,async({page,perPage})=>{
   const u=new URL('https://8cjlgzfyye.execute-api.sa-east-1.amazonaws.com/production/leads');u.searchParams.set('page',page);u.searchParams.set('perPage',perPage);
   const x=await fetch(u,{method:'GET',headers:{[c.data.name]:c.data.value},redirect:'error',signal:AbortSignal.timeout(20000)});
   const body=await x.json();if(!estrutura)estrutura={campos:Object.keys(body??{}),paginacao:Object.fromEntries(['total','page','perPage','lastPage'].map(k=>[k,{tipo:typeof body?.[k],valor:body?.[k]}])),data_array:Array.isArray(body?.data)};
   if(!invalido&&Array.isArray(body?.data)){const i=body.data.findIndex(r=>!r||!['string','number'].includes(typeof r.id)||!String(r.id).trim()||String(r.id).length>128||(typeof r.id==='number'&&(!Number.isSafeInteger(r.id)||r.id<1))||!Array.isArray(r.imoveis)||r.imoveis.some(v=>!v||typeof v.codigo!=='string'));if(i>=0){const r=body.data[i];invalido={page,index:i,id_tipo:typeof r?.id,imoveis_array:Array.isArray(r?.imoveis),tipos_codigos:Array.isArray(r?.imoveis)?r.imoveis.map(v=>typeof v?.codigo):[]};}}
   return {statusCode:x.status,body};
  });
  console.log(JSON.stringify({operacao:'GET_LEADS',completa:r.completa,status_http:r.status_http,total:r.total,paginas_lidas:r.paginas_lidas,perPage:r.perPage,lastPage:r.lastPage,erro:r.erro??null,credencial:'C0adNbEFeHge9Tjp',...(!r.completa?{estrutura,invalido}:{})}));
 }catch{console.log(JSON.stringify({operacao:'GET_LEADS',completa:false,erro:'homologacao_leitura_falhou_sem_detalhes_sensiveis'}));process.exitCode=1;}
})();`;
const r=spawnSync('ssh',['-i',process.env.HARVEST_SSH_KEY??process.env.HOME+'/.ssh/figueira_agencia_ed25519','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','root@77.37.40.97','docker','exec','-i',container,'node','-'],{input:script,encoding:'utf8',timeout:180000,maxBuffer:1048576});
process.stdout.write(r.stdout??'');if(r.error)throw Error('harness_get_timeout');process.exitCode=r.status??1;
