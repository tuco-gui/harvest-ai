'use client';
import { useEffect, useState } from 'react';

type Config = {canal_id:number;funil_id:number;modo:string;base_aprovada:string;contatos_teste:string[];crm_habilitado:boolean;responsavel_crm_confirmado:boolean};
/** Extensão do painel de agentes existente. Não cria nova central de conversas. */
export default function PainelBdrAlea() {
  const [config,setConfig] = useState<Config|null>(null);
  const [disponivel,setDisponivel] = useState(false);
  const [canais,setCanais] = useState<Array<{id:number;nome:string}>>([]);
  const [funis,setFunis] = useState<Array<{id:number;nome:string;canal_padrao_id:number|null}>>([]);
  const [canal,setCanal] = useState(''); const [funil,setFunil] = useState('');
  const [modo,setModo] = useState('simulacao'); const [base,setBase] = useState('');
  const [testes,setTestes] = useState(''); const [aviso,setAviso] = useState('');
  const [ocupado,setOcupado] = useState(false); const [kpis,setKpis] = useState<Record<string,number>>({});
  useEffect(()=>{
    const ctl = new AbortController();
    Promise.all(['/api/agentes/bdr','/api/canais','/api/funis'].map(url=>fetch(url,{signal:ctl.signal}).then(async r=>({ok:r.ok,data:await r.json()}))))
      .then(([b,c,f])=>{
        if (ctl.signal.aborted || !b.ok) return;
        setDisponivel(true);setConfig(b.data.config);setKpis(b.data.kpis??{});
        setCanais(c.data.canais??[]);setFunis(f.data.funis??[]);
        if (b.data.config) {const cfg=b.data.config;setCanal(String(cfg.canal_id));setFunil(String(cfg.funil_id));
          setModo(cfg.modo);setBase(cfg.base_aprovada);setTestes(cfg.contatos_teste.join(', '));}
      }).catch(()=>{});
    return ()=>ctl.abort();
  },[]);
  async function executar(acao:'salvar'|'processar') {
    setOcupado(true);setAviso('');
    try {
      const r = await fetch('/api/agentes/bdr',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(acao==='processar'?{acao}:{canal_id:Number(canal),funil_id:Number(funil),modo,
          base_aprovada:base,contatos_teste:testes.split(',').map(t=>t.replace(/\D/g,'')).filter(Boolean)})});
      const d=await r.json(); if (!r.ok) throw Error(d.erro??'Falha no BDR.');
      setAviso(acao==='salvar'?'Configuração salva. Produção permanece sujeita à homologação operacional.':
        'Lote processado no modo configurado. Confira o histórico na Inbox.');
    } catch(e) {setAviso(e instanceof Error?e.message:'Falha no BDR.');}
    finally {setOcupado(false);}
  }
  if (!disponivel) return null;
  return <section style={{border:'1px solid var(--rule)',padding:18,marginBottom:20,borderRadius:6}} aria-label="BDR imobiliário Alea">
    <h2>BDR imobiliário · Realize / Alea</h2>
    <p className="ajuda">Imóvel CA0653_MMOL. Histórico, qualificação e handoff na Inbox atual. Conecte o WhatsApp em Configurações → Integrações.</p>
    <p>Modo atual: <strong>{config?.modo??'Não configurado'}</strong> · Superlógica: {config?.crm_habilitado?'habilitado':'aguardando configuração do n8n'}
      {' · '}Pré-atendimento: {config?.responsavel_crm_confirmado?'confirmado':'pendente de confirmação no CRM'}</p>
    <details><summary>Configurar piloto e base aprovada</summary>
      <div style={{display:'grid',gap:12,marginTop:12}}>
        <label>Canal da workspace<select value={canal} onChange={e=>{setCanal(e.target.value);setFunil('');}} disabled={!!config}>
          <option value="">Selecione</option>{canais.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label>Funil do canal<select value={funil} onChange={e=>setFunil(e.target.value)} disabled={!!config}>
          <option value="">Selecione</option>{funis.filter(f=>f.canal_padrao_id===Number(canal)).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
        <label>Modo<select value={modo} onChange={e=>setModo(e.target.value)}>
          <option value="simulacao">Simulação · sem envio</option><option value="homologacao">Homologação · somente contatos de teste na Figueira Marketing</option>
          {modo==='producao'&&<option value="producao">Produção aprovada</option>}
        </select></label>
        <label>Contatos controlados (DDI e DDD, separados por vírgula)<input value={testes} maxLength={180} onChange={e=>setTestes(e.target.value)}/></label>
        <label>Ficha e condições aprovadas do imóvel<textarea value={base} maxLength={16000} rows={6} onChange={e=>setBase(e.target.value)}/></label>
        <button type="button" className="btn-primario" disabled={ocupado||!canal||!funil||modo==='producao'} onClick={()=>void executar('salvar')}>Salvar piloto</button>
      </div>
    </details>
    {config&&<button type="button" disabled={ocupado} onClick={()=>void executar('processar')}>{ocupado?'Processando…':'Processar lote no modo atual'}</button>}
    <dl style={{display:'flex',gap:16,flexWrap:'wrap'}}>{Object.entries(kpis).map(([k,v])=><div key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{v}</dd></div>)}</dl>
    {aviso&&<p role="status">{aviso}</p>}
  </section>;
}
