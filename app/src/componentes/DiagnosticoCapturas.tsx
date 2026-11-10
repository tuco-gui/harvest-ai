'use client';
import {useEffect,useState} from 'react';
type Registro={id:string;nome:string;status_sincronizacao:string;id_superlogica:string|null;lead_id_harvest:number|null;contato_id:number|null;oportunidade_id:number|null;erro_tecnico:string|null};
type Dados={indicadores:Record<string,number|null>;registros:Registro[];nota:string};
const rotulos:Record<string,string>={
 capturas_recebidas:'Entradas e protocolos recebidos',registros_integracao:'Pessoas capturadas (sem duplicidade)',
 contatos_cadastrados:'Contatos no Harvest',leads_cadastrados:'Leads no Harvest',
 oportunidades_pipeline:'Oportunidades no Harvest',integracao_cadastrado:'Confirmados no Superlógica',
 integracao_pendente:'Aguardando envio ao Superlógica',integracao_retry:'Aguardando nova tentativa',
 integracao_reconciliar:'Conferência pendente no Superlógica',integracao_falha:'Falhas externas',
 integracao_processando:'Sincronizações em andamento'};
export default function DiagnosticoCapturas(){
 const [dados,setDados]=useState<Dados|null>(null),[erro,setErro]=useState(''),[ocupado,setOcupado]=useState('');
 async function carregar(){const r=await fetch('/api/agentes/bdr/registros',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro);setDados(d);}
 useEffect(()=>{carregar().catch(e=>setErro(e.message));},[]);
 async function vincular(id:string){setOcupado(id);setErro('');try{const r=await fetch('/api/agentes/bdr/registros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registro_id:id})});const d=await r.json();if(!r.ok)throw Error(d.erro);await carregar();}catch(e){setErro(e instanceof Error?e.message:'Falha ao vincular.');}finally{setOcupado('');}}
 return <section className="secao"><h3>Onde estão os leads?</h3>{erro&&<p role="alert">{erro}</p>}
  {dados&&<><p className="ajuda">Todos os números são desta empresa. Superlógica (externo) e Harvest (interno) são sistemas diferentes. {dados.nota}</p><dl style={{display:'flex',gap:18,flexWrap:'wrap'}}>{Object.entries(dados.indicadores).map(([k,v])=><div key={k}><dt>{rotulos[k]??k.replaceAll('_',' ')}</dt><dd>{v??'Não liberado'}</dd></div>)}</dl>
   <p className="ajuda">Últimas 100 capturas. Cada linha informa se a pessoa já foi vinculada aos contatos e oportunidades do Harvest. A ação de vínculo não cadastra novamente no Superlógica, não atribui corretores e não altera o atendimento humano.</p>
   <div style={{overflowX:'auto'}}><table className="tabela"><thead><tr><th>Contato capturado</th><th>Superlógica (externo)</th><th>Harvest (lead / contato / oportunidade)</th><th>Vínculo com Harvest</th></tr></thead><tbody>{dados.registros.map(r=><tr key={r.id}><td>{r.nome}<small style={{display:'block'}}>{r.id}</small></td><td>{r.status_sincronizacao}{r.id_superlogica?' · ID '+r.id_superlogica:''}{r.erro_tecnico&&<small style={{display:'block'}}>{r.erro_tecnico}</small>}</td><td>{r.lead_id_harvest??'—'} / {r.contato_id??'—'} / {r.oportunidade_id??'—'}</td><td>{r.oportunidade_id?<span className="selo" data-zap-selo="sim">Já está no Harvest</span>:<button disabled={!!ocupado} onClick={()=>void vincular(r.id)}>{ocupado===r.id?'Vinculando…':'Cadastrar / vincular no Harvest'}</button>}</td></tr>)}</tbody></table></div></>}
 </section>;
}
