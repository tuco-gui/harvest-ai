import {NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/supabase/server';
import {configuracaoMeta,segredoMeta,verificarAssinaturaMeta,tokenVerificacaoMeta} from '@/lib/crmMetaOAuth';
import {extrairMensagensMeta,gravarMensagemMeta} from '@/lib/crmMetaInbound';

export async function GET(req:Request){
 const url=new URL(req.url);
 const token=tokenVerificacaoMeta();
 if(!token||url.searchParams.get('hub.mode')!=='subscribe'||
   url.searchParams.get('hub.verify_token')!==token)return new Response('Forbidden',{status:403});
 const challenge=url.searchParams.get('hub.challenge')??'';
 if(!/^\d{1,20}$/.test(challenge))return new Response('Invalid challenge',{status:400});
 return new Response(challenge,{status:200,headers:{'Content-Type':'text/plain'}});
}
export async function POST(req:Request){
 const tamanho=Number(req.headers.get('content-length')??0);
 if(tamanho>2_000_000)return new Response('Payload too large',{status:413});
 const bruto=Buffer.from(await req.arrayBuffer());
 if(bruto.length>2_000_000)return new Response('Payload too large',{status:413});
 let p:unknown;
 try{p=JSON.parse(bruto.toString('utf8'));}
 catch{return new Response('Invalid JSON',{status:400});}
 if(!p||typeof p!=='object')return new Response('Invalid payload',{status:400});
 const obj=(p as Record<string,unknown>).object;
 if(obj!=='instagram'&&obj!=='page'&&obj!=='whatsapp_business_account')
  return NextResponse.json({ok:true,ignorado:true});
 const tipo=obj==='instagram'?'instagram_dm':obj==='page'?'facebook_messenger':'whatsapp_cloud_api';
 // WhatsApp oficial usa o App Secret do app que hospeda o WABA; a conexão
 // por workspace continua identificada pelo phone_number_id da fonte.
 const secret=tipo==='whatsapp_cloud_api'?segredoMeta('app'):configuracaoMeta(tipo)?.secret;
 if(!secret||!verificarAssinaturaMeta(bruto,req.headers.get('x-hub-signature-256'),secret))
  return new Response('Unauthorized',{status:401});
 const mensagens=extrairMensagensMeta(p);
 const admin=supabaseAdmin();
 try{
  let recebidas=0;
  for(const m of mensagens){
   const status=await gravarMensagemMeta(admin,m);
   if(status==='gravada')recebidas++;
  }
  return NextResponse.json({ok:true,processadas:recebidas});
 }catch{
  // HTTP 503 permite retry automático da Meta. Nunca registrar payload/tokens.
  return new Response('Retry later',{status:503});
 }
}
