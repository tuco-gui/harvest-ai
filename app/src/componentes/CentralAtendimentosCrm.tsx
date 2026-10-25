'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_ATENDIMENTO, type ConversaAtendimento,
  type StatusAtendimento } from '@/lib/crmAtendimentos';

type Atendente = { id: string; nome: string };
type Msg = { id: string; direcao: 'entrada' | 'saida'; texto: string; data: string; status: string | null };
type Detalhe = {
  telefone: string; timeline: Msg[]; nome: string | null;
  oportunidade: { id: number; estagio: string } | null;
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
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [carregando, setCarregando] = useState(true);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [status, setStatus] = useState<StatusAtendimento>('aberto');
  const [responsavel, setResponsavel] = useState('');
  const [etiquetas, setEtiquetas] = useState('');

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
    if (conversas.some(c => c.telefone === telefoneInicial)) setTelefone(telefoneInicial);
  }, [telefoneInicial, conversas, telefone]);

  useEffect(() => {
    if (!telefone) { setDetalhe(null); return; }
    if (!carregando && !conversas.some(c => c.telefone === telefone)) {
      setTelefone(null); setDetalhe(null); return;
    }
    const ctrl = new AbortController();
    setCarregandoDetalhe(true);
    fetch(`/api/crm/atendimentos/${encodeURIComponent(telefone)}`, {
      cache: 'no-store', signal: ctrl.signal,
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao carregar a conversa.');
      return d as Detalhe;
    }).then(d => { if (!ctrl.signal.aborted) setDetalhe(d); })
      .catch(e => { if (!ctrl.signal.aborted) { setDetalhe(null); setErro(e.message); } })
      .finally(() => { if (!ctrl.signal.aborted) setCarregandoDetalhe(false); });
    return () => ctrl.abort();
  }, [telefone]); // Seleção muda somente ao trocar de conversa.

  const selecionada = conversas.find(c => c.telefone === telefone);
  useEffect(() => {
    if (!selecionada || salvando) return;
    setStatus(selecionada.status);
    setResponsavel(selecionada.responsavel_id ?? '');
    setEtiquetas(selecionada.etiquetas.join(', '));
  }, [telefone, selecionada?.atualizado_em]);

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
      const tags = etiquetas.split(',').map(x => x.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        telefone: selecionada.telefone, status, etiquetas: tags,
      };
      if (podeAtribuir) body.responsavel_id = responsavel || null;
      const r = await fetch('/api/crm/atendimentos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Não foi possível atualizar o atendimento.');
      setConversas(antigas => antigas.map(c => c.telefone === selecionada.telefone
        ? { ...c, ...d.atendimento } : c));
      setAviso('Atendimento atualizado. Nenhuma mensagem foi enviada.');
      // Operador perde visibilidade após eventual transferência feita por admin.
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally { setSalvando(false); }
  }

  const nomeAtendente = (id: string | null) =>
    atendentes.find(a => a.id === id)?.nome ?? (id ? 'Atendente atribuído' : 'Sem responsável');
  const data = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return <main className="crm-atendimentos">
    <header className="crm-atendimentos-topo">
      <div>
        <p className="label">CRM · ATENDIMENTO</p>
        <h1>Central de atendimento</h1>
        <p className="ajuda">Triagem, atribuição e encaminhamento humano das conversas recebidas.</p>
      </div>
      <Link href="/crm">Voltar ao pipeline</Link>
    </header>

    <div className="crm-atendimentos-corpo">
      <aside className="crm-atendimentos-lista">
        <div className="crm-atendimentos-resumo">
          <strong>{conversas.filter(c => c.status !== 'resolvido').length} em andamento</strong>
          <span>{conversas.filter(c => c.status === 'resolvido').length} resolvidos</span>
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
            className={c.telefone === telefone ? 'crm-atendimento-contato selecionado' : 'crm-atendimento-contato'}
            onClick={() => { setTelefone(c.telefone); setAviso(''); setErro(''); }} >
            <span className="crm-atendimento-contato-topo">
              <strong>{c.nome || c.telefone}</strong><time>{data(c.ultimaRecebida)}</time>
            </span>
            <span className="crm-atendimento-preview">{c.ultimaMensagem || 'Mensagem sem texto'}</span>
            <span className="crm-atendimento-contato-meta">
              <span className={'crm-atendimento-status ' + c.status}>{STATUS[c.status]}</span>
              <span>{nomeAtendente(c.responsavel_id)}</span>
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
            </div>
            <div className="crm-atendimento-links">
              {detalhe?.oportunidade && <Link href={'/crm?oportunidade=' + detalhe.oportunidade.id}>Abrir negócio</Link>}
              <Link href={'/inbox?telefone=' + encodeURIComponent(selecionada.telefone)}>Inbox original</Link>
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
              <label className="crm-atendimento-etiquetas">Etiquetas (separadas por vírgula)
                <input value={etiquetas} maxLength={240}
                  placeholder="Ex.: novo lead, proposta, urgente"
                  onChange={e => setEtiquetas(e.target.value)}/>
              </label>
            </div>
            {erro && <p role="alert" className="crm-aviso">{erro}</p>}
            {aviso && <p role="status" className="ajuda">{aviso}</p>}
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
