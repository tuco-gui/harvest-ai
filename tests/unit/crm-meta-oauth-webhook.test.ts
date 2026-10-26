import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {cifrarMeta,decifrarMeta,verificarAssinaturaMeta,urlAutorizacaoMeta}
 from '../../app/src/lib/crmMetaOAuth.ts';
import {extrairMensagensMeta} from '../../app/src/lib/crmMetaInbound.ts';
process.env.HARVEST_META_TOKEN_KEY='a'.repeat(64);
process.env.HARVEST_INSTAGRAM_APP_ID='1234';
process.env.HARVEST_INSTAGRAM_APP_SECRET='test_secret_ig';
process.env.HARVEST_META_APP_ID='5678';
process.env.HARVEST_META_APP_SECRET='test_secret_fb';
const token='nao-expor-segredo-de-acesso';
const cifrado=cifrarMeta(token);
assert.notEqual(cifrado,token);
assert(!cifrado.includes(token));
assert.equal(decifrarMeta(cifrado),token);
assert.notEqual(cifrarMeta(token),cifrado,'AES GCM deve usar nonce aleatório');
assert.throws(()=>decifrarMeta(cifrado.slice(0,-2)+'XX'));
const body=Buffer.from('{"object":"instagram","entry":[]}');
const mac=createHmac('sha256','test_secret_ig').update(body).digest('hex');
assert(verificarAssinaturaMeta(body,'sha256='+mac,'test_secret_ig'));
assert(!verificarAssinaturaMeta(Buffer.from('alterado'),'sha256='+mac,'test_secret_ig'));
assert(!verificarAssinaturaMeta(body,'sha256='+mac,'segredoErrado'));
assert(!verificarAssinaturaMeta(body,null,'test_secret_ig'));
const linkIG=new URL(urlAutorizacaoMeta('instagram_dm','state-aleatorio'));
assert.equal(linkIG.hostname,'www.instagram.com');
assert(linkIG.searchParams.get('scope')?.includes('instagram_business_manage_messages'));
assert.equal(linkIG.searchParams.get('state'),'state-aleatorio');
const linkFB=new URL(urlAutorizacaoMeta('facebook_messenger','state-aleatorio'));
assert(linkFB.searchParams.get('scope')?.includes('pages_messaging'));
const p={
 object:'instagram',entry:[{id:'17841401440843332',
 messaging:[{sender:{id:'123456789012345'},recipient:{id:'17841401440843332'},
   message:{mid:'mid.001',text:'Olá equipe'}},
  {sender:{id:'123456789012345'},recipient:{id:'17841401440843332'},
   message:{mid:'mid.002',text:'eco',is_echo:true}},
  {sender:{id:'123456789012345'},recipient:{id:'17841401440843332'},
   message:{mid:'mid.003',text:''}},
 ]}]};
const eventos=extrairMensagensMeta(p);
assert.equal(eventos.length,2);
assert.equal(eventos[0].plataforma,'instagram_dm');
assert.equal(eventos[0].mensagemId,'mid.001');
assert.equal(eventos[1].enviadaPelaConta,true);
assert.equal(extrairMensagensMeta({...p,object:'unknown'}).length,0);
assert.equal(extrairMensagensMeta({object:'page',entry:[
 {id:'108734267956019',messaging:[{sender:{id:'998877665544'},recipient:{id:'108734267956019'},
 message:{mid:'msg-1',text:'Teste Messenger'}}]}]}).length,1);
const src=(p:string)=>readFileSync(p,'utf8');
const start=src('app/src/app/api/meta/oauth/iniciar/route.ts');
const cb=src('app/src/app/api/meta/oauth/callback/[plataforma]/route.ts');
const reply=src('app/src/app/api/crm/conversas-externas/[id]/route.ts');
const webhook=src('app/src/app/api/webhook/meta-mensagens/route.ts');
const fonte=src('app/src/app/api/funis/[id]/fontes/route.ts');
const sql=src('sql/046_meta_oauth_mensagens.sql');
assert.match(start,/perfilTemModulo\(admin,perfil,'crm_avancado'\)/);
assert.match(start,/fonte\.status==='pausado'/);
assert.match(cb,/\.eq\('perfil_id',perfil\.id\)/);
assert.match(cb,/\.gt\('expira_em'/);
assert.match(cb,/meta_token_cifrado:cifrarMeta/);
assert.match(webhook,/verificarAssinaturaMeta\(bruto/);
assert.match(webhook,/gravarMensagemMeta/);
assert.match(reply,/24\*3600\*1000/);
assert.match(reply,/idempotencia/);
assert.match(reply,/status_envio:'pendente'/);
assert.match(reply,/status_envio:'falhou'/);
assert.match(fonte,/meta_autorizado:Boolean\(meta_token_cifrado\)/);
assert.match(sql,/ALTER TABLE public\.crm_meta_oauth_estados ENABLE ROW LEVEL SECURITY/);
assert.match(sql,/meta_token_cifrado/);
console.log('Meta OAuth: HMAC, AES-GCM, workspace, webhook, idempotência e janela de resposta OK');
