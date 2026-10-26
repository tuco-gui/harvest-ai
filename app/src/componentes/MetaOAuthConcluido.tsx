'use client';
import {useEffect} from 'react';
export default function MetaConcluido({resultado}:{resultado:string}){
 useEffect(()=>{
  if(typeof window==='undefined')return;
  window.opener?.postMessage({tipo:'harvest-meta-oauth',resultado},window.location.origin);
  if(resultado==='ok'&&window.opener)window.close();
 },[resultado]);
 return <main className="pagina" style={{maxWidth:520,padding:26}}>
  <h1>{resultado==='ok'?'Conta autorizada':'Conexão não concluída'}</h1>
  <p>{resultado==='ok'
   ?'A conta foi vinculada ao funil. A fonte só ficará operacional quando o webhook oficial receber mensagens assinadas.'
   :'Verifique as permissões do aplicativo Meta e tente novamente dentro de Fontes de lead.'}</p>
  <button type="button" className="btn-primario" onClick={()=>window.close()}>Fechar janela</button>
 </main>;
}
