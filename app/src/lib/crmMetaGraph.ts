import {configuracaoMeta,redirectUriMeta,VERSAO_META,type PlataformaMeta} from './crmMetaOAuth';

async function obterJson(url:string, init:RequestInit={},timeout=10000):Promise<Record<string,any>>{
 const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const resp=await fetch(url,{...init,signal:ctrl.signal,cache:'no-store'});
  const dado=await resp.json().catch(()=>null);
  if(!resp.ok||!dado||dado.error)throw Error('Meta não confirmou autorização. Verifique permissões e app review.');
  return dado as Record<string,any>;
 }finally{clearTimeout(t);}
}
export async function trocarCodigoMeta(tipo:PlataformaMeta,code:string):
 Promise<{token:string;expiraEm:string|null;escopos:string[]}>{
 const config=configuracaoMeta(tipo);
 if(!config)throw Error('OAuth Meta não configurado.');
 const instagram=tipo==='instagram_dm';
 if(instagram){
  const p=new URLSearchParams({client_id:config.id,client_secret:config.secret,
   grant_type:'authorization_code',redirect_uri:redirectUriMeta(tipo),code});
  const curto=await obterJson('https://api.instagram.com/oauth/access_token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p,
  });
  if(typeof curto.access_token!=='string'||!curto.user_id)
   throw Error('Meta não retornou credenciais profissionais.');
  const granted=Array.isArray(curto.permissions)?curto.permissions.map(String):
   typeof curto.permissions==='string'?curto.permissions.split(',').map((x:string)=>x.trim()):[];
  if(!granted.includes('instagram_business_manage_messages'))
   throw Error('Autorize instagram_business_manage_messages para receber e responder DMs.');
  const u=new URL('https://graph.instagram.com/access_token');
  u.searchParams.set('grant_type','ig_exchange_token');u.searchParams.set('client_secret',config.secret);
  u.searchParams.set('access_token',curto.access_token);
  const longo=await obterJson(u.toString());
  const token=String(longo.access_token||'');
  if(!token)throw Error('Meta não forneceu token de longa duração.');
  const duracao=Number(longo.expires_in||0);
  return {token,expiraEm:duracao>0?new Date(Date.now()+duracao*1000).toISOString():null,
   escopos:granted};
 }
 const u=new URL('https://graph.facebook.com/'+VERSAO_META+'/oauth/access_token');
 u.searchParams.set('client_id',config.id);u.searchParams.set('client_secret',config.secret);
 u.searchParams.set('redirect_uri',redirectUriMeta(tipo));u.searchParams.set('code',code);
 const resultado=await obterJson(u.toString());
 if(typeof resultado.access_token!=='string'||!resultado.access_token)
  throw Error('Meta não forneceu token Facebook.');
 return {token:resultado.access_token,expiraEm:resultado.expires_in?
  new Date(Date.now()+Number(resultado.expires_in)*1000).toISOString():null,escopos:[]};
}
export async function contaInstagram(token:string):
 Promise<{id:string;nome:string}>{
 const url=new URL('https://graph.instagram.com/'+VERSAO_META+'/me');
 url.searchParams.set('fields','id,username,account_type');
 const d=await obterJson(url.toString(),{headers:{Authorization:'Bearer '+token}});
 if(!/^\d{8,30}$/.test(String(d.id||'')))throw Error('Instagram profissional não identificado.');
 return {id:String(d.id),nome:String(d.username||d.id)};
}
export async function paginasFacebook(token:string):
 Promise<Array<{id:string;nome:string;token:string}>>{
 const url=new URL('https://graph.facebook.com/'+VERSAO_META+'/me/accounts');
 url.searchParams.set('fields','id,name,access_token,tasks');
 url.searchParams.set('limit','100');
 const d=await obterJson(url.toString(),{headers:{Authorization:'Bearer '+token}});
 return (Array.isArray(d.data)?d.data:[]).filter(p=>
  /^\d{8,30}$/.test(String(p.id||''))&&typeof p.access_token==='string'&&
  Array.isArray(p.tasks)&&p.tasks.some((x:string)=>['MESSAGING','MODERATE'].includes(x))
 ).map(p=>({id:String(p.id),nome:String(p.name||p.id),token:p.access_token}));
}
