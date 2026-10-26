'use client';
import {useEffect} from 'react';
import Link from 'next/link';
export default function MetaConcluido({resultado}:{resultado:string}){
 useEffect(()=>{
  if(typeof window==='undefined')return;
  if(window.opener){
   window.opener.postMessage({tipo:'harvest-meta-oauth',resultado},window.location.origin);
   if(resultado==='ok')window.close();
   return;
  }
  // Jornada de cliente: o login foi feito na mesma aba, sem pop-up.
  const url='/configuracoes?aba=integracoes&meta_oauth='+(resultado==='ok'?'ok':'erro');
  window.location.replace(url);
 },[resultado]);
 return <main className="pagina" style={{maxWidth:520,padding:26}}>
  <h1>{resultado==='ok'?'Conta autorizada':'Conexão não concluída'}</h1>
  <p>{resultado==='ok'
   ?'Retornando às integrações. O recebimento de mensagens depende da assinatura do webhook.'
   :'Retornando às integrações para revisar a autorização.'}</p>
  <Link href={'/configuracoes?aba=integracoes&meta_oauth='+(resultado==='ok'?'ok':'erro')}>Voltar às integrações</Link>
 </main>;
}
