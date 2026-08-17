'use client';

import { useMemo, useState } from 'react';
import {
  ESTAGIOS_CRM, ESTAGIOS_ENCERRADOS, ESTAGIOS_PIPELINE,
  probabilidadeEstagio,
} from '@/lib/crmStages';
import type { Oportunidade } from '@/lib/twenty';

type Owner = { id: string; nome: string };
type Campanha = { id: number; nome: string };
type Canal = { id: number; nome: string; numero: string | null; provider: string };
type Atividade = {
  id: number; tipo: string; titulo: string; descricao: string | null;
  concluida: boolean; vence_em: string | null; criado_em: string;
};
type Mensagem = {
  id: string; direcao: 'entrada' | 'saida'; texto: string; status: string;
  data: string; erro?: string | null; nome?: string | null;
};

const NOVA_OPORTUNIDADE = {
  empresa: '', contato: '', telefone: '', email: '', origem: 'manual',
  campanha_id: '', estagio: 'novo', owner_id: '', valor: '', probabilidade: '5',
  proxima_acao: '', previsao_fechamento: '', observacoes: '', tags: '',
};

export default function CrmPipeline({ oportunidades, owners, campanhas, canais }: {
  oportunidades: Oportunidade[];
  owners: Owner[];
  campanhas: Campanha[];
  canais: Canal[];
}) {
  const [ops, setOps] = useState(oportunidades);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [estagioAlvo, setEstagioAlvo] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Oportunidade | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [nova, setNova] = useState(NOVA_OPORTUNIDADE);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ownerFiltro, setOwnerFiltro] = useState('');
  const [campanhaFiltro, setCampanhaFiltro] = useState('');
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [aba, setAba] = useState<'conversa' | 'atividades'>('conversa');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [carregandoContexto, setCarregandoContexto] = useState(false);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [canalId, setCanalId] = useState(String(canais[0]?.id ?? ''));
  const [enviando, setEnviando] = useState(false);
  const [novaAtividade, setNovaAtividade] = useState({ tipo: 'tarefa', titulo: '', vence_em: '' });

  const encerradosIds = useMemo(() => new Set(ESTAGIOS_ENCERRADOS.map((e) => e.id)), []);
  const visiveis = useMemo(() => ops.filter((op) => {
    const texto = `${op.empresa} ${op.contato} ${op.telefone ?? ''} ${(op.tags ?? []).join(' ')}`.toLowerCase();
    return (!busca || texto.includes(busca.toLowerCase()))
      && (!ownerFiltro || op.owner_id === ownerFiltro)
      && (!campanhaFiltro || String(op.campanha_id ?? '') === campanhaFiltro)
      && (mostrarEncerrados ? encerradosIds.has(op.estagio) : !encerradosIds.has(op.estagio));
  }), [ops, busca, ownerFiltro, campanhaFiltro, mostrarEncerrados, encerradosIds]);

  const metricas = useMemo(() => {
    const abertos = ops.filter((o) => !encerradosIds.has(o.estagio) && o.estagio !== 'ganho');
    return {
      abertas: abertos.length,
      valorAberto: abertos.reduce((s, o) => s + Number(o.valor || 0), 0),
      ponderado: abertos.reduce((s, o) => s + Number(o.valor || 0) * Number(o.probabilidade || 0) / 100, 0),
      ganhos: ops.filter((o) => o.estagio === 'ganho').length,
      respostas: ops.filter((o) => ['respondeu', 'qualificando', 'reuniao', 'proposta', 'ganho'].includes(o.estagio)).length,
    };
  }, [ops, encerradosIds]);

  const estagios = mostrarEncerrados ? ESTAGIOS_ENCERRADOS : ESTAGIOS_PIPELINE;
  const agrupar = (estagio: string) => visiveis.filter((o) => o.estagio === estagio);
  const nomeOwner = (id: string | null) => owners.find((o) => o.id === id)?.nome ?? 'Sem responsável';
  const nomeCampanha = (id: number | null) => campanhas.find((c) => c.id === id)?.nome ?? null;
  const valorFmt = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataFmt = (v: string | null | undefined) => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  async function json(r: Response) { return r.json().catch(() => ({})); }

  async function abrirFicha(op: Oportunidade) {
    setFicha(op); setAba('conversa'); setErro(null); setCarregandoContexto(true);
    const [mr, ar] = await Promise.all([
      fetch(`/api/crm/oportunidades/${op.id}/mensagens`),
      fetch(`/api/crm/oportunidades/${op.id}/atividades`),
    ]);
    const [md, ad] = await Promise.all([json(mr), json(ar)]);
    setMensagens(mr.ok ? md.mensagens ?? [] : []);
    setAtividades(ar.ok ? ad.atividades ?? [] : []);
    if (!mr.ok || !ar.ok) setErro(md.erro ?? ad.erro ?? 'Não consegui carregar todo o histórico.');
    setCarregandoContexto(false);
  }

  async function moverPara(op: Oportunidade, estagio: string) {
    if (op.estagio === estagio) return;
    const anterior = op;
    const atualizado = { ...op, estagio, probabilidade: probabilidadeEstagio(estagio) };
    setOps((atual) => atual.map((x) => x.id === op.id ? atualizado : x));
    const r = await fetch(`/api/crm/oportunidades/${op.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estagio }),
    });
    if (!r.ok) {
      const d = await json(r);
      setOps((atual) => atual.map((x) => x.id === op.id ? anterior : x));
      setErro(d.erro ?? 'Não consegui mover a oportunidade.');
    }
  }

  async function criarOportunidade(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro(null);
    const r = await fetch('/api/crm/oportunidades', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        ...nova, campanha_id: nova.campanha_id ? Number(nova.campanha_id) : null,
        owner_id: nova.owner_id || null, valor: Number(nova.valor) || 0,
        probabilidade: Number(nova.probabilidade) || 5,
        tags: nova.tags.split(',').map((v) => v.trim()).filter(Boolean),
        previsao_fechamento: nova.previsao_fechamento || null,
      }),
    });
    const d = await json(r); setSalvando(false);
    if (!r.ok) return setErro(d.erro ?? 'Não consegui criar a oportunidade.');
    setOps((atual) => [d.oportunidade, ...atual]); setNova(NOVA_OPORTUNIDADE); setNovaAberta(false);
    await abrirFicha(d.oportunidade);
  }

  async function salvarFicha(e: React.FormEvent) {
    e.preventDefault(); if (!ficha) return; setSalvando(true); setErro(null);
    const r = await fetch(`/api/crm/oportunidades/${ficha.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        empresa: ficha.empresa, contato: ficha.contato, telefone: ficha.telefone,
        email: ficha.email, estagio: ficha.estagio, owner_id: ficha.owner_id,
        valor: ficha.valor, probabilidade: ficha.probabilidade, campanha_id: ficha.campanha_id,
        tags: ficha.tags, proxima_acao: ficha.proxima_acao, observacoes: ficha.observacoes,
        previsao_fechamento: ficha.previsao_fechamento, motivo_perda: ficha.motivo_perda,
      }),
    });
    const d = await json(r); setSalvando(false);
    if (!r.ok) return setErro(d.erro ?? 'Não consegui salvar.');
    setFicha(d.oportunidade); setOps((atual) => atual.map((x) => x.id === ficha.id ? d.oportunidade : x));
  }

  async function enviarMensagem(e: React.FormEvent) {
    e.preventDefault(); if (!ficha || !textoMensagem.trim()) return; setEnviando(true); setErro(null);
    const r = await fetch(`/api/crm/oportunidades/${ficha.id}/mensagens`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textoMensagem, canal_id: Number(canalId) }),
    });
    const d = await json(r); setEnviando(false);
    if (!r.ok) return setErro(d.erro ?? 'Não consegui enviar a mensagem.');
    setTextoMensagem('');
    const historico = await fetch(`/api/crm/oportunidades/${ficha.id}/mensagens`);
    const hd = await json(historico); if (historico.ok) setMensagens(hd.mensagens ?? []);
    if (ficha.estagio === 'novo') {
      const atualizado = { ...ficha, estagio: 'contatado', probabilidade: 10 };
      setFicha(atualizado); setOps((atual) => atual.map((x) => x.id === ficha.id ? atualizado : x));
    }
  }

  async function adicionarAtividade(e: React.FormEvent) {
    e.preventDefault(); if (!ficha || !novaAtividade.titulo.trim()) return; setErro(null);
    const r = await fetch(`/api/crm/oportunidades/${ficha.id}/atividades`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...novaAtividade, vence_em: novaAtividade.vence_em || null }),
    });
    const d = await json(r);
    if (!r.ok) return setErro(d.erro ?? 'Não consegui registrar a atividade.');
    setAtividades((atual) => [d.atividade, ...atual]); setNovaAtividade({ tipo: 'tarefa', titulo: '', vence_em: '' });
  }

  async function alternarAtividade(a: Atividade) {
    if (!ficha) return;
    const r = await fetch(`/api/crm/oportunidades/${ficha.id}/atividades`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atividade_id: a.id, concluida: !a.concluida }),
    });
    if (r.ok) setAtividades((atual) => atual.map((x) => x.id === a.id ? { ...x, concluida: !x.concluida } : x));
  }

  return (
    <div className="crm-shell">
      <section className="crm-resumo" aria-label="Resumo do pipeline">
        <div><span>Oportunidades abertas</span><strong>{metricas.abertas}</strong></div>
        <div><span>Valor em aberto</span><strong>{valorFmt(metricas.valorAberto)}</strong></div>
        <div><span>Previsão ponderada</span><strong>{valorFmt(metricas.ponderado)}</strong></div>
        <div><span>Responderam</span><strong>{metricas.respostas}</strong></div>
        <div><span>Ganhos</span><strong>{metricas.ganhos}</strong></div>
      </section>

      <div className="crm-barra">
        <div className="crm-busca"><span>⌕</span><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, contato, telefone ou etiqueta" /></div>
        <select value={ownerFiltro} onChange={(e) => setOwnerFiltro(e.target.value)}><option value="">Todos os responsáveis</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select value={campanhaFiltro} onChange={(e) => setCampanhaFiltro(e.target.value)}><option value="">Todas as campanhas</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <button className="crm-alternar" type="button" onClick={() => setMostrarEncerrados((v) => !v)}>{mostrarEncerrados ? 'Ver pipeline' : 'Ver encerrados'}</button>
        <button className="btn-primario crm-nova" type="button" onClick={() => { setNovaAberta(true); setErro(null); }}>+ Nova oportunidade</button>
      </div>

      {erro && <div className="crm-aviso" role="alert">{erro}<button type="button" onClick={() => setErro(null)}>×</button></div>}

      <div className={`crm-kanban ${mostrarEncerrados ? 'crm-kanban-encerrados' : ''}`}>
        {estagios.map((est) => {
          const itens = agrupar(est.id);
          const total = itens.reduce((s, o) => s + Number(o.valor || 0), 0);
          return <section key={est.id} className={'crm-coluna' + (estagioAlvo === est.id ? ' coluna-alvo' : '')}
            onDragOver={(e) => { e.preventDefault(); setEstagioAlvo(est.id); }}
            onDragLeave={() => setEstagioAlvo((s) => s === est.id ? null : s)}
            onDrop={() => { const op = ops.find((o) => o.id === arrastando); if (op) void moverPara(op, est.id); setArrastando(null); setEstagioAlvo(null); }}>
            <header className="crm-coluna-cabecalho"><div><span className={`crm-estagio-ponto crm-estagio-${est.id}`} />{est.nome}</div><b>{itens.length}</b><small>{valorFmt(total)}</small></header>
            <ul className="crm-coluna-cards">
              {itens.map((op) => <li key={op.id} className="crm-cartao" draggable
                onDragStart={() => setArrastando(op.id)} onDragEnd={() => { setArrastando(null); setEstagioAlvo(null); }} onClick={() => void abrirFicha(op)}>
                <div className="crm-cartao-topo"><strong>{op.empresa || op.contato || 'Sem nome'}</strong><span>{op.probabilidade ?? 0}%</span></div>
                {op.contato && op.empresa && <p>{op.contato}</p>}<div className="crm-cartao-valor">{valorFmt(op.valor)}</div>
                {nomeCampanha(op.campanha_id) && <span className="crm-tag">{nomeCampanha(op.campanha_id)}</span>}
                {(op.tags ?? []).slice(0, 2).map((tag) => <span className="crm-tag" key={tag}>{tag}</span>)}
                <footer><span>{nomeOwner(op.owner_id)}</span>{op.proxima_acao && <time title={op.proxima_acao}>Próxima ação</time>}</footer>
              </li>)}
              {!itens.length && <li className="crm-coluna-vazia">Nenhuma oportunidade</li>}
            </ul>
          </section>;
        })}
      </div>

      {novaAberta && <div className="crm-overlay" onMouseDown={() => setNovaAberta(false)}><section className="crm-modal-nova" onMouseDown={(e) => e.stopPropagation()}>
        <header className="drawer-cabecalho"><div><span className="label">CRM</span><h2>Nova oportunidade</h2></div><button type="button" onClick={() => setNovaAberta(false)}>×</button></header>
        <form className="crm-form-grid" onSubmit={criarOportunidade}>
          <label className="campo-largo">Empresa<input autoFocus required value={nova.empresa} onChange={(e) => setNova({ ...nova, empresa: e.target.value })} /></label>
          <label>Contato<input value={nova.contato} onChange={(e) => setNova({ ...nova, contato: e.target.value })} /></label>
          <label>Telefone<input value={nova.telefone} onChange={(e) => setNova({ ...nova, telefone: e.target.value })} /></label>
          <label>E-mail<input type="email" value={nova.email} onChange={(e) => setNova({ ...nova, email: e.target.value })} /></label>
          <label>Responsável<select value={nova.owner_id} onChange={(e) => setNova({ ...nova, owner_id: e.target.value })}><option value="">Sem responsável</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>
          <label>Campanha/origem<select value={nova.campanha_id} onChange={(e) => setNova({ ...nova, campanha_id: e.target.value })}><option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label>Etapa<select value={nova.estagio} onChange={(e) => setNova({ ...nova, estagio: e.target.value, probabilidade: String(probabilidadeEstagio(e.target.value)) })}>{ESTAGIOS_CRM.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
          <label>Valor<input type="number" min="0" step="0.01" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} /></label>
          <label>Probabilidade<input type="number" min="0" max="100" value={nova.probabilidade} onChange={(e) => setNova({ ...nova, probabilidade: e.target.value })} /></label>
          <label>Previsão de fechamento<input type="date" value={nova.previsao_fechamento} onChange={(e) => setNova({ ...nova, previsao_fechamento: e.target.value })} /></label>
          <label className="campo-largo">Etiquetas <small>separadas por vírgula</small><input value={nova.tags} onChange={(e) => setNova({ ...nova, tags: e.target.value })} /></label>
          <label className="campo-largo">Próxima ação<textarea value={nova.proxima_acao} onChange={(e) => setNova({ ...nova, proxima_acao: e.target.value })} /></label>
          <div className="crm-form-acoes campo-largo"><button type="button" onClick={() => setNovaAberta(false)}>Cancelar</button><button className="btn-primario" disabled={salvando}>{salvando ? 'Criando…' : 'Criar oportunidade'}</button></div>
        </form>
      </section></div>}

      {ficha && <div className="crm-overlay" onMouseDown={() => setFicha(null)}><section className="crm-ficha" onMouseDown={(e) => e.stopPropagation()}>
        <header className="drawer-cabecalho"><div><span className="label">Oportunidade #{ficha.id}</span><h2>{ficha.empresa || ficha.contato}</h2></div><button type="button" aria-label="Fechar" onClick={() => setFicha(null)}>×</button></header>
        <div className="crm-ficha-corpo">
          <form className="crm-ficha-dados" onSubmit={salvarFicha}><div className="crm-form-grid">
            <label className="campo-largo">Empresa<input value={ficha.empresa} onChange={(e) => setFicha({ ...ficha, empresa: e.target.value })} /></label>
            <label>Contato<input value={ficha.contato} onChange={(e) => setFicha({ ...ficha, contato: e.target.value })} /></label>
            <label>Telefone<input value={ficha.telefone ?? ''} onChange={(e) => setFicha({ ...ficha, telefone: e.target.value })} /></label>
            <label>E-mail<input value={ficha.email ?? ''} onChange={(e) => setFicha({ ...ficha, email: e.target.value })} /></label>
            <label>Etapa<select value={ficha.estagio} onChange={(e) => setFicha({ ...ficha, estagio: e.target.value, probabilidade: probabilidadeEstagio(e.target.value) })}>{ESTAGIOS_CRM.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
            <label>Responsável<select value={ficha.owner_id ?? ''} onChange={(e) => setFicha({ ...ficha, owner_id: e.target.value || null })}><option value="">Sem responsável</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>
            <label>Valor<input type="number" min="0" step="0.01" value={ficha.valor} onChange={(e) => setFicha({ ...ficha, valor: Number(e.target.value) })} /></label>
            <label>Probabilidade<input type="number" min="0" max="100" value={ficha.probabilidade} onChange={(e) => setFicha({ ...ficha, probabilidade: Number(e.target.value) })} /></label>
            <label>Previsão<input type="date" value={ficha.previsao_fechamento ?? ''} onChange={(e) => setFicha({ ...ficha, previsao_fechamento: e.target.value || null })} /></label>
            <label className="campo-largo">Campanha/origem<select value={ficha.campanha_id ?? ''} onChange={(e) => setFicha({ ...ficha, campanha_id: e.target.value ? Number(e.target.value) : null })}><option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <label className="campo-largo">Etiquetas<input value={(ficha.tags ?? []).join(', ')} onChange={(e) => setFicha({ ...ficha, tags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></label>
            <label className="campo-largo">Próxima ação<textarea value={ficha.proxima_acao ?? ''} onChange={(e) => setFicha({ ...ficha, proxima_acao: e.target.value })} /></label>
            {encerradosIds.has(ficha.estagio) && <label className="campo-largo">Motivo do encerramento<textarea value={ficha.motivo_perda ?? ''} onChange={(e) => setFicha({ ...ficha, motivo_perda: e.target.value })} /></label>}
            <label className="campo-largo">Observações<textarea value={ficha.observacoes ?? ''} onChange={(e) => setFicha({ ...ficha, observacoes: e.target.value })} /></label>
          </div><div className="crm-meta">Criada em {dataFmt(ficha.criado_em)} · Atualizada em {dataFmt(ficha.atualizado_em)}</div><button className="btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button></form>

          <div className="crm-ficha-contexto"><nav className="crm-abas"><button type="button" className={aba === 'conversa' ? 'ativa' : ''} onClick={() => setAba('conversa')}>Conversa</button><button type="button" className={aba === 'atividades' ? 'ativa' : ''} onClick={() => setAba('atividades')}>Atividades <span>{atividades.filter((a) => !a.concluida).length}</span></button></nav>
            {carregandoContexto ? <div className="crm-contexto-vazio">Carregando histórico…</div> : aba === 'conversa' ? <div className="crm-conversa">
              <div className="crm-mensagens">{!mensagens.length && <div className="crm-contexto-vazio"><strong>Nenhuma conversa ainda</strong><p>Envie a primeira mensagem por um canal conectado.</p></div>}{mensagens.map((m) => <article key={m.id} className={`crm-mensagem ${m.direcao}`}><p>{m.texto}</p><footer><span>{m.status}</span><time>{dataFmt(m.data)}</time></footer>{m.erro && <small>{m.erro}</small>}</article>)}</div>
              <form className="crm-compositor" onSubmit={enviarMensagem}><textarea value={textoMensagem} onChange={(e) => setTextoMensagem(e.target.value)} placeholder={ficha.telefone ? 'Digite uma mensagem…' : 'Cadastre um telefone para conversar'} disabled={!ficha.telefone || !canais.length} /><div><select value={canalId} onChange={(e) => setCanalId(e.target.value)} disabled={!canais.length}><option value="">{canais.length ? 'Escolha o canal' : 'Nenhum canal conectado'}</option>{canais.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.numero ? ` · ${c.numero}` : ''}</option>)}</select><button className="btn-primario" disabled={enviando || !textoMensagem.trim() || !canalId}>{enviando ? 'Enviando…' : 'Enviar'}</button></div></form>
            </div> : <div className="crm-atividades"><form onSubmit={adicionarAtividade} className="crm-nova-atividade"><select value={novaAtividade.tipo} onChange={(e) => setNovaAtividade({ ...novaAtividade, tipo: e.target.value })}><option value="tarefa">Tarefa</option><option value="nota">Nota</option><option value="ligacao">Ligação</option><option value="reuniao">Reunião</option><option value="email">E-mail</option></select><input value={novaAtividade.titulo} onChange={(e) => setNovaAtividade({ ...novaAtividade, titulo: e.target.value })} placeholder="O que precisa ser feito?" /><input type="datetime-local" value={novaAtividade.vence_em} onChange={(e) => setNovaAtividade({ ...novaAtividade, vence_em: e.target.value })} /><button className="btn-primario">Adicionar</button></form><ul>{atividades.map((a) => <li key={a.id} className={a.concluida ? 'concluida' : ''}><button type="button" className="crm-check" onClick={() => void alternarAtividade(a)}>{a.concluida ? '✓' : ''}</button><div><span className="crm-tipo">{a.tipo}</span><strong>{a.titulo}</strong>{a.descricao && <p>{a.descricao}</p>}<small>{a.vence_em ? `Prazo ${dataFmt(a.vence_em)}` : `Registrado ${dataFmt(a.criado_em)}`}</small></div></li>)}</ul>{!atividades.length && <div className="crm-contexto-vazio">Nenhuma atividade registrada.</div>}</div>}
          </div>
        </div>
      </section></div>}
    </div>
  );
}
