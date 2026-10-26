import {VERSAO_META} from './crmMetaOAuth';

/** Inscrição oficial da página já autorizada; nunca habilita outras páginas. */
export async function assinarMensagensMessenger(
 paginaId:string,tokenPagina:string,
):Promise<void>{
 if(!/^\d{8,30}$/.test(paginaId)||!tokenPagina)
  throw Error('Página ou credencial inválida.');
 const url='https://graph.facebook.com/'+VERSAO_META+'/'+paginaId+'/subscribed_apps';
 const body=new URLSearchParams({
  subscribed_fields:'messages,messaging_postbacks,message_deliveries,message_reads',
 });
 const ctl=new AbortController();
 const timer=setTimeout(()=>ctl.abort(),12000);
 try{
  const r=await fetch(url,{method:'POST',signal:ctl.signal,cache:'no-store',
   headers:{Authorization:'Bearer '+tokenPagina,
    'Content-Type':'application/x-www-form-urlencoded'},body});
  const d=await r.json().catch(()=>null);
  if(!r.ok||d?.error||d?.success!==true)
   throw Error('Meta não confirmou a assinatura do webhook desta página.');
 }finally{clearTimeout(timer);}
}
