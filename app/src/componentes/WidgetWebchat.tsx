'use client';
import {useEffect,useState} from 'react';

type Mensagem={id:string;direcao:'entrada'|'saida';texto:string;criado_em:string};
function gerarSegredo(){
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
export default function WidgetWebchat({token}:{token:string}){
 const [nomeCanal,setNomeCanal]=useState('Atendimento');
 const [nome,setNome]=useState('');
 const [visitante,setVisitante]=useState('');
 const [segredo,setSegredo]=useState('');
 const [texto,setTexto]=useState('');
 const [mensagens,setMensagens]=useState<Mensagem[]>([]);
 const [enviando,setEnviando]=useState(false);
 const [erro,setErro]=useState('');
 const [ativo,setAtivo]=useState(true);
 useEffect(()=>{
  const key='harvest-webchat:'+token;
  try{
   const anterior=JSON.parse(localStorage.getItem(key)||'null');
   if(anterior&&typeof anterior.id==='string'&&/^[0-9a-f-]{36}$/i.test(anterior.id)
      &&typeof anterior.secret==='string'&&/^[0-9a-f]{64}$/i.test(anterior.secret)){
     setVisitante(anterior.id);setSegredo(anterior.secret);return;
   }
   const novo={id:crypto.randomUUID(),secret:gerarSegredo()};
   localStorage.setItem(key,JSON.stringify(novo));
   setVisitante(novo.id);setSegredo(novo.secret);
  }catch{
   setVisitante(crypto.randomUUID());setSegredo(gerarSegredo());
  }
 },[token]);
 useEffect(()=>{
  if(!visitante||!segredo)return;
  const ctrl=new AbortController();
  const ler=async()=>{
   try{
    const p=new URLSearchParams({visitante,segredo});
    const r=await fetch('/api/publico/webchat/'+token+'?'+p,{cache:'no-store',signal:ctrl.signal});
    const d=await r.json();
    if(!r.ok){if(!ctrl.signal.aborted)setErro(d.erro||'Conversa indisponível.');return;}
    if(!ctrl.signal.aborted){setNomeCanal(d.nome||'Atendimento');setMensagens(d.mensagens||[]);setErro('');}
   }catch{}
  };
  void ler();
  const tempo=setInterval(()=>void ler(),12000);
  return()=>{ctrl.abort();clearInterval(tempo)};
 },[token,visitante,segredo]);
 async function enviar(e:React.FormEvent){
  e.preventDefault();
  if(!texto.trim()||enviando||!visitante||!segredo)return;
  setEnviando(true);setErro('');
  try{
   const r=await fetch('/api/publico/webchat/'+token,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({visitante,segredo,texto:texto.trim(),nome:nome.trim()}),
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Não foi possível enviar.');
   setMensagens(a=>a.concat(d.mensagem));setTexto('');
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao enviar mensagem.');}
  finally{setEnviando(false);}
 }
 return <main className="widget-webchat" aria-label={'Conversa com '+nomeCanal}>
  <header className="widget-webchat-topo">
   <div><strong>{nomeCanal}</strong><small>Fale com nossa equipe</small></div>
   <button type="button" onClick={()=>setAtivo(v=>!v)} aria-label={ativo?'Recolher conversa':'Mostrar conversa'}>
     {ativo?'−':'+'}</button>
  </header>
  {ativo&&<>
   <div className="widget-webchat-historico" role="log" aria-live="polite">
    {!mensagens.length&&<p className="widget-webchat-boasvindas">
      Escreva uma mensagem para iniciar seu atendimento.
    </p>}
    {mensagens.map(m=><div key={m.id} className={'widget-webchat-msg '+m.direcao}>
      <p>{m.texto}</p><time>{new Date(m.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time>
    </div>)}
   </div>
   <form onSubmit={enviar} className="widget-webchat-form">
    {!mensagens.length&&<input value={nome} maxLength={80}
      onChange={e=>setNome(e.target.value)} placeholder="Seu nome (opcional)" aria-label="Seu nome"/>}
    <textarea required maxLength={2000} rows={2} value={texto}
      onChange={e=>setTexto(e.target.value)} placeholder="Digite sua mensagem…" aria-label="Mensagem"/>
    {erro&&<span role="alert">{erro}</span>}
    <button type="submit" disabled={enviando||!texto.trim()||!visitante}>
      {enviando?'Enviando…':'Enviar mensagem'}</button>
   </form>
   <small className="widget-webchat-rodape">Atendimento via Harvest</small>
  </>}
 </main>;
}
