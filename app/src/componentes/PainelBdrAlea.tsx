'use client';
import { useEffect, useState } from 'react';
import DiagnosticoCapturas from './DiagnosticoCapturas';

type Config = {canal_id:number;funil_id:number;codigo_anuncio:string;modo:string;base_aprovada:string;contatos_teste:string[];crm_habilitado:boolean;responsavel_crm_confirmado:boolean};
/** Extensão do painel de agentes existente. Não cria nova central de conversas. */
export default function PainelBdrAlea() {
  const [config,setConfig] = useState<Config|null>(null);
  const [disponivel,setDisponivel] = useState(false);
  const [canais,setCanais] = useState<Array<{id:number;nome:string}>>([]);
  const [funis,setFunis] = useState<Array<{id:number;nome:string;canal_padrao_id:number|null}>>([]);
  const [canal,setCanal] = useState(''); const [funil,setFunil] = useState('');
  const [modo,setModo] = useState('simulacao'); const [base,setBase] = useState('');
  const [codigo,setCodigo]=useState('');
  const [buscaImovel,setBuscaImovel]=useState('');
  const [imoveis,setImoveis]=useState<Array<{id:number;nome:string;sku:string|null;descricao:string|null}>>([]);
  async function buscarImoveis(){try{
    const r=await fetch('/api/crm/cadastros/produtos?pagina=1&estado=ativos&busca='+encodeURIComponent(buscaImovel));
    const d=await r.json();if(!r.ok)throw Error(d.erro);setImoveis(d.registros??[]);
  }catch(e){setAviso(e instanceof Error?e.message:'Falha ao consultar catálogo.');}}
  const [aviso,setAviso] = useState('');
  const [ocupado,setOcupado] = useState(false); const [kpis,setKpis] = useState<Record<string,number>>({});
  useEffect(()=>{
    const ctl = new AbortController();
    Promise.all(['/api/agentes/bdr','/api/canais','/api/funis'].map(url=>fetch(url,{signal:ctl.signal}).then(async r=>({ok:r.ok,data:await r.json()}))))
      .then(([b,c,f])=>{
        if (ctl.signal.aborted) return;
        if(!b.ok){setAviso(b.data.erro??'BDR indisponível.');return;}
        setDisponivel(true);setConfig(b.data.config);setKpis(b.data.kpis??{});
        setCanais(c.data.canais??[]);setFunis(f.data.funis??[]);
        if(!c.ok||!f.ok)setAviso('Canais ou funis indisponíveis: confira a liberação dos serviços e os vínculos desta workspace em Integrações.');
        if (b.data.config) {const cfg=b.data.config;setCanal(String(cfg.canal_id));setFunil(String(cfg.funil_id));
          setCodigo(cfg.codigo_anuncio);setModo(cfg.modo);setBase(cfg.base_aprovada);}
      }).catch(()=>{});
    return ()=>ctl.abort();
  },[]);
  async function salvarFicha() {
    setOcupado(true);setAviso('');
    try {
      const r = await fetch('/api/agentes/bdr',{method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({canal_id:Number(canal),funil_id:Number(funil),codigo_anuncio:codigo,base_aprovada:base})});
      const d=await r.json(); if (!r.ok) throw Error(d.erro??'Falha no BDR.');
      if(d.config)setConfig(d.config);
      setAviso('Ficha salva. Modo, autorização CRM e aprovação de respostas não foram alterados.');
    } catch(e) {setAviso(e instanceof Error?e.message:'Falha no BDR.');}
    finally {setOcupado(false);}
  }
   if (!disponivel) return aviso?<p role="alert">{aviso}</p>:null;
   return <section style={{border:'1px solid var(--rule)',padding:18,marginBottom:20,borderRadius:6}} aria-label="Configuração do BDR imobiliário">
     <h2>BDR imobiliário · configuração da workspace</h2>
     <p className="ajuda">Ficha e condições aprovadas para o empreendimento atendido. Histórico na Inbox atual. Conecte o WhatsApp em Configurações → Integrações.</p>
    <p>Modo atual: <strong>{config?.modo??'Não configurado'}</strong> · Superlógica: {config?.crm_habilitado?'habilitado':'aguardando configuração do n8n'}
      {' · '}Liberação técnica cadastral: {config?.responsavel_crm_confirmado?'registrada (não comprova atribuição a um usuário)':'pendente'}</p>
    <details open><summary>Ficha, condições comerciais e vínculos</summary>
      <div style={{display:'grid',gap:12,marginTop:12}}>
        <p className="ajuda"><a href="/crm/cadastros/produtos">Cadastrar ou editar imóveis no catálogo existente</a>. Use o SKU como código do imóvel e a descrição como ficha/condições aprovadas.</p>
        <label>Buscar imóvel no catálogo<input value={buscaImovel} onChange={e=>setBuscaImovel(e.target.value)}/></label>
        <button type="button" onClick={()=>void buscarImoveis()}>Buscar imóveis</button>
        {imoveis.length>0&&<label>Usar ficha do catálogo<select value="" onChange={e=>{const i=imoveis.find(x=>x.id===Number(e.target.value));if(i){setCodigo(i.sku??'');setBase(i.nome+'\n'+(i.descricao??''));}}}><option value="">Selecione para preparar a ficha</option>{imoveis.map(i=><option key={i.id} value={i.id}>{i.sku??'Sem código'} · {i.nome}</option>)}</select></label>}
        <label>Código do imóvel<input value={codigo} maxLength={100} onChange={e=>setCodigo(e.target.value)}/></label>
        <label>Canal da workspace<select value={canal} onChange={e=>{setCanal(e.target.value);setFunil('');}}>
          <option value="">Selecione</option>{canais.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label>Funil do canal<select value={funil} onChange={e=>setFunil(e.target.value)}>
          <option value="">Selecione</option>{funis.filter(f=>f.canal_padrao_id===Number(canal)).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
        <label>Modo operacional (alteração somente após homologação)<select value={modo} disabled>
          <option value="simulacao">Simulação · sem envio</option><option value="homologacao">Homologação · somente contatos de teste na Figueira Marketing</option>
          {modo==='producao'&&<option value="producao">Produção aprovada</option>}
        </select></label>
        <p className="ajuda">Trocas de vínculo são validadas no backend. Sessões e capturas existentes impedem migração silenciosa. Editar a ficha não conecta canais nem libera IA.</p>
        <label>Ficha e condições aprovadas do imóvel<textarea value={base} maxLength={16000} rows={6} onChange={e=>setBase(e.target.value)}/></label>
        <button type="button" className="btn-primario" disabled={ocupado||!canal||!funil||!codigo||modo!=='simulacao'} onClick={()=>void salvarFicha()}>Salvar ficha e vínculos</button>
      </div>
    </details>
    <p className="ajuda">Contadores abaixo são de integração/atendimento, não a quantidade de contatos ou negócios do pipeline.</p>
    <dl style={{display:'flex',gap:16,flexWrap:'wrap'}}>{Object.entries(kpis).map(([k,v])=><div key={k}><dt>{k==='cadastrados_crm'?'Cadastros confirmados no Superlógica':k==='recebidos'?'Identidades capturadas (integração/BDR)':k.replaceAll('_',' ')}</dt><dd>{v}</dd></div>)}</dl>
    {aviso&&<p role="status">{aviso}</p>}
    <DiagnosticoCapturas/>
  </section>;
}
