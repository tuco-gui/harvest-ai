'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {diasDaGrade,mudarMes} from '@/lib/crmAgenda';
import {diaLocalISO} from '@/lib/agenda/fuso';
type Evento={id:number;tipo:string;titulo:string;descricao:string|null;concluida:boolean;vence_em:string;oportunidade_id:number;
 oportunidade:{id:number;empresa:string;contato:string;owner_id:string|null}};
const DIAS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export default function AgendaCrm(){
 const [mes,setMes]=useState('');
 const [fuso,setFuso]=useState('America/Sao_Paulo');
 const [eventos,setEventos]=useState<Evento[]>([]);
 const [dia,setDia]=useState('');
 const [carregando,setCarregando]=useState(true);
 const [erro,setErro]=useState('');
 const [truncado,setTruncado]=useState(false);
 const [concluidas,setConcluidas]=useState(false);
 useEffect(()=>{const hoje=diaLocalISO(new Date(),fuso);setMes(hoje.slice(0,7));setDia(hoje);},[]);
 useEffect(()=>{
  if(!mes)return;
  const ctl=new AbortController();setCarregando(true);setErro('');setEventos([]);
  fetch('/api/crm/agenda?'+new URLSearchParams({mes,fuso}),{cache:'no-store',signal:ctl.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao carregar agenda.');return d;})
   .then(d=>{if(!ctl.signal.aborted){setEventos(d.eventos);setTruncado(d.truncado);}})
   .catch(e=>{if(!ctl.signal.aborted)setErro(e.message);})
   .finally(()=>{if(!ctl.signal.aborted)setCarregando(false);});
  return ()=>ctl.abort();
 },[mes,fuso]);
 const visiveis=eventos.filter(e=>concluidas||!e.concluida);
 const doDia=(d:string)=>visiveis.filter(e=>diaLocalISO(new Date(e.vence_em),fuso)===d);
 const hora=(iso:string)=>new Date(iso).toLocaleTimeString('pt-BR',{timeZone:fuso,hour:'2-digit',minute:'2-digit'});
 return <main className="pagina pagina-larga crm-agenda">
  <header className="crm-tarefas-header"><div><p className="label">CRM · AGENDA</p><h1>Agenda de atividades</h1>
   <p className="ajuda">Tarefas, reuniões, ligações e e-mails com prazo, ligados aos negócios.</p></div>
   <Link className="btn-primario" href="/crm/tarefas">Gerenciar tarefas</Link></header>
  <nav className="crm-cadastros-filtros" aria-label="Controles da agenda">
   <button type="button" disabled={!mes||mes==='2000-01'} onClick={()=>setMes(m=>mudarMes(m,-1))}>Mês anterior</button>
   <label>Mês<input type="month" min="2000-01" max="2099-12" value={mes} onChange={e=>{if(e.target.value)setMes(e.target.value);}}/></label>
   <button type="button" disabled={!mes||mes==='2099-12'} onClick={()=>setMes(m=>mudarMes(m,1))}>Próximo mês</button>
   <button type="button" onClick={()=>{const hoje=diaLocalISO(new Date(),fuso);setMes(hoje.slice(0,7));setDia(hoje);}}>Hoje</button>
   <label>Fuso horário<select aria-label="Fuso horário" value={fuso} onChange={e=>setFuso(e.target.value)}>
    <option value="America/Sao_Paulo">Brasília / São Paulo</option><option value="America/Chicago">Texas / Chicago</option>
    <option value="America/New_York">Nova York</option><option value="Europe/Lisbon">Lisboa</option><option value="UTC">UTC</option>
   </select></label>
   <label><input type="checkbox" checked={concluidas} onChange={e=>setConcluidas(e.target.checked)}/> Mostrar concluídas</label>
  </nav>
  {erro&&<p role="alert" className="crm-aviso">{erro}</p>}
  {carregando&&<p role="status">Carregando agenda…</p>}
  {truncado&&<p role="status" className="crm-aviso">Este período ultrapassa 1.000 atividades. A grade mostra as primeiras 1.000; consulte os negócios para o histórico completo.</p>}
  <div className="crm-agenda-rolagem"><div className="crm-agenda-grade" aria-label="Calendário mensal" aria-busy={carregando}>
   {DIAS.map(d=><strong className="crm-agenda-semana" key={d}>{d}</strong>)}
   {mes&&diasDaGrade(mes).map(d=><section key={d} className={'crm-agenda-dia'+(d===dia?' selecionado':'')+(d.startsWith(mes)?'':' adjacente')}>
    <button type="button" aria-label={'Ver atividades de '+d} aria-pressed={d===dia} onClick={()=>setDia(d)}>{Number(d.slice(-2))}</button>
    {doDia(d).map(e=><Link className={e.concluida?'concluida':''} key={e.id} href={'/crm?oportunidade='+e.oportunidade_id}
      title={e.titulo+' · '+(e.oportunidade.empresa||e.oportunidade.contato)}>{hora(e.vence_em)} · {e.titulo}</Link>)}
   </section>)}
  </div></div>
  {dia&&<section className="crm-agenda-resumo" aria-label="Atividades do dia selecionado"><h2>{dia.split('-').reverse().join('/')}</h2>
   {!carregando&&!doDia(dia).length&&<p className="ajuda">Nenhuma atividade com prazo neste dia.</p>}
   {doDia(dia).map(e=><article key={e.id}><strong>{hora(e.vence_em)} · {e.titulo}</strong>
    <p>{e.tipo} · {e.concluida?'Concluída':'Em aberto'}</p>{e.descricao&&<p>{e.descricao}</p>}
    <Link href={'/crm?oportunidade='+e.oportunidade_id}>Abrir negócio #{e.oportunidade_id} · {e.oportunidade.empresa||e.oportunidade.contato}</Link>
   </article>)}
  </section>}
 </main>;
}
