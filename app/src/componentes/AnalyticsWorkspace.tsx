'use client';
import {useEffect,useState} from 'react';
export default function AnalyticsWorkspace({relatorio=false}:{relatorio?:boolean}){
 const [dados,setDados]=useState<{indicadores:Record<string,number|null>;origem:string;gerado_em:string}|null>(null);const [erro,setErro]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/api/analytics'+(relatorio?'/relatorios':''),{signal:c.signal,cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.erro);return b;}).then(b=>{if(!c.signal.aborted)setDados(b);}).catch(e=>{if(!c.signal.aborted)setErro(e.message);});return()=>c.abort();},[relatorio]);
 return <div className="pagina"><h2>{relatorio?'Relatórios e indicadores':'Dashboard da workspace'}</h2>{erro&&<p role="alert">{erro}</p>}{dados?<><div className="cartaocfg">{Object.entries(dados.indicadores).map(([k,v])=><p key={k}><strong>{k.replaceAll('_',' ')}:</strong> {v===null?'Serviço não liberado':v}</p>)}</div><p className="ajuda">{dados.origem} · {new Date(dados.gerado_em).toLocaleString('pt-BR')}</p></>:!erro&&<p>Carregando indicadores…</p>}</div>;
}
