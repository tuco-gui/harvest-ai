import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
import {perfilZernio,zernio} from '@/lib/crmZernio';
export async function POST(req:Request){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return NextResponse.json({erro:'Faça login no Harvest.'},{status:401});
 if(!isAdmin(perfil.papel))return NextResponse.json({erro:'Somente administradores.'},{status:403});
 const db=supabaseAdmin();
 if(!(await perfilTemModulo(db,perfil,'crm_avancado')))
  return NextResponse.json({erro:'CRM não habilitado.'},{status:403});
 const body=await req.json().catch(()=>null);
 if(typeof body?.fonte_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.fonte_id))
  return NextResponse.json({erro:'Fonte inválida.'},{status:400});
 const {data:fonte}=await db.from('crm_fontes_funil').select('id,tipo,conta_id,funil_id,status')
  .eq('id',body.fonte_id).eq('conta_id',perfil.conta_id).maybeSingle();
 if(!fonte||!['instagram_dm','facebook_messenger'].includes(fonte.tipo)||fonte.status==='pausado')
  return NextResponse.json({erro:'Fonte indisponível.'},{status:404});
 try{
  const profileId=await perfilZernio(perfil.conta_id);
  const {data:estado,error}=await db.from('crm_zernio_estados').insert({
   conta_id:perfil.conta_id,fonte_id:fonte.id,funil_id:fonte.funil_id,
   plataforma:fonte.tipo,perfil_zernio:profileId
  }).select('id').single();
  if(error||!estado)return NextResponse.json({erro:'Falha ao registrar conexão da workspace.'},{status:503});
  const plataforma=fonte.tipo==='instagram_dm'?'instagram':'facebook';
  const callback='https://harvest.figueiramarketing.com.br/api/zernio/callback?state='+encodeURIComponent(estado.id);
  const username=typeof body?.username==='string'?body.username.trim().replace(/^@/,''):'';
  if(username&&!/^[a-zA-Z0-9._]{1,100}$/.test(username))
   return NextResponse.json({erro:'Usuário do Instagram inválido.'},{status:400});
  const params=new URLSearchParams({profileId,redirect_url:callback});
  if(plataforma==='instagram'){
   params.set('forceReauth','true');
   if(username)params.set('expectedUsername',username);
  }
  const result=await zernio('connect/'+plataforma+'?'+params.toString());
  const url=result?.authUrl;
  if(typeof url!=='string'||!url.startsWith('https://'))
   return NextResponse.json({erro:'Zernio não retornou um link seguro.'},{status:502});
  const hostname=new URL(url).hostname;
  if(!['www.facebook.com','facebook.com','www.instagram.com','instagram.com','zernio.com','www.zernio.com'].includes(hostname))
   return NextResponse.json({erro:'Domínio de autorização inesperado.'},{status:502});
  return NextResponse.json({url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  return NextResponse.json({erro:e instanceof Error?e.message:'Falha ao abrir autorização.'},{status:502});
 }
}
