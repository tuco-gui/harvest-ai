import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {isAdmin} from '@/lib/crmControleAcesso';
import {perfilTemModulo} from '@/lib/autorizacao';
import {assinarFonte} from '@/lib/crmZernioWebhook';
export async function POST(req:Request){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return NextResponse.json({erro:'Autenticação necessária.'},{status:401});
 if(!isAdmin(perfil.papel))return NextResponse.json({erro:'Permissão insuficiente.'},{status:403});
 const db=supabaseAdmin();
 if(!(await perfilTemModulo(db,perfil,'crm_avancado')))
  return NextResponse.json({erro:'CRM não habilitado.'},{status:403});
 const b=await req.json().catch(()=>null);
 if(typeof b?.fonte_id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.fonte_id))
  return NextResponse.json({erro:'Fonte inválida.'},{status:400});
 const {data:fonte}=await db.from('crm_fontes_funil')
  .select('id,conta_id,tipo,status,zernio_account_id,zernio_profile_id,zernio_webhook_id')
  .eq('id',b.fonte_id).eq('conta_id',perfil.conta_id).maybeSingle();
 if(!fonte||fonte.status==='pausado'||!['instagram_dm','facebook_messenger'].includes(fonte.tipo))
  return NextResponse.json({erro:'Fonte indisponível.'},{status:404});
 if(!fonte.zernio_account_id||!fonte.zernio_profile_id)
  return NextResponse.json({erro:'Autorize a conta primeiro.'},{status:409});
 try{
  const webhookId=await assinarFonte(fonte.id,fonte.zernio_profile_id,fonte.zernio_account_id);
  const {error}=await db.from('crm_fontes_funil').update({zernio_webhook_id:webhookId})
   .eq('conta_id',perfil.conta_id).eq('id',fonte.id);
  if(error)return NextResponse.json({erro:'Webhook criado, mas confirmação local falhou.'},{status:503});
  return NextResponse.json({ok:true,assinatura:'inscrita'});
 }catch(e){
  return NextResponse.json({erro:e instanceof Error?e.message:'Falha no webhook Zernio.'},{status:502});
 }
}
