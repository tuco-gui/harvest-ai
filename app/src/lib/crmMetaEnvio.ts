import {decifrarMeta,VERSAO_META} from './crmMetaOAuth';
export async function enviarRespostaMeta(entrada:{
 tipo:'instagram_dm'|'facebook_messenger';tokenCifrado:string;
 contaExternaId:string;destinatarioId:string;texto:string;
}):Promise<string>{
 const {tipo,tokenCifrado,contaExternaId,destinatarioId,texto}=entrada;
 if(!/^\d{8,30}$/.test(contaExternaId)||!/^\d{8,30}$/.test(destinatarioId))
  throw Error('Identidade de mensagem Meta inválida.');
 const destino=tipo==='instagram_dm'?'https://graph.instagram.com':
  'https://graph.facebook.com';
 const url=destino+'/'+VERSAO_META+'/'+contaExternaId+'/messages';
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),14000);
 try{
  const r=await fetch(url,{
   method:'POST',signal:controller.signal,
   headers:{Authorization:'Bearer '+decifrarMeta(tokenCifrado),
    'Content-Type':'application/json'},
   body:JSON.stringify({
    ...(tipo==='facebook_messenger'?{messaging_type:'RESPONSE'}:{}),
    recipient:{id:destinatarioId},message:{text:texto},
   }),
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data||data.error)
   throw Error('Meta recusou a resposta. Confira janela de mensagens e permissões.');
  const mid=String(data.message_id??'');
  if(!mid||mid.length>250)throw Error('Meta não confirmou ID de envio.');
  return mid;
 }finally{clearTimeout(timer);}
}
