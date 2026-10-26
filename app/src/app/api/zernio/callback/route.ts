import {NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/supabase/server';
import {zernio} from '@/lib/crmZernio';
const voltar=(resultado:string)=>NextResponse.redirect(
 'https://harvest.figueiramarketing.com.br/configuracoes?aba=integracoes&zernio_oauth='+resultado);
export async function GET(req:Request){
 const u=new URL(req.url),state=u.searchParams.get('state');
 if(!state||!/^[0-9a-f-]{36}$/i.test(state))return voltar('erro');
 const db=supabaseAdmin();
 const {data:estado}=await db.from('crm_zernio_estados').select('*').eq('id',state)
  .is('consumido_em',null).gt('expira_em',new Date().toISOString()).maybeSingle();
 if(!estado)return voltar('erro');
 if(u.searchParams.get('error'))return voltar('erro');
 const accountId=u.searchParams.get('accountId');
 const profileId=u.searchParams.get('profileId');
 const plataforma=u.searchParams.get('connected');
 if(!accountId||!profileId||profileId!==estado.perfil_zernio||
  plataforma!==(estado.plataforma==='instagram_dm'?'instagram':'facebook'))
  return voltar('erro');
 try{
  // O callback é público: não confiar apenas nos parâmetros fornecidos pelo navegador.
  // Consultar a conta no provedor antes de gravar o vínculo na workspace.
  const lista=await zernio('accounts?profileId='+encodeURIComponent(estado.perfil_zernio));
  const contas=Array.isArray(lista?.accounts)?lista.accounts:[];
  const conta=contas.find((c:{_id?:string;profileId?:string|{_id:string};platform?:string;isActive?:boolean})=>
   c._id===accountId&&c.platform===plataforma&&c.isActive===true&&
   (typeof c.profileId==='string'?c.profileId:c.profileId?._id)===estado.perfil_zernio);
  if(!conta)return voltar('erro');
  const {data:fonte,error}=await db.from('crm_fontes_funil').update({
   zernio_account_id:accountId,zernio_profile_id:estado.perfil_zernio,
   identificador_externo:accountId,
   nome:(plataforma==='instagram'?'Instagram':'Facebook')+' · '+(conta.username||conta.displayName||accountId),
   status:'aguardando_autorizacao',atualizado_em:new Date().toISOString()
  }).eq('id',estado.fonte_id).eq('conta_id',estado.conta_id)
   .eq('funil_id',estado.funil_id).eq('tipo',estado.plataforma).neq('status','pausado')
   .select('id').maybeSingle();
  if(error||!fonte)return voltar('erro');
  await db.from('crm_zernio_estados').update({consumido_em:new Date().toISOString()})
   .eq('id',state).is('consumido_em',null);
  return voltar('ok');
 }catch{return voltar('erro');}
}
