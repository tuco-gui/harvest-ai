'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { classificarPrazo, filtrarTarefas, validarNovaTarefa, dataLocalParaInput,
  type FiltroTarefa, type TarefaCrm } from '@/lib/crmTarefas';

type OportunidadeResumo = {
  id: number; empresa: string; contato: string; owner_id: string | null; estagio: string;
};
type Owner = { id: string; nome: string };
const FILTROS: { id: FiltroTarefa; nome: string }[] = [
  { id: 'abertas', nome: 'Em aberto' }, { id: 'atrasadas', nome: 'Atrasadas' },
  { id: 'hoje', nome: 'Hoje' }, { id: 'proximas', nome: 'Próximas' },
  { id: 'concluidas', nome: 'Concluídas' }, { id: 'todas', nome: 'Todas' },
];

export default function CentralTarefasCrm({
  owners, perfilId, podeEditar,
}: { owners: Owner[]; perfilId: string; podeEditar: boolean }) {
  const [tarefas, setTarefas] = useState<TarefaCrm[]>([]);
  const [oportunidades, setOportunidades] = useState<OportunidadeResumo[]>([]);
  const [filtro, setFiltro] = useState<FiltroTarefa>('abertas');
  const [owner, setOwner] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<number | null>(null);
  const [nova, setNova] = useState({ oportunidade_id: '', titulo: '', descricao: '', vence_em: '' });
  const nomeOwner = (id: string | null) => owners.find(x => x.id === id)?.nome
    ?? (id ? 'Responsável da oportunidade' : 'Sem responsável');

  async function carregar() {
    setCarregando(true);
    try {
      const resposta = await fetch('/api/crm/tarefas', { cache: 'no-store' });
      const d = await resposta.json();
      if (!resposta.ok) throw new Error(d.erro ?? 'Falha ao consultar tarefas.');
      setOportunidades(d.oportunidades ?? []);
      setTarefas((d.tarefas ?? []).map((t: TarefaCrm) => ({
        ...t, responsavel_nome: nomeOwner(t.owner_id),
      })));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o CRM.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  const visiveis = useMemo(() => filtrarTarefas(tarefas, filtro, busca, owner),
    [tarefas, filtro, busca, owner]);
  const abertas = tarefas.filter(t => !t.concluida);
  const atrasadas = abertas.filter(t => classificarPrazo(t.vence_em, false) === 'atrasada');
  const paraHoje = abertas.filter(t => classificarPrazo(t.vence_em, false) === 'hoje');

  async function alternar(t: TarefaCrm) {
    if (enviando) return;
    setErro(''); setMensagem(''); setEnviando(true);
    try {
      const res = await fetch('/api/crm/tarefas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, concluida: !t.concluida }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro ?? 'Falha ao atualizar tarefa.');
      setTarefas(antigas => antigas.map(x => x.id === t.id
        ? { ...x, concluida: d.tarefa.concluida } : x));
      setMensagem(d.tarefa.concluida ? 'Tarefa concluída.' : 'Tarefa reaberta.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar.');
    } finally { setEnviando(false); }
  }

  function editar(t: TarefaCrm) {
    if (enviando) return;
    setEmEdicao(t.id);
    setNova({
      oportunidade_id: String(t.oportunidade_id), titulo: t.titulo,
      descricao: t.descricao || '', vence_em: dataLocalParaInput(t.vence_em),
    });
    setNovoAberto(true); setErro(''); setMensagem('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function excluir(t: TarefaCrm) {
    if (enviando) return;
    if (!window.confirm(`Excluir definitivamente a tarefa "${t.titulo}"? O negócio não será excluído.`)) return;
    setEnviando(true); setErro(''); setMensagem('');
    try {
      const r = await fetch('/api/crm/tarefas', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro ao excluir tarefa.');
      setTarefas(prev => prev.filter(x => x.id !== t.id));
      if (emEdicao === t.id) { setNovoAberto(false); setEmEdicao(null); }
      setMensagem('Tarefa excluída. A oportunidade e demais atividades permanecem intactas.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.');
    } finally {
      setEnviando(false);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const falha = validarNovaTarefa(nova.titulo, nova.vence_em, nova.descricao);
    if (falha) { setErro(falha); return; }
    if (!nova.oportunidade_id) { setErro('Selecione uma oportunidade.'); return; }
    setErro(''); setMensagem(''); setEnviando(true);
    try {
      const res = await fetch('/api/crm/tarefas', {
        method: emEdicao ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nova, ...(emEdicao ? { id: emEdicao } : {}),
          oportunidade_id: Number(nova.oportunidade_id),
          vence_em: nova.vence_em ? new Date(nova.vence_em).toISOString() : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.erro ?? 'Não foi possível criar a tarefa.');
      setNova({ oportunidade_id: '', titulo: '', descricao: '', vence_em: '' });
      setNovoAberto(false); setEmEdicao(null);
      setMensagem(emEdicao ? 'Tarefa atualizada.' : 'Tarefa criada e vinculada à oportunidade.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar tarefa.');
    } finally { setEnviando(false); }
  }

  return (
    <main className="pagina pagina-larga crm-tarefas">
      <div className="crm-tarefas-caminho"><Link href="/crm">CRM</Link><span> / </span>Tarefas</div>
      <header className="crm-tarefas-header">
        <div>
          <p className="label">CRM · OPERACIONAL</p>
          <h1>Central de tarefas</h1>
          <p className="ajuda">Prazos e próximos passos vinculados às oportunidades do funil.</p>
        </div>
        {podeEditar && <button type="button" className="btn-primario" onClick={() => {
          setNovoAberto(v => !v); setEmEdicao(null);
          setNova({ oportunidade_id: '', titulo: '', descricao: '', vence_em: '' }); setErro('');
        }}>{novoAberto ? 'Fechar' : '+ Nova tarefa'}</button>}
      </header>

      <section className="crm-tarefas-kpis" aria-label="Resumo das tarefas">
        <button type="button" onClick={() => setFiltro('abertas')}><span>Em aberto</span><strong>{abertas.length}</strong></button>
        <button type="button" onClick={() => setFiltro('atrasadas')}><span>Atrasadas</span><strong>{atrasadas.length}</strong></button>
        <button type="button" onClick={() => setFiltro('hoje')}><span>Para hoje</span><strong>{paraHoje.length}</strong></button>
        <button type="button" onClick={() => setFiltro('concluidas')}><span>Concluídas</span><strong>{tarefas.length - abertas.length}</strong></button>
      </section>

      {novoAberto && <form className="crm-tarefas-form" onSubmit={criar}>
        <h2>{emEdicao ? 'Editar tarefa' : 'Nova tarefa'}</h2>
        <label>Oportunidade
          <select required disabled={emEdicao !== null} value={nova.oportunidade_id}
            onChange={e => setNova(n => ({ ...n, oportunidade_id: e.target.value }))}>
            <option value="">Selecionar negócio</option>
            {oportunidades.map(o => <option key={o.id} value={o.id}>
              {o.empresa || o.contato || 'Negócio sem nome'} · {o.estagio}
            </option>)}
          </select>
        </label>
        <label>Título
          <input required minLength={3} maxLength={180} value={nova.titulo}
            placeholder="Ex.: Ligar para confirmar proposta"
            onChange={e => setNova(n => ({ ...n, titulo: e.target.value }))}/>
        </label>
        <label>Prazo
          <input type="datetime-local" value={nova.vence_em}
            onChange={e => setNova(n => ({ ...n, vence_em: e.target.value }))}/>
        </label>
        <label>Descrição (opcional)
          <textarea maxLength={2000} value={nova.descricao}
            onChange={e => setNova(n => ({ ...n, descricao: e.target.value }))}/>
        </label>
        <p className="ajuda">A tarefa será atribuída ao responsável da oportunidade selecionada.</p>
        <button type="submit" className="btn-primario" disabled={enviando || !oportunidades.length}>
          {enviando ? 'Salvando…' : emEdicao ? 'Salvar alterações' : 'Criar tarefa'}
        </button>
      </form>}

      <div className="crm-tarefas-filtros" aria-label="Filtros de tarefas">
        <div className="crm-tarefas-abas">
          {FILTROS.map(f => <button type="button" key={f.id}
            aria-pressed={f.id === filtro} className={f.id === filtro ? 'ativa' : ''}
            onClick={() => setFiltro(f.id)}>{f.nome}</button>)}
        </div>
        <input aria-label="Buscar tarefas" placeholder="Buscar título, empresa ou contato"
          value={busca} onChange={e => setBusca(e.target.value)}/>
        <select aria-label="Filtrar responsável" value={owner} onChange={e => setOwner(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          <option value={perfilId}>Minhas oportunidades</option>
          {owners.filter(o => o.id !== perfilId).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <button type="button" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar tarefas">
          {carregando ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {erro && <div className="crm-aviso" role="alert">{erro}</div>}
      {mensagem && <p className="ajuda" role="status">{mensagem}</p>}
      <section className="crm-tarefas-lista" aria-label="Lista de tarefas">
        <div className="crm-tarefas-lista-topo"><strong>{visiveis.length} tarefa(s)</strong>
          <span>Dados da workspace ativa · Até 500 registros</span></div>
        {carregando && <p className="crm-tarefas-vazio">Carregando…</p>}
        {!carregando && visiveis.length === 0 && <div className="crm-tarefas-vazio">
          <strong>Nenhuma tarefa neste filtro.</strong>
          <p>Crie uma tarefa ou ajuste os filtros para visualizar o trabalho da equipe.</p>
        </div>}
        {!carregando && visiveis.map(t => {
          const estado = classificarPrazo(t.vence_em, t.concluida);
          return <article key={t.id} className={'crm-tarefa-item ' + (t.concluida ? 'concluida' : '')}>
            <input type="checkbox" aria-label={'Concluir tarefa: ' + t.titulo}
              checked={t.concluida} disabled={enviando} onChange={() => void alternar(t)}/>
            <div className="crm-tarefa-info">
              <strong>{t.titulo}</strong>
              {t.descricao && <p>{t.descricao}</p>}
              <div className="crm-tarefa-meta">
                <Link href={'/crm?oportunidade=' + t.oportunidade_id}>
                  {t.empresa || t.contato}
                </Link>
                <span>{t.responsavel_nome}</span>
                {t.vence_em && <span className={'crm-tarefa-prazo ' + estado}>
                  {new Date(t.vence_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>}
                {!t.vence_em && <span>Sem prazo</span>}
              </div>
            </div>
            <div className="crm-tarefa-acoes">
              <button type="button" disabled={enviando} onClick={() => editar(t)}
                aria-label={'Editar tarefa: ' + t.titulo}>Editar</button>
              <button type="button" disabled={enviando} onClick={() => void excluir(t)}
                aria-label={'Excluir tarefa: ' + t.titulo}>Excluir</button>
            </div>
            <span className="crm-tarefa-status">{t.concluida ? 'Concluída' : estado === 'atrasada' ? 'Atrasada' : 'Pendente'}</span>
          </article>;
        })}
      </section>
    </main>
  );
}
