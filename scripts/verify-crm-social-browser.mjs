/** Jornada autenticada; envio interceptado no navegador, nunca enviado ao cliente. */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../app/package.json',import.meta.url));
const {chromium}=require('playwright');
const {createServerClient}=require('@supabase/ssr');
const local=process.argv.includes('--local');
const base=local?'http://localhost:3100':'https://harvest.figueiramarketing.com.br';
const conta='d3b07384-d113-44f2-b578-1d8c5c3cf520';
const codigo=`(async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const key=process.env.SUPABASE_SERVICE_KEY;
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 const p=await fetch(url+'/rest/v1/perfis?select=email&papel=eq.super_admin&limit=1',{headers});
 const perfis=await p.json();if(!p.ok||!perfis[0]?.email)throw Error('Perfil QA indisponível');
 const link=await fetch(url+'/auth/v1/admin/generate_link',{method:'POST',headers,body:JSON.stringify({type:'magiclink',email:perfis[0].email})});
 const l=await link.json();if(!link.ok||!l.hashed_token)throw Error('Autenticação QA indisponível');
 const v=await fetch(url+'/auth/v1/verify',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({type:'magiclink',token_hash:l.hashed_token})});
 const s=await v.json();if(!v.ok||!s.access_token)throw Error('Sessão QA indisponível');
 process.stdout.write(JSON.stringify({url,anon,access_token:s.access_token,refresh_token:s.refresh_token${local?',key':''}}));
})().catch(()=>{process.stderr.write('Falha ao abrir sessão QA temporária');process.exitCode=1;});`;
const remote=spawnSync('ssh',['-i',process.env.HOME+'/.ssh/figueira_agencia_ed25519','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','root@77.37.40.97',
 'docker exec -i $(docker ps -q --filter label=com.docker.swarm.service.name=harvest_harvest) node'],{input:codigo,encoding:'utf8',timeout:30000});
if(remote.status!==0)throw Error('Não foi possível obter sessão temporária de QA.');
const creds=JSON.parse(remote.stdout);
const jar=[];
const sb=createServerClient(creds.url,creds.anon,{cookies:{getAll:()=>jar,setAll:values=>jar.push(...values)}});
await sb.auth.setSession({access_token:creds.access_token,refresh_token:creds.refresh_token});
let server;
if(local){
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100'],{
  cwd:new URL('../app/',import.meta.url),stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:creds.url,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:creds.anon,SUPABASE_SERVICE_KEY:creds.key},
 });
 for(let i=0;i<60;i++){
  try{if((await fetch(base+'/entrar')).ok)break;}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies([...jar.map(c=>({name:c.name,value:c.value,url:base,httpOnly:true,sameSite:'Lax'})),
  {name:'harvest_conta',value:conta,url:base,httpOnly:true,sameSite:'Lax'}]);
 const api=await context.request.get(base+'/api/crm/oportunidades/26/mensagens');
 assert.equal(api.status(),200);
 const dados=await api.json();assert(dados.conversaExterna?.id,'Negócio não retornou atendimento social');
 assert(dados.mensagens.length>0,'Histórico não apareceu');
 const detalhe=await context.request.get(base+'/api/crm/conversas-externas/'+dados.conversaExterna.id);
 const social=await detalhe.json();assert.equal(social.oportunidade.id,26);
 assert(social.conversa.contato_id,'Contato social ausente');
 const timeline=await context.request.get(base+'/api/crm/oportunidades/26/timeline');
 const historico=await timeline.json();assert(historico.eventos.some(e=>e.id.startsWith('social-')));
 const page=await context.newPage();
 await page.goto(base+'/crm?oportunidade=26');
 const resposta=page.getByRole('textbox',{name:'Responder no Instagram'});
 await resposta.waitFor({state:'visible',timeout:30000});assert(await resposta.isEnabled());
 await page.getByRole('link',{name:'Abrir na Inbox'}).waitFor();
 const screenshot=process.env.HARVEST_QA_SCREENSHOT;
 if(screenshot)await page.screenshot({path:screenshot,fullPage:true});
 let enviado=false;
 await page.route('**/api/crm/conversas-externas/*',async route=>{
  if(route.request().method()!=='POST')return route.continue();
  const body=route.request().postDataJSON();assert(body.idempotencia);assert(!body.telefone);
  enviado=true;return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({mensagem:{
   id:'qa-interceptado',direcao:'saida',texto:body.texto,criado_em:new Date().toISOString(),status_envio:'enviado',
  }})});
 });
 await resposta.fill('Teste de interface interceptado — não enviar ao cliente');
 await page.getByRole('button',{name:'Enviar resposta',exact:true}).click();
 await page.getByText('Teste de interface interceptado — não enviar ao cliente',{exact:true}).waitFor();
 assert(enviado);
 await page.getByRole('link',{name:'Abrir na Inbox'}).click();
 await page.getByRole('link',{name:'Abrir negócio #26'}).waitFor({timeout:30000});
 await context.close();
 console.log('PASS: #26 autenticado — histórico Instagram, timeline, contato, composer sem telefone e navegação Inbox/CRM. Envio interceptado; nenhuma mensagem real enviada.');
}finally{
 await browser?.close();server?.kill();await sb.auth.signOut({scope:'local'});
}
