'use client';

import { useEffect, useState } from 'react';

type Agente = { id: number; nome: string; email: string | null };
type Evento = { id:number;chatwoot_conversa_id:number;chatwoot_agente_id:number;
  confirmado:boolean;criado_em:string };
type Config = { configurado:boolean;agentes:Agente[];historico:Evento[];
  motivo?:string;aviso?:string };

export default function EncaminhamentoChatwootCRM({ telefone }: { telefone:string }) {
  const [dados,setDados] = useState<Config|null>(null);
  const [conversaId,setConversaId] = useState('');
  const [agenteId,setAgenteId] = useState('');
  const [carregando,setCarregando] = useState(true);
  const [enviando,setEnviando] = useState(false);
  const [erro,setErro] = useState('');
  const [sucesso,setSucesso] = useState('');

  async function carregar(signal?:AbortSignal) {
    const r=await fetch('/api/crm/atendimentos/'+encodeURIComponent(telefone)+'/chatwoot',
      {cache:'no-store',signal});
    const d=await r.json();
    if(!r.ok)throw Error(d.motivo||d.erro||'Falha ao consultar Chatwoot.');
    if(!signal?.aborted)setDados(d as Config);
  }
  useEffect(()=>{
    const ctrl=new AbortController();
    setCarregando(true);setErro('');setSucesso('');setDados(null);
    void carregar(ctrl.signal).catch(e=>{
      if(!ctrl.signal.aborted)setErro(e instanceof Error?e.message:'Falha no Chatwoot.');
    }).finally(()=>{if(!ctrl.signal.aborted)setCarregando(false);});
    return ()=>ctrl.abort();
  },[telefone]);

  async function encaminhar(){
    const conv=Number(conversaId),ag=Number(agenteId);
    if(!Number.isSafeInteger(conv)||conv<1||!Number.isSafeInteger(ag)||ag<1){
      setErro('Escolha um agente e informe um ID de conversa válido.');return;
    }
    const pessoa=dados?.agentes.find(a=>a.id===ag);
    if(!window.confirm('Encaminhar a conversa '+conv+' do contato '+telefone+
      ' para o agente '+(pessoa?.nome??agenteId)+' no Chatwoot? Nenhuma mensagem será enviada.'))
      return;
    setEnviando(true);setErro('');setSucesso('');
    try {
      const r=await fetch('/api/crm/atendimentos/'+encodeURIComponent(telefone)+'/chatwoot',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({conversaId:conv,agenteId:ag,confirmar:true}),
      });
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Não foi possível encaminhar.');
      setSucesso(d.aviso || (d.confirmado?'Responsável confirmado.':'Atribuição enviada ao Chatwoot.'));
      await carregar().catch(()=>{});
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao atribuir agente.');}
    finally{setEnviando(false);}
  }

  return <section className="crm-encaminhamento-chatwoot">
    <h3>Encaminhamento humano · Chatwoot</h3>
    <p className="ajuda">Ação manual. Exige correspondência de conta, canal e telefone antes de transferir.</p>
    {carregando&&<p className="ajuda">Verificando vínculo Chatwoot…</p>}
    {dados&&!dados.configurado&&<p className="ajuda">{dados.motivo||'Chatwoot não configurado.'}</p>}
    {dados?.configurado&&<>
      <div className="crm-chatwoot-campos">
        <label>ID da conversa Chatwoot
          <input aria-label="ID da conversa Chatwoot" inputMode="numeric"
            type="number" min={1} value={conversaId}
            onChange={e=>setConversaId(e.target.value)} placeholder="Ex.: 123"/>
        </label>
        <label>Agente humano no Chatwoot
          <select value={agenteId} onChange={e=>setAgenteId(e.target.value)}>
            <option value="">Selecione um agente</option>
            {dados.agentes.map(a=><option key={a.id} value={a.id}>
              {a.nome}{a.email?' · '+a.email:''}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className="btn-primario" disabled={enviando||!conversaId||!agenteId}
        onClick={()=>void encaminhar()}>
        {enviando?'Encaminhando…':'Confirmar encaminhamento humano'}
      </button>
      {!!dados.historico.length&&<details>
        <summary>Histórico de encaminhamentos Chatwoot</summary>
        <ol>
          {dados.historico.map(e=><li key={e.id}>
            Conversa #{e.chatwoot_conversa_id}, agente #{e.chatwoot_agente_id}
            {' · '}{new Date(e.criado_em).toLocaleString('pt-BR')}
            {' · '}{e.confirmado?'Confirmado':'Não confirmado'}
          </li>)}
        </ol>
      </details>}
    </>}
    {erro&&<p role="alert" className="crm-aviso">{erro}</p>}
    {sucesso&&<p role="status" className="ajuda">{sucesso}</p>}
  </section>;
}
