'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
type Atendente={id:string;nome:string};
type Fonte={id:string;nome:string;tipo:string;status:string;funil_id:number};
type Conversa={id:string;nome:string|null;visitante_id:string;status:string;responsavel_id:string|null;contato_id?:number|null};
type Mensagem={id:string;direcao:'entrada'|'saida';texto:string;criado_em:string;status_envio?:'pendente'|'enviado'|'falhou'};
export default function ConversaExternaDetalheCRM({id,podeAtribuir,atendentes,aoSalvar}:{
 id:string;podeAtribuir:boolean;atendentes:Atendente[];aoSalvar:()=>void;
}){
 const [conversa,setConversa]=useState<Conversa|null>(null);
 const [fonte,setFonte]=useState<Fonte|null>(null);
 const [mensagens,setMensagens]=useState<Mensagem[]>([]);
 const [status,setStatus]=useState('aberto');
 const [responsavel,setResponsavel]=useState('');
 const [texto,setTexto]=useState('');
 const [carregando,setCarregando]=useState(true);
 const [salvando,setSalvando]=useState(false);
 const [erro,setErro]=useState('');
  const [aviso,setAviso]=useState('');
  const [oportunidade,setOportunidade]=useState<{id:number;funil_id:number|null}|null>(null);
 const carregar=useCallback(async(ctl?:AbortSignal)=>{
   try{
    const r=await fetch('/api/crm/conversas-externas/'+id,{cache:'no-store',signal:ctl});
    const d=await r.json();
    if(!r.ok)throw Error(d.erro||'Conversa indisponível.');
    if(ctl?.aborted)return;
     setConversa(d.conversa);setFonte(d.fonte);setMensagens(d.mensagens??[]);
     setOportunidade(d.oportunidade??null);
    setStatus(d.conversa.status);setResponsavel(d.conversa.responsavel_id??'');
    setErro('');
   }catch(e){if(!ctl?.aborted)setErro(e instanceof Error?e.message:'Falha ao carregar conversa.');}
   finally{if(!ctl?.aborted)setCarregando(false);}
 },[id]);
 useEffect(()=>{
   const ctrl=new AbortController();setCarregando(true);setConversa(null);
   void carregar(ctrl.signal);
   const timer=setInterval(()=>void carregar(ctrl.signal),15000);
   return()=>{ctrl.abort();clearInterval(timer);};
 },[carregar]);
 async function responder(e:React.FormEvent){
  e.preventDefault();if(salvando||!texto.trim())return;
  setSalvando(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/crm/conversas-externas/'+id,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({texto:texto.trim(),idempotencia:crypto.randomUUID()}),
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Falha ao enviar.');
   setMensagens(a=>a.concat(d.mensagem));setTexto('');
   setAviso(fonte?.tipo==='webchat'?'Resposta salva no webchat, sem enviar WhatsApp.':'Resposta enviada pela Meta e registrada no histórico.');
   aoSalvar();
  }catch(e){setErro(e instanceof Error?e.message:'Falha na resposta.');}
  finally{setSalvando(false);}
 }
 async function salvarAtendimento(){
  if(salvando)return;setSalvando(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/crm/conversas-externas/'+id,{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status,...(podeAtribuir?{responsavel_id:responsavel||null}:{})}),
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Falha ao salvar.');
   setAviso('Atendimento atualizado. Nenhuma mensagem foi enviada.');
   aoSalvar();
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao atualizar atendimento.');}
  finally{setSalvando(false);}
 }
 const formato=(data:string)=>new Date(data).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
 if(carregando&&!conversa)return <div className="crm-atendimentos-vazio">Carregando conversa…</div>;
 return <div className="crm-conversa-externa">
  <header><div><strong>{conversa?.nome||'Visitante do site'}</strong>
   <span>{fonte?.nome||'Canal externo'} · {fonte?.tipo==='webchat'?'Webchat':
    fonte?.tipo==='instagram_dm'?'Instagram Direct':'Messenger'}</span>
   </div>
   <nav aria-label="Vínculos do atendimento">
    <Link href={'/inbox?conversa='+encodeURIComponent(id)}>Abrir na Inbox</Link>
    {oportunidade&&<Link href={'/crm?oportunidade='+oportunidade.id+(oportunidade.funil_id?'&funil='+oportunidade.funil_id:'')}>Abrir negócio #{oportunidade.id}</Link>}
    {conversa?.contato_id&&<Link href={'/crm/contatos#cadastro-'+conversa.contato_id}>Abrir contato</Link>}
   </nav></header>
  <div className="crm-atendimento-mensagens">
   {!mensagens.length&&<p className="crm-atendimentos-vazio">Nenhuma mensagem registrada.</p>}
   {mensagens.map(m=><article key={m.id} className={'crm-atendimento-mensagem '+m.direcao}>
    <p>{m.texto}</p><small>{formato(m.criado_em)} · {m.direcao==='entrada'?'Recebida':m.status_envio==='falhou'?'Falha no envio':m.status_envio==='pendente'?'Confirmação pendente':'Enviada'}</small>
   </article>)}
  </div>
  <div className="crm-inbox-compositor">
   {(fonte?.tipo==='webchat'||fonte?.tipo==='instagram_dm'||fonte?.tipo==='facebook_messenger')&&fonte.status==='pronto'?
    <form onSubmit={responder}>
     <label>Responder {fonte?.tipo==='webchat'?'no webchat':fonte?.tipo==='instagram_dm'?'no Instagram':'no Messenger'}
      <textarea maxLength={2000} value={texto} onChange={e=>setTexto(e.target.value)}
        placeholder="Digite sua resposta…" rows={3}/>
     </label>
     <button type="submit" className="btn-primario"
       disabled={!texto.trim()||salvando}>{salvando?'Enviando…':'Enviar resposta'}</button>
    </form>:
    <p className="ajuda">A fonte ainda não tem mensagens de saída habilitadas.
      Autorize a conta no editor do funil antes de responder.</p>}
  </div>
  <div className="crm-atendimento-editor">
   <h2>Gerenciar atendimento</h2>
   <div className="crm-atendimento-campos">
    <label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}>
     <option value="aberto">Aberto</option><option value="pendente">Aguardando</option>
     <option value="resolvido">Resolvido</option>
    </select></label>
    <label>Responsável {podeAtribuir?<select value={responsavel}
      onChange={e=>setResponsavel(e.target.value)}>
      <option value="">Sem responsável</option>
      {atendentes.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}
    </select>:<strong>{atendentes.find(a=>a.id===responsavel)?.nome||'Atendente atribuído'}</strong>}</label>
   </div>
   {erro&&<p className="crm-aviso" role="alert">{erro}</p>}
   {aviso&&<p className="ajuda" role="status">{aviso}</p>}
   <button type="button" className="btn-primario" onClick={()=>void salvarAtendimento()}
     disabled={salvando}>{salvando?'Salvando…':'Salvar atendimento'}</button>
  </div>
 </div>;
}
