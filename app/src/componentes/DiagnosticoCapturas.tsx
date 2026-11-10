'use client';
import {useEffect,useState} from 'react';
type Registro={id:string;nome:string;status_sincronizacao:string;id_superlogica:string|null;lead_id_harvest:number|null;contato_id:number|null;oportunidade_id:number|null;erro_tecnico:string|null};
type Dados={indicadores:Record<string,number|null>;registros:Registro[];nota:string};
export default function DiagnosticoCapturas(){
 const [dados,setDados]=useState<Dados|null>(null),[erro,setErro]=useState(''),[ocupado,setOcupado]=useState('');
 async function carregar(){const r=await fetch('/api/agentes/bdr/registros',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro);setDados(d);}
 useEffect(()=>{carregar().catch(e=>setErro(e.message));},[]);
 async function vincular(id:string){setOcupado(id);setErro('');try{const r=await fetch('/api/agentes/bdr/registros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registro_id:id})});const d=await r.json();if(!r.ok)throw Error(d.erro);await carregar();}catch(e){setErro(e instanceof Error?e.message:'Falha ao vincular.');}finally{setOcupado('');}}
 return <section className="secao"><h3>Capturas, integração e CRM</h3>{erro&&<p role="alert">{erro}</p>}
  {dados&&<><p className="ajuda">Totais da workspace atual. {dados.nota}</p><dl style={{display:'flex',gap:18,flexWrap:'wrap'}}>{Object.entries(dados.indicadores).map(([k,v])=><div key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{v??'Não liberado'}</dd></div>)}</dl>
   <p className="ajuda">Últimos 100 registros. Pendente/retry/reconciliar não significam falha definitiva; múltiplos cadastros externos exigem revisão. Vincular cria/reutiliza somente cadastros locais, sem atribuir responsável no Superlógica.</p>
   <div style={{overflowX:'auto'}}><table className="tabela"><thead><tr><th>Captura</th><th>Sincronização externa</th><th>Lead / contato / oportunidade locais</th><th>Ação</th></tr></thead><tbody>{dados.registros.map(r=><tr key={r.id}><td>{r.nome}<small style={{display:'block'}}>{r.id}</small></td><td>{r.status_sincronizacao}{r.id_superlogica?' · ID '+r.id_superlogica:''}{r.erro_tecnico&&<small style={{display:'block'}}>{r.erro_tecnico}</small>}</td><td>{r.lead_id_harvest??'—'} / {r.contato_id??'—'} / {r.oportunidade_id??'—'}</td><td>{!r.oportunidade_id&&<button disabled={!!ocupado} onClick={()=>void vincular(r.id)}>{ocupado===r.id?'Vinculando…':'Vincular CRM local'}</button>}</td></tr>)}</tbody></table></div></>}
 </section>;
}
