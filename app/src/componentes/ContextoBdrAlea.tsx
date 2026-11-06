'use client';
import { useEffect, useState } from 'react';
type Contexto = {sessao:{estado:string;qualificacao:Record<string,string>;erro:string|null;proximo_followup:string|null;consentimento_followup:boolean;envio_pendente:boolean};
  crm:{status_sincronizacao:string;id_superlogica:string|null;tentativas:number;origem:Record<string,string>}|null;
  execucoes:Array<{id:string;tipo:string;status:string;previa:string|null;criado_em:string}>;podeLiberar:boolean};
export default function ContextoBdrAlea({telefone,canalId}:{telefone:string;canalId:number}) {
  const [d,setD] = useState<Contexto|null>(null);const [aviso,setAviso] = useState('');const [ocupado,setOcupado]=useState(false);
  const [evidencia,setEvidencia]=useState('');
  const url='/api/crm/atendimentos/'+encodeURIComponent(telefone)+'/bdr?canal_id='+canalId;
  useEffect(()=>{
    const ctl=new AbortController();setD(null);setAviso('');
    const ler=()=>fetch(url,{signal:ctl.signal,cache:'no-store'}).then(async r=>{const b=await r.json();if(r.ok&&!ctl.signal.aborted)setD(b.sessao?b:null);}).catch(()=>{});
    void ler();const timer=setInterval(()=>void ler(),15000);
    return ()=>{ctl.abort();clearInterval(timer);};
  },[url]);
  async function acao(acao:string) {
    setOcupado(true);setAviso('');
    try {const r=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,evidencia,consentimento:!d?.sessao.consentimento_followup})});
      const b=await r.json();if(!r.ok)throw Error(b.erro);setAviso('Ação registrada.');
      const atualizado=await fetch(url,{cache:'no-store'}).then(r=>r.json());setD(atualizado.sessao?atualizado:null);
    }catch(e){setAviso(e instanceof Error?e.message:'Falha na ação.');}finally{setOcupado(false);}
  }
  if(!d)return null;
  return <section aria-label="Contexto do BDR Alea" style={{padding:16,border:'1px solid var(--rule)',marginBottom:16}}>
    <h2>BDR Alea · {d.sessao.estado.replaceAll('_',' ')}</h2>
    <p>Superlógica: {d.crm?.status_sincronizacao??'Aguardando nome/identificador mínimo'}{d.crm?.id_superlogica?' · '+d.crm.id_superlogica:''}</p>
    {d.crm&&<p className="ajuda">Primeira origem: {Object.entries(d.crm.origem).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>}
    <dl>{Object.entries(d.sessao.qualificacao).map(([k,v])=><div key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{v}</dd></div>)}</dl>
    <p className="ajuda">{['aguardando_corretor','humano_assumiu','transferido'].includes(d.sessao.estado)
      ?'Próxima ação: corretor deve assumir, revisar o histórico e confirmar condições/horários.'
      :'Próxima ação: continuar qualificação progressiva.'}</p>
    {d.sessao.proximo_followup&&<p>Próxima retomada: {new Date(d.sessao.proximo_followup).toLocaleString('pt-BR')}</p>}
    {(d.sessao.erro||d.sessao.envio_pendente)&&<p role="alert">Execução requer revisão: {d.sessao.erro??'saída reservada, confirmação pendente'}. Não repita o envio sem verificar o canal.</p>}
    <button type="button" disabled={ocupado} onClick={()=>void acao('assumir')}>Assumir e pausar IA</button>
    {d.podeLiberar&&<details><summary>Controle humano e evidências</summary>
      <label>Evidência / motivo<textarea value={evidencia} maxLength={500} onChange={e=>setEvidencia(e.target.value)}/></label>
      {['liberar','visita_confirmada','consentimento'].map(a=><button type="button" key={a} disabled={ocupado||evidencia.trim().length<10} onClick={()=>void acao(a)}>
        {a==='liberar'?'Liberar retomada da IA':a==='visita_confirmada'?'Registrar visita confirmada por humano':d.sessao.consentimento_followup?'Revogar consentimento de retomada':'Registrar consentimento de retomada'}
      </button>)}
    </details>}
    <details><summary>Execuções e prévias BDR</summary>{d.execucoes.map(e=><article key={e.id}><strong>{e.tipo} · {e.status}</strong><p>{e.previa}</p><small>{new Date(e.criado_em).toLocaleString('pt-BR')}</small></article>)}</details>
    {aviso&&<p role="status">{aviso}</p>}
  </section>;
}
