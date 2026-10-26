import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {webhookSecret} from '@/lib/crmZernioWebhook';
import {supabaseAdmin} from '@/lib/supabase/server';
export const runtime='nodejs';
type Context={params:Promise<{fonte:string}>};
export async function POST(req:Request,{params}:Context){
 const id=(await params).fonte;
 if(!/^[0-9a-f-]{36}$/i.test(id))return new Response('Not found',{status:404});
 const raw=await req.text();
 if(raw.length>150000)return new Response('Too large',{status:413});
 const sig=req.headers.get('x-zernio-signature')??'';
 if(!/^[0-9a-f]{64}$/.test(sig))return new Response('Unauthorized',{status:401});
 let esperado:string;
 try{esperado=createHmac('sha256',webhookSecret(id)).update(raw).digest('hex');}
 catch{return new Response('Unavailable',{status:503});}
 if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(esperado,'hex')))
  return new Response('Unauthorized',{status:401});
 const p=JSON.parse(raw) as Record<string,any>;
 if(p.event==='webhook.test')return Response.json({ok:true});
 if(p.event!=='message.received')return Response.json({ok:true});
 const platform=p.account?.platform,accountId=p.account?.id,m=p.message;
 if(!['instagram','facebook'].includes(platform)||!accountId||!m||
  m.direction!=='incoming'||m.platform!==platform||!m.conversationId||
  typeof m.text!=='string'||!m.text.trim()||m.text.length>4000||
  !m.sender?.id||!m.id)return Response.json({ignored:true});
 const db=supabaseAdmin();
 const {data:fonte}=await db.from('crm_fontes_funil')
  .select('id,conta_id,tipo,zernio_account_id,status').eq('id',id)
  .eq('zernio_account_id',accountId).eq('tipo',platform==='instagram'?'instagram_dm':'facebook_messenger')
  .in('status',['aguardando_autorizacao','pronto']).maybeSingle();
 if(!fonte)return Response.json({ignored:true});
 const visitanteId=String(m.sender.id);
 if(visitanteId.length<10||visitanteId.length>100)return Response.json({ignored:true});
 let {data:conversa}=await db.from('crm_conversas_externas').select('id')
  .eq('conta_id',fonte.conta_id).eq('fonte_id',id).eq('visitante_id',visitanteId).maybeSingle();
 if(!conversa){
  const hash=createHash('sha256').update('zernio:'+id+':'+visitanteId).digest('hex');
  const criado=await db.from('crm_conversas_externas').insert({
   conta_id:fonte.conta_id,fonte_id:id,visitante_id:visitanteId,segredo_hash:hash,
   nome:String(m.sender.name||m.sender.username||'').slice(0,160)||null,
   zernio_conversation_id:m.conversationId
  }).select('id').maybeSingle();
  if(criado.error?.code==='23505'){
   const z=await db.from('crm_conversas_externas').select('id')
    .eq('conta_id',fonte.conta_id).eq('fonte_id',id).eq('visitante_id',visitanteId).maybeSingle();
   conversa=z.data;
  }else if(criado.error)return new Response('Storage error',{status:503});
  else conversa=criado.data;
 }
 if(!conversa)return new Response('Storage error',{status:503});
 const {error}=await db.from('crm_mensagens_externas').insert({
  conta_id:fonte.conta_id,conversa_id:conversa.id,direcao:'entrada',
  texto:m.text.trim(),mensagem_externa_id:'zernio:'+accountId+':'+String(m.platformMessageId||m.id)
 });
 if(error&&error.code!=='23505')return new Response('Storage error',{status:503});
 if(!error){
  const now=new Date().toISOString();
  await Promise.all([
   db.from('crm_conversas_externas').update({atualizado_em:now,zernio_conversation_id:m.conversationId})
    .eq('id',conversa.id).eq('conta_id',fonte.conta_id),
   db.from('crm_fontes_funil').update({status:'pronto',atualizado_em:now})
    .eq('id',id).eq('conta_id',fonte.conta_id)
  ]);
 }
 // A primeira conversa gera um lead no funil, caso a opção esteja habilitada.
 const {error:leadErro}=await db.rpc('crm_criar_negocio_primeira_conversa_social',{
  p_conta:fonte.conta_id,p_fonte:id,p_conversa:conversa.id
 });
 if(leadErro)return new Response('Lead persistence error',{status:503});
 return Response.json({ok:true});
}
