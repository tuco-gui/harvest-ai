'use client';

import Link from 'next/link';
import EncaminhamentoChatwootCRM from '@/componentes/EncaminhamentoChatwootCRM';
import SeletorEtiquetasCRM from '@/componentes/SeletorEtiquetasCRM';
import { estadoSla, NOMES_PRIORIDADE, PRIORIDADES, type Prioridade } from '@/lib/crmEtiquetas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_ATENDIMENTO, type ConversaAtendimento,
  type StatusAtendimento } from '@/lib/crmAtendimentos';

type Atendente = { id: string; nome: string };
type Msg = { id: string; direcao: 'entrada' | 'saida'; texto: string; data: string; status: string | null };
type Detalhe = {
  telefone: string; timeline: Msg[]; nome: string | null;
  oportunidade: { id: number; estagio: string; funil_id:number|null;canal_padrao_id:number|null } | null;
  canaisObservados:number[];canalSugeridoId:number|null;
  funilSugeridoId:number|null;canalAmbiguo:boolean;
};
const STATUS: Record<StatusAtendimento, string> = {
  aberto: 'Aberto', pendente: 'Aguardando', resolvido: 'Resolvido',
};
type Filtro = 'todos' | StatusAtendimento | 'sem_atendente' | 'meus';

export default function CentralAtendimentosCrm({ telefoneInicial }: { telefoneInicial?: string }) {
  const [conversas, setConversas] = useState<ConversaAtendimento[]>([]);
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [podeAtribuir, setPodeAtribuir] = useState(false);
  const [telefone, setTelefone] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [busca, setBusca] = useState('');
  const [canaisWhatsApp, setCanaisWhatsApp] = useState<Array<{id:number;nome:string;provider:string}>>([]);
  const [canalSelecionado, setCanalSelecionado] = useState('');
  const [canalFiltro,setCanalFiltro] = useState<number|null>(null);
  const [nomesCanais,setNomesCanais] = useState<Array<{id:number;nome:string;provider:string;status:string}>>([]);
  const [textoResposta, setTextoResposta] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [carregando, setCarregando] = useState(true);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [status, setStatus] = useState<StatusAtendimento>('aberto');
  const [responsavel, setResponsavel] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState<Prioridade>('normal');
  const [auditoria, setAuditoria] = useState<Array<{ id:number;tipo:string;anterior:Record<string,unknown>;novo:Record<string,unknown>;criado_em:string }>>([]);
  const [mostrarAuditoria, setMostrarAuditoria] = useState(false);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch('/api/crm/atendimentos', { cache: 'no-store', signal });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Não foi possível consultar a Inbox.');
      if (signal?.aborted) return;
      setConversas(d.conversas ?? []);
      setAtendentes(d.responsaveis ?? []);
      setPodeAtribuir(d.podeAtribuir === true);
      setErro('');
    } catch (e) {
      if (!signal?.aborted) setErro(e instanceof Error ? e.message : 'Falha na Inbox.');
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void carregar(ctrl.signal);
    // Somente consulta metadados; não envia mensagens ao WhatsApp.
    const timer = setInterval(() => void carregar(ctrl.signal), 30_000);
    return () => { ctrl.abort(); clearInterval(timer); };
  }, [carregar]);

  useEffect(() => {
    if (telefone || !telefoneInicial || !conversas.length) return;
    const alvo=conversas.find(c=>c.telefone===telefoneInicial);
    if(alvo){setCanalFiltro(alvo.canalId);setTelefone(alvo.telefone);}
  }, [telefoneInicial, conversas, telefone]);

  useEffect(() => {
    if (!telefone) { setDetalhe(null); return; }
    if (!carregando && !conversas.some(c => c.telefone === telefone && c.canalId===canalFiltro)) {
      setTelefone(null); setDetalhe(null); return;
    }
    const ctrl = new AbortController();
    setCarregandoDetalhe(true);
    setDetalhe(null);
    setCanalSelecionado('');
    fetch('/api/crm/atendimentos/'+encodeURIComponent(telefone)+
      '?canal_id='+(canalFiltro??0), {
      cache: 'no-store', signal: ctrl.signal,
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao carregar a conversa.');
      return d as Detalhe;
    }).then(d => { if (!ctrl.signal.aborted) setDetalhe(d); })
      .catch(e => { if (!ctrl.signal.aborted) { setDetalhe(null); setErro(e.message); } })
      .finally(() => { if (!ctrl.signal.aborted) setCarregandoDetalhe(false); });
    return () => ctrl.abort();
  }, [telefone,canalFiltro]); // Troca de canal filtra somente a conversa visualizada.

  useEffect(() => {
    const ctl=new AbortController();
    fetch('/api/canais',{signal:ctl.signal}).then(r=>r.json()).then(d=>{
      if(ctl.signal.aborted)return;
      const ativos=(d.canais??[]).filter((c:any)=>
        c.ativo && c.status==='conectado' && ['waha','evolution'].includes(c.provider));
      setCanaisWhatsApp(ativos.map((c:any)=>({id:c.id,nome:c.nome,provider:c.provider})));
      setNomesCanais((d.canais??[]).map((c:{id:number;nome:string;provider:string;status:string})=>({id:c.id,nome:c.nome,provider:c.provider,status:c.status})));
      if(ativos[0])setCanalSelecionado(String(ativos[0].id));
    }).catch(()=>{});
    return ()=>ctl.abort();
  },[]);
  useEffect(()=>{
    if(!detalhe)return;
    if(detalhe.canalAmbiguo && canalFiltro===null) {
      setCanalSelecionado('');return;
    }
    const escolhido=canalFiltro??detalhe.oportunidade?.canal_padrao_id??detalhe.canalSugeridoId;
    if(escolhido!=null) {
      const cadastrado=canaisWhatsApp.find(c=>c.id===escolhido);
      setCanalSelecionado(cadastrado?String(cadastrado.id):'');
    } else {
      setCanalSelecionado(String(canaisWhatsApp[0]?.id??''));
    }
  },[detalhe?.oportunidade?.id,detalhe?.oportunidade?.canal_padrao_id,detalhe?.canalSugeridoId,
     detalhe?.canalAmbiguo,canalFiltro,canaisWhatsApp]);
  const selecionada = conversas.find(c => c.telefone === telefone && c.canalId===canalFiltro);
  useEffect(() => {
    if (!telefone || !mostrarAuditoria) return;
    let cancelado = false;
    fetch('/api/crm/atendimentos/'+encodeURIComponent(telefone)+'/auditoria?canal_id='+(canalFiltro??0))
      .then(async r=>{const d=await r.json();if(!r.ok) throw Error(d.erro||'Falha na auditoria');return d;})
      .then(d=>{if(!cancelado)setAuditoria(d.eventos??[]);})
      .catch(e=>{if(!cancelado)setErro(e.message);});
    return ()=>{cancelado=true};
  },[telefone,canalFiltro,mostrarAuditoria,selecionada?.atualizado_em]);

  useEffect(() => {
    if (!selecionada || salvando) return;
    setStatus(selecionada.status);
    setResponsavel(selecionada.responsavel_id ?? '');
    setEtiquetas(selecionada.etiquetas);
    setPrioridade(selecionada.prioridade);
  }, [telefone,canalFiltro,selecionada?.atualizado_em]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return conversas.filter(c => {
      if (filtro === 'sem_atendente' && c.responsavel_id) return false;
      if (STATUS_ATENDIMENTO.includes(filtro as StatusAtendimento) && c.status !== filtro) return false;
      if (termo && ![c.nome || '', c.telefone, c.ultimaMensagem, ...c.etiquetas]
        .some(x => x.toLocaleLowerCase('pt-BR').includes(termo))) return false;
      return true;
    });
  }, [conversas, busca, filtro]);

  async function salvar() {
    if (!selecionada || salvando) return;
    setSalvando(true); setErro(''); setAviso('');
    try {
      const tags = etiquetas;
      const body: Record<string, unknown> = {
        telefone: selecionada.telefone, canal_id:selecionada.canalId??0, status, etiquetas: tags, prioridade,
      };
      if (podeAtribuir) body.responsavel_id = responsavel || null;
      const r = await fetch('/api/crm/atendimentos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Não foi possível atualizar o atendimento.');
      setConversas(antigas => antigas.map(c => c.telefone === selecionada.telefone && c.canalId===selecionada.canalId
        ? { ...c, ...d.atendimento } : c));
      setAviso('Atendimento atualizado. Nenhuma mensagem foi enviada.');
      // Operador perde visibilidade após eventual transferência feita por admin.
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally { setSalvando(false); }
  }

  async function criarNegocioDaConversa(){
    if(!selecionada || !podeAtribuir || carregandoDetalhe || !detalhe)return;
    setSalvando(true);setErro('');setAviso('');
    try{
      if(detalhe?.canalAmbiguo && canalFiltro===null)
        throw Error('Selecione o canal correto antes de criar um negócio.');
      let nomeEtapa='novo';
      if(detalhe?.funilSugeridoId!=null) {
        const rEtapas=await fetch('/api/funis/'+detalhe.funilSugeridoId+'/estagios');
        if(!rEtapas.ok)throw Error('Não foi possível conferir as etapas do funil.');
        const etapas=await rEtapas.json();
        const primeira=(etapas.estagios??[]).filter((e:{grupo:string})=>e.grupo==='pipeline')
          .sort((a:{ordem:number},b:{ordem:number})=>a.ordem-b.ordem)[0];
        if(!primeira)throw Error('O funil escolhido não possui uma etapa de entrada.');
        nomeEtapa=primeira.nome;
      }
      const r=await fetch('/api/crm/oportunidades',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({empresa:selecionada.nome||selecionada.telefone,
          contato:selecionada.nome||'',telefone:selecionada.telefone,
          origem:'inbox',estagio:nomeEtapa,funil_id:detalhe?.funilSugeridoId??null}),
      });
      const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível criar o negócio.');
      const rr=await fetch('/api/crm/atendimentos/'+encodeURIComponent(selecionada.telefone)+'?canal_id='+(canalFiltro??0),
        {cache:'no-store'});
      if(rr.ok)setDetalhe(await rr.json());
      setAviso('Negócio criado e vinculado à conversa. Nenhuma mensagem foi enviada.');
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao criar negócio.');}
    finally{setSalvando(false);}
  }

  async function responder(e:React.FormEvent) {
    e.preventDefault();
    if(carregandoDetalhe || !detalhe?.oportunidade || !textoResposta.trim() || !canalSelecionado || enviandoResposta)return;
    setEnviandoResposta(true);setErro('');setAviso('');
    try{
      const r=await fetch('/api/crm/oportunidades/'+detalhe.oportunidade.id+'/mensagens',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({texto:textoResposta.trim(),canal_id:Number(canalSelecionado)}),
      });
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'O envio não foi confirmado.');
      setTextoResposta('');
      const rr=await fetch('/api/crm/atendimentos/'+encodeURIComponent(detalhe.telefone)+'?canal_id='+(canalFiltro??0),{cache:'no-store'});
      if(rr.ok)setDetalhe(await rr.json());
      setAviso('Mensagem enviada pelo canal WhatsApp selecionado.');
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao enviar.');}
    finally{setEnviandoResposta(false);}
  }

  const contagemSlaVencido = conversas.filter(c=>estadoSla(c.prazo_triagem_em,c.status)==='vencido').length;
  const nomeAtendente = (id: string | null) =>
    atendentes.find(a => a.id === id)?.nome ?? (id ? 'Atendente atribuído' : 'Sem responsável');
  const data = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return <main className="crm-atendimentos">
    <header className="crm-atendimentos-topo">
      <div>
        <p className="label">CRM · ATENDIMENTO</p>
        <h1>Comunicação · Inbox</h1>
        <p className="ajuda">Triagem, atribuição e encaminhamento humano das conversas recebidas.</p>
      </div>
      <Link href="/crm">Voltar ao pipeline</Link>
    </header>

    <div className="crm-atendimentos-corpo">
      <aside className="crm-atendimentos-lista">
        <div className="crm-atendimentos-resumo">
          <strong>{conversas.filter(c => c.status !== 'resolvido').length} em andamento</strong>
          <span>{conversas.filter(c => c.status === 'resolvido').length} resolvidos · {contagemSlaVencido} SLA vencido(s)</span>
        </div>
        <input aria-label="Buscar conversas" placeholder="Buscar por nome, telefone ou etiqueta"
          value={busca} onChange={e => setBusca(e.target.value)}/>
        <div className="crm-atendimentos-filtros" role="group" aria-label="Situação do atendimento">
          {([
            ['todos','Todos'],['aberto','Abertos'],['pendente','Aguardando'],
            ['resolvido','Resolvidos'],['sem_atendente','Sem responsável'],
          ] as const).map(([id, nome]) => (
            <button key={id} type="button" aria-pressed={filtro === id}
              className={filtro === id ? 'ativa' : ''} onClick={() => setFiltro(id)}>{nome}</button>
          ))}
        </div>
        <div className="crm-atendimentos-scroll">
          {carregando && <p className="crm-atendimentos-vazio">Carregando conversas…</p>}
          {!carregando && !filtradas.length && <p className="crm-atendimentos-vazio">Nenhuma conversa neste filtro.</p>}
          {filtradas.map(c => <button type="button" key={c.telefone}
            className={c.telefone === telefone && c.canalId===canalFiltro ? 'crm-atendimento-contato selecionado' : 'crm-atendimento-contato'}
            onClick={() => { setCanalFiltro(c.canalId);setTelefone(c.telefone);setMostrarAuditoria(false);setAviso(''); setErro(''); }} >
            <span className="crm-atendimento-contato-topo">
              <strong>{c.nome || c.telefone}</strong><time>{data(c.ultimaRecebida)}</time>
            </span>
            <span className="crm-atendimento-preview">{c.ultimaMensagem || 'Mensagem sem texto'}</span>
            <span className="crm-atendimento-contato-meta">
              <span className={'crm-atendimento-status ' + c.status}>{STATUS[c.status]}</span>
              <span>{nomeAtendente(c.responsavel_id)}</span>
              {c.canaisObservados.length>0 && <span>
                {c.canaisObservados.length===1
                  ? nomesCanais.find(n=>n.id===c.canaisObservados[0])?.nome??'Canal identificado'
                  : c.canaisObservados.length+' canais distintos'}
              </span>}
              <span className={'crm-atendimento-prioridade '+c.prioridade}>{NOMES_PRIORIDADE[c.prioridade]}</span>
              {estadoSla(c.prazo_triagem_em,c.status)==='vencido'&&<span className="crm-sla-vencido">SLA vencido</span>}
            </span>
          </button>)}
        </div>
      </aside>

      <section className="crm-atendimento-detalhe" aria-label="Conversa selecionada">
        {!selecionada && <div className="crm-atendimentos-vazio">
          Selecione uma conversa para visualizar o histórico e gerenciar o atendimento.
        </div>}
        {selecionada && <>
          <header>
            <div>
              <strong>{selecionada.nome || selecionada.telefone}</strong>
              <span>{selecionada.telefone}</span>
              <span className="crm-inbox-seletor-canal">
                {canalFiltro===null ? 'Histórico legado · sem canal identificado'
                  : 'WhatsApp: '+(nomesCanais.find(n=>n.id===canalFiltro)?.nome??'Canal '+canalFiltro)}
              </span>
            </div>
            <div className="crm-atendimento-links">
              {detalhe?.oportunidade && <Link href={'/crm?oportunidade=' + detalhe.oportunidade.id}>Abrir negócio</Link>}
              
            </div>
          </header>
          {carregandoDetalhe ? <p className="crm-atendimentos-vazio">Carregando mensagens…</p> :
            <div className="crm-atendimento-mensagens">
              {(detalhe?.timeline ?? []).map(m => <article key={m.id}
                className={'crm-atendimento-mensagem ' + m.direcao}>
                <p>{m.texto}</p><small>{data(m.data)} · {m.direcao === 'entrada' ? 'Recebida' : m.status || 'Enviada'}</small>
              </article>)}
              {detalhe && !detalhe.timeline.length && <p>Nenhuma mensagem disponível.</p>}
            </div>}
          <div className="crm-inbox-compositor">
             {canalFiltro===null && <p className="ajuda">
               Estas mensagens são anteriores à identificação do canal e permanecem no histórico legado.
             </p>}
             {detalhe?.funilSugeridoId!=null && <p className="ajuda">
               Canal associado ao funil #{detalhe.funilSugeridoId}. Novo negócio será criado nele.
             </p>}
             {detalhe?.oportunidade?.canal_padrao_id!=null && !canaisWhatsApp.some(
               c=>c.id===detalhe.oportunidade?.canal_padrao_id) && (
               <p className="crm-aviso" role="status">O canal deste funil não está conectado.
                 Selecione outro manualmente para responder; não haverá troca automática.</p>
             )}
             {detalhe?.oportunidade && canaisWhatsApp.length>0 && !(detalhe.canalAmbiguo&&canalFiltro===null) ? (
               <form onSubmit={responder}>
                 <label>Responder pelo WhatsApp (WAHA/Evolution)
                   <textarea maxLength={4096} value={textoResposta}
                     onChange={e=>setTextoResposta(e.target.value)}
                     placeholder="Digite sua resposta…"/>
                 </label>
                 <select aria-label="Canal WhatsApp para resposta" value={canalSelecionado}
                   onChange={e=>setCanalSelecionado(e.target.value)}>
                   <option value="">Selecione um canal conectado</option>
                   {canaisWhatsApp.map(c=><option key={c.id} value={c.id}>{c.nome} · {c.provider}</option>)}
                 </select>
                 <button className="btn-primario" disabled={!textoResposta.trim()||!canalSelecionado||enviandoResposta} type="submit">
                   {enviandoResposta?'Enviando…':'Enviar resposta'}
                 </button>
               </form>
             ) : <p className="ajuda">{detalhe?.oportunidade
               ? 'Conecte um canal WAHA/Evolution da workspace para responder pelo WhatsApp.'
               : 'Vincule esta conversa a um negócio para habilitar resposta no WhatsApp existente.'}</p>}
             {!detalhe?.oportunidade && podeAtribuir && <button type="button"
               disabled={salvando||carregandoDetalhe||!detalhe||(detalhe?.canalAmbiguo===true&&canalFiltro===null)} onClick={()=>void criarNegocioDaConversa()}>
               Criar negócio a partir da conversa
             </button>}
           </div>
           <div className="crm-atendimento-editor">
            <h2>Gerenciar atendimento</h2>
            <div className="crm-atendimento-campos">
              <label>Situação
                <select value={status} onChange={e => setStatus(e.target.value as StatusAtendimento)}>
                  {STATUS_ATENDIMENTO.map(s => <option key={s} value={s}>{STATUS[s]}</option>)}
                </select>
              </label>
              <label>Responsável
                {podeAtribuir ? <select value={responsavel} onChange={e => setResponsavel(e.target.value)}>
                  <option value="">Sem responsável</option>
                  {atendentes.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select> : <div className="crm-atendimento-somente-leitura">
                  {nomeAtendente(selecionada.responsavel_id)}
                </div>}
              </label>
              <label>Prioridade
                <select value={prioridade} onChange={e=>setPrioridade(e.target.value as Prioridade)}>
                  {PRIORIDADES.map(p=><option key={p} value={p}>{NOMES_PRIORIDADE[p]}</option>)}
                </select>
              </label>
              <div className="crm-atendimento-etiquetas">
                <SeletorEtiquetasCRM selecionadas={etiquetas} onChange={setEtiquetas} limite={8} desabilitado={salvando}/>
              </div>
            </div>
            <div className="crm-atendimento-sla-indicador">
              <strong>SLA de triagem</strong>
              <span>{selecionada.prazo_triagem_em
                ? new Date(selecionada.prazo_triagem_em).toLocaleString('pt-BR')
                : 'Sem prazo'}</span>
              <span>{estadoSla(selecionada.prazo_triagem_em,selecionada.status)==='vencido'
                ? 'Prazo vencido' : estadoSla(selecionada.prazo_triagem_em,selecionada.status)==='em_risco'
                  ? 'Prazo próximo' : selecionada.status==='resolvido'?'Resolvido':'No prazo'}</span>
              <small>Meta de triagem calculada desde a última mensagem recebida. Não mede tempo real de resposta.</small>
            </div>
            <button type="button" className="crm-btn-auditoria" aria-expanded={mostrarAuditoria}
              onClick={()=>setMostrarAuditoria(x=>!x)}>
              {mostrarAuditoria?'Ocultar histórico das alterações':'Ver transferências e alterações'}
            </button>
            {mostrarAuditoria&&<ol className="crm-auditoria-eventos">
              {auditoria.map(a=><li key={a.id}><strong>{a.tipo}</strong>
                <time>{data(a.criado_em)}</time>
                <span>De: {JSON.stringify(a.anterior)}</span>
                <span>Para: {JSON.stringify(a.novo)}</span>
              </li>)}
              {!auditoria.length&&<li>Nenhuma alteração registrada ainda.</li>}
            </ol>}
            {erro && <p role="alert" className="crm-aviso">{erro}</p>}
            {aviso && <p role="status" className="ajuda">{aviso}</p>}
            {podeAtribuir && canalFiltro===null && <details><summary>Integração opcional com Chatwoot (histórico legado)</summary>
               <EncaminhamentoChatwootCRM telefone={selecionada.telefone}/>
             </details>}
            <div className="crm-atendimento-acoes">
              <p className="ajuda">A transferência altera somente o responsável pela conversa. Não movimenta negócios nem envia mensagens.</p>
              <button className="btn-primario" type="button" disabled={salvando} onClick={() => void salvar()}>
                {salvando ? 'Salvando…' : 'Salvar atendimento'}
              </button>
            </div>
          </div>
        </>}
      </section>
    </div>
    {erro && !selecionada && <p role="alert" className="crm-aviso">{erro}</p>}
  </main>;
}
