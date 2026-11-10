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
   const rotulos:Record<string,string>={recebidos:'Contatos identificados na captação',cadastrados_crm:'Confirmados no Superlógica',atendidos:'Conversas respondidas pelo agente',respondidos:'Sessões de atendimento registradas',encaminhados:'Encaminhados para atendimento humano',qualificados:'Qualificados pelo BDR',visitas_confirmadas_humano:'Visitas confirmadas por humano',falhas:'Pendências técnicas ou de sincronização'};
   return <section className="secao" aria-label="BDR imobiliário da workspace" style={{marginBottom:22}}>
     <h2>BDR imobiliário</h2>
     <p className="ajuda">Atendimento e qualificação do empreendimento. O canal, os funis e a conexão com WhatsApp são administrados em <a href="/configuracoes?aba=integracoes#integracao-whatsapp">Configurações → Integrações</a>; os imóveis ficam no <a href="/crm/cadastros/produtos">Catálogo</a>.</p>
     <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',padding:'12px 0'}}>
       <span className="selo" data-zap-selo="nao">{config?.modo==='simulacao'?'IA em simulação, sem respostas automáticas':config?.modo==='homologacao'?'IA em homologação restrita':config?.modo==='producao'?'IA em produção aprovada':'IA não configurada'}</span>
       <span className="ajuda">CRM externo: Superlógica · {config?.crm_habilitado?'integração configurada':'integração não habilitada'}</span>
     </div>
     <h3>Leads e atendimentos</h3>
     <p className="ajuda">Contagens de naturezas diferentes. <strong>Superlógica</strong> é o CRM externo; <strong>Harvest</strong> é o CRM desta plataforma. Uma captura externa não comprova cadastro de contato ou oportunidade no Harvest.</p>
     <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,margin:'14px 0'}}>
       {Object.entries(kpis).filter(([k])=>['recebidos','cadastrados_crm','atendidos','encaminhados','qualificados','falhas'].includes(k)).map(([k,v])=><div key={k} style={{border:'1px solid var(--rule)',borderRadius:6,padding:12}}><dt className="ajuda">{rotulos[k]??k}</dt><dd style={{fontSize:24,fontWeight:700,marginTop:6}}>{v}</dd></div>)}
     </dl>
     <p className="ajuda"><a href="/crm/contatos">Abrir contatos do Harvest</a> · <a href="/crm">Abrir pipeline e oportunidades do Harvest</a>. Confira abaixo quais capturas já possuem vínculo local antes de considerar os dois CRMs sincronizados.</p>
     <DiagnosticoCapturas/>
     <details style={{marginTop:20}}>
       <summary style={{cursor:'pointer',fontWeight:600}}>Configuração avançada do BDR (administradores)</summary>
       <p className="ajuda">Esta seção não conecta WhatsApp, não altera permissões de envio e não homologa o agente. Não altere canal ou funil de uma operação com histórico sem migração controlada.</p>
       <div style={{display:'grid',gap:12,marginTop:12,maxWidth:680}}>
         <label>Canal de atendimento vinculado
           <select value={canal} onChange={e=>{setCanal(e.target.value);setFunil('');}} disabled={!!config&&modo!=='simulacao'}>
             <option value="">Selecione um canal configurado em Integrações</option>
             {canais.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
           </select>
         </label>
         <label>Funil associado ao canal
           <select value={funil} onChange={e=>setFunil(e.target.value)} disabled={!!config&&modo!=='simulacao'}>
             <option value="">Selecione o funil deste canal</option>
             {funis.filter(f=>f.canal_padrao_id===Number(canal)).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
           </select>
         </label>
         <p className="ajuda">Situação das respostas: {config?.modo==='simulacao'?'apenas simulação':config?.modo==='homologacao'?'piloto restrito, sujeito aos bloqueios de segurança':'não autorizadas nesta tela'}. A autorização para enviar respostas não pode ser alterada por este formulário.</p>
         <h3>Informações aprovadas do imóvel</h3>
         <p className="ajuda">Base de conhecimento usada pelo agente para responder sobre o empreendimento. Cadastre dados reais e autorizados pela imobiliária, como descrição, características, disponibilidade e condições. Sem informação aprovada, o agente deve encaminhar a dúvida a um corretor, sem inventar respostas.</p>
         <label>Buscar imóvel cadastrado<input value={buscaImovel} onChange={e=>setBuscaImovel(e.target.value)} placeholder="Buscar no catálogo do Harvest"/></label>
         <button type="button" onClick={()=>void buscarImoveis()}>Buscar imóvel</button>
         {imoveis.length>0&&<label>Usar informações do catálogo<select value="" onChange={e=>{const i=imoveis.find(x=>x.id===Number(e.target.value));if(i){setCodigo(i.sku??'');setBase(i.nome+'\\n'+(i.descricao??''));}}}><option value="">Escolha um imóvel</option>{imoveis.map(i=><option key={i.id} value={i.id}>{i.sku??'Sem código'} · {i.nome}</option>)}</select></label>}
         <label>Código do imóvel / empreendimento<input value={codigo} maxLength={100} onChange={e=>setCodigo(e.target.value)} placeholder="Código cadastrado no CRM"/></label>
         <label>Ficha comercial aprovada<textarea value={base} maxLength={16000} rows={7} style={{width:'100%',minWidth:0}} onChange={e=>setBase(e.target.value)} placeholder="Insira somente informações comerciais aprovadas pelo cliente."/></label>
         <button type="button" className="salvar" disabled={ocupado||!canal||!funil||!codigo||modo!=='simulacao'} onClick={()=>void salvarFicha()}>{ocupado?'Salvando…':'Salvar informações do imóvel'}</button>
       </div>
     </details>
     {aviso&&<p role="status">{aviso}</p>}
   </section>;
}
