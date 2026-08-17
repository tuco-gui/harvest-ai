'use client';

import Link from 'next/link';
import { useState } from 'react';
import Modal from './Modal';
import { useRouter } from 'next/navigation';
import type { SituacaoContato } from '@/lib/situacaoContato';

type Lead = {
  id: number;
  place_id: string | null;
  empresa: string;
  telefone: string | null;
  telefone_original: string | null;
  endereco: string | null;
  especialidades: string | null;
  rating: number | null;
  reviews: number | null;
  site: string | null;
  tem_whatsapp: string; // 'sim' | 'nao' | 'nao_verificado'
  cnpj: string | null;
  decisor_nome: string | null;
  linkedin: string | null;
  email: string | null;
  email_status: string | null;
  erro_enriquecimento: string | null;
  disparo: string;
  situacao_contato: SituacaoContato;
};

type Canal = { id: number; nome: string; provider: string; status: string; ativo: boolean; padrao: boolean };

type Campanha = {
  id: number; nome: string; origem: string; encontradas: number; com_whatsapp: number;
  tipo?: string; status?: string;
  mensagem_modo?: string | null; mensagens?: string[] | null; contexto_ia?: string | null;
  cadencia_modo?: string; cadencia_min?: number | null; cadencia_max?: number | null;
  agendado_para?: string | null; agendado_timezone?: string | null;
  modo_envio_numero?: string; canal_ids?: number[];
};

type Metricas = {
  enviadas: number; leadsContatados: number; erros: number;
  bloqueados: number; respondidos: number; optouts: number; elegiveis?: number;
};

const NOME_ORIGEM: Record<string, string> = { busca: 'Busca', planilha: 'Planilha', manual: 'Manual' };

// Faixas de cadência (segundos entre envios) — nomes descritivos, sem rótulo
// de "seguro" (o quão seguro depende do canal/conta, não é fixo).
const CADENCIAS: Record<string, [number, number] | null> = {
  padrao: null, // usa intervaloMin/intervaloMax da conta
  rapida: [10, 25],
  moderada: [30, 60],
  conservadora: [60, 120],
  personalizada: null, // usa cadencia_min/cadencia_max da própria campanha
};

export default function CampanhaDetalhe({
  campanha, leads: leadsIniciais, intervaloMin, intervaloMax, canais, metricas,
}: {
  campanha: Campanha; leads: Lead[]; intervaloMin: number; intervaloMax: number; canais: Canal[];
  metricas?: Metricas;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(leadsIniciais);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [enriquecendo, setEnriquecendo] = useState<Set<number>>(new Set());
  const [disparando, setDisparando] = useState(false);
  const [pararRef] = useState({ atual: false });
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  // Hotfix P1: resultado REAL de cada disparo desta rodada — antes disso,
  // o card "já disparado" era marcado incondicionalmente pra todo lead
  // processado, mesmo quando o envio falhava ou era bloqueado por
  // supressão. Isso fazia a lista contradizer o que de fato saiu.
  const [resultadosDisparo, setResultadosDisparo] = useState<Record<number, 'enviado' | 'erro' | 'bloqueado'>>({});
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | SituacaoContato>('todos');

  // Número de envio (Fase 3B.1): fixo num canal escolhido, ou rodízio entre os ativos.
  const canaisConectados = canais.filter((c) => c.ativo && c.status === 'conectado');
  const [modoEnvio, setModoEnvio] = useState<'fixo' | 'rodizio'>(
    campanha.modo_envio_numero === 'rodizio' ? 'rodizio' : 'fixo',
  );
  const padrao = canaisConectados.find((c) => c.padrao) ?? canaisConectados[0];
  const canalSalvo = canaisConectados.find((c) => campanha.canal_ids?.[0] === c.id);
  const [canalFixoId, setCanalFixoId] = useState<number | null>(canalSalvo?.id ?? padrao?.id ?? null);
  const [canaisRodizio, setCanaisRodizio] = useState<Set<number>>(
    new Set(campanha.canal_ids?.filter((id) => canaisConectados.some((c) => c.id === id))
      ?? canaisConectados.map((c) => c.id)),
  );

  // A configuração de mensagem/cadência/agendamento agora mora na página
  // dedicada de edição (Entrega 22, ver CampanhaEditar.tsx) — aqui só resta
  // o status pra exibição.
  const statusAtual = campanha.status ?? 'em_execucao';

  // ---- Edição de lead (Entrega 22): modal institucional para nome/telefone/
  // categoria/endereço, chamando PATCH /api/leads/[id] (regra crítica de
  // telefone × supressão vive lá, não aqui). ----
  const [leadEditando, setLeadEditando] = useState<Lead | null>(null);
  const [formLead, setFormLead] = useState({ empresa: '', telefone: '', endereco: '', especialidades: '' });
  const [salvandoLead, setSalvandoLead] = useState(false);
  const [avisoLead, setAvisoLead] = useState<string | null>(null);

  function abrirEdicaoLead(l: Lead) {
    setLeadEditando(l);
    setFormLead({
      empresa: l.empresa ?? '',
      telefone: l.telefone_original ?? l.telefone ?? '',
      endereco: l.endereco ?? '',
      especialidades: l.especialidades ?? '',
    });
    setAvisoLead(null);
  }

  async function salvarLead() {
    if (!leadEditando) return;
    setSalvandoLead(true);
    setAvisoLead(null);
    try {
      const r = await fetch(`/api/leads/${leadEditando.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formLead),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAvisoLead(d.erro ?? 'Não consegui salvar o lead.'); return; }
      setLeads((atual) => atual.map((x) => (x.id === leadEditando.id ? {
        ...x, empresa: formLead.empresa, telefone_original: formLead.telefone,
        endereco: formLead.endereco, especialidades: formLead.especialidades,
      } : x)));
      if (d.avisoSupressao) { setAvisoLead(d.avisoSupressao); return; }
      setLeadEditando(null);
    } catch {
      setAvisoLead('Sem conexão com o servidor.');
    } finally {
      setSalvandoLead(false);
    }
  }

  const comZap = leads.filter((l) => l.tem_whatsapp === 'sim').length;
  const leadsVisiveis = filtroSituacao === 'todos'
    ? leads
    : leads.filter((lead) => lead.situacao_contato === filtroSituacao);

  function alternar(id: number) {
    setEscolhidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const todas = () => setEscolhidos(new Set(leads.map((l) => l.id)));
  const nenhuma = () => setEscolhidos(new Set());
  const soZap = () => setEscolhidos(new Set(leads.filter((l) => l.tem_whatsapp === 'sim').map((l) => l.id)));

  function alternarDetalhes(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function enriquecerUm(l: Lead) {
    if (!l.place_id) return;
    setEnriquecendo((s) => new Set(s).add(l.id));
    const r = await fetch('/api/enriquecer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: l.place_id }),
    });
    const d = await r.json();
    setEnriquecendo((s) => { const n = new Set(s); n.delete(l.id); return n; });
    setLeads((atual) => atual.map((x) => (x.id !== l.id ? x : r.ok ? {
      ...x, cnpj: d.cnpj ?? x.cnpj, decisor_nome: d.decisorNome, linkedin: d.linkedin,
      email: d.email, email_status: d.emailStatus,
      erro_enriquecimento: d.avisos?.length ? d.avisos.join(' · ') : null,
    } : { ...x, erro_enriquecimento: d.erro ?? 'Não consegui enriquecer.' })));
  }

  async function enriquecerSelecionados() {
    const alvos = leads.filter((l) => escolhidos.has(l.id) && l.place_id);
    if (!alvos.length) return;
    if (!confirm(`Enriquecer ${alvos.length} lead(s)? Cada um gasta crédito das APIs configuradas em Configurações.`)) return;
    for (const l of alvos) {
      // eslint-disable-next-line no-await-in-loop
      await enriquecerUm(l);
    }
  }

  // Cadência efetiva: personalizada usa min/max da própria campanha; um
  // preset (rápida/moderada/conservadora) usa a faixa fixa da UI; "padrão"
  // cai no intervalo configurado da conta (conta_config_envio), como antes.
  function cadenciaEfetiva(): [number, number] {
    const modo = campanha.cadencia_modo ?? 'padrao';
    if (modo === 'personalizada') {
      const min = Number(campanha.cadencia_min) || 1;
      const max = Number(campanha.cadencia_max) || min + 1;
      return [min, max];
    }
    const faixa = CADENCIAS[modo];
    if (faixa) return faixa;
    return [intervaloMin, intervaloMax];
  }

  async function dispararSelecionados() {
    const alvos = leads.filter((l) => escolhidos.has(l.id) && l.telefone);
    if (!alvos.length) return;
    if (!confirm(`Disparar mensagem pra ${alvos.length} lead(s) agora?`)) return;
    pararRef.atual = false;
    setDisparando(true);
    setResultadosDisparo({});
    setProgresso({ feito: 0, total: alvos.length });
    const [min, max] = cadenciaEfetiva();
    for (let i = 0; i < alvos.length; i++) {
      if (pararRef.atual) break;
      const l = alvos[i];
      const canalId = modoEnvio === 'fixo' ? canalFixoId : null;
      // Hotfix P1: o resultado exibido por lead agora reflete a resposta
      // real do disparo — sucesso (2xx/ok), bloqueado por supressão (403 +
      // suprimido:true) ou erro (qualquer outra falha, inclusive de rede).
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch('/api/disparo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: l, indice: i, campanhaId: campanha.id,
          canalId, canalIds: Array.from(canaisRodizio), modoEnvio,
        }),
      }).catch(() => null);
      // eslint-disable-next-line no-await-in-loop
      const dados = r ? await r.json().catch(() => ({})) : {};
      const resultado: 'enviado' | 'erro' | 'bloqueado' = r?.ok
        ? 'enviado'
        : dados?.suprimido ? 'bloqueado' : 'erro';
      setResultadosDisparo((atual) => ({ ...atual, [l.id]: resultado }));
      setLeads((atual) => atual.map((x) => (x.id === l.id && resultado === 'enviado' ? { ...x, disparo: 'sim' } : x)));
      setProgresso({ feito: i + 1, total: alvos.length });
      if (i < alvos.length - 1 && !pararRef.atual) {
        const espera = min + Math.random() * (max - min);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, espera * 1000));
      }
    }
    setDisparando(false);
    // As métricas do funil (enviadas/erros/bloqueados) e o status "já
    // disparado" persistido vêm do servidor (historico_contato) — sem isso,
    // a tela ficava com o número antigo até um F5 manual, mesmo com
    // mensagens realmente saindo.
    router.refresh();
  }

  function pararDisparo() { pararRef.atual = true; }

  return (
    <div className="pagina pagina-larga">
      <p className="ajuda"><Link href="/campanhas">← Campanhas</Link></p>
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, letterSpacing: '-.02em' }}>{campanha.nome}</h2>
      <p className="resumo-secao">
        {NOME_ORIGEM[campanha.origem] ?? campanha.origem} · {leads.length} lead(s) nesta campanha
        {statusAtual && <> · status: <b>{statusAtual}</b></>}
      </p>

      {metricas && (
        <section className="funil" aria-label="Métricas da campanha" style={{ marginBottom: 12 }}>
          <div className="etapa">
            <span className="num">{leads.length}</span>
            <span className="label">Leads na campanha</span>
          </div>
          <div className="etapa">
            <span className="num">{metricas.elegiveis ?? '—'}</span>
            <span className="label">Elegíveis</span>
          </div>
          <div className="etapa">
            <span className="num">{metricas.leadsContatados}</span>
            <span className="label">Leads contatados</span>
          </div>
          <div className="etapa">
            <span className="num">{metricas.enviadas}</span>
            <span className="label">Mensagens enviadas</span>
          </div>
          <div className="etapa">
            <span className="num">{metricas.respondidos}</span>
            <span className="label">Responderam</span>
          </div>
          {/* OPT-OUT ≠ ERRO. BLOQUEADO ≠ necessariamente OPT-OUT — três
             cartões separados em vez de somados, pra não misturar "o lead
             pediu pra parar" com "o disparo falhou tecnicamente" com "essa
             tentativa foi barrada por regra de supressão/duplicidade". */}
          <div className="etapa">
            <span className="num">{metricas.optouts}</span>
            <span className="label">Opt-outs</span>
          </div>
          <div className="etapa">
            <span className="num" style={{ color: metricas.bloqueados ? 'var(--ink-2)' : undefined }}>{metricas.bloqueados}</span>
            <span className="label">Bloqueados</span>
          </div>
          <div className="etapa">
            <span className="num" style={{ color: metricas.erros ? 'var(--red)' : undefined }}>{metricas.erros}</span>
            <span className="label">Erros</span>
          </div>
        </section>
      )}
      {metricas && metricas.optouts > 0 && (
        // Hotfix (item 9): a lógica de opt-out já bloqueia novo disparo em
        // produção (SAIR → supressão → /api/disparo recusa com 403) — o
        // texto aqui não pode sugerir o contrário.
        <p className="ajuda" style={{ marginTop: -6, marginBottom: 12 }}>
          <b>Opt-out</b>: pediu para não receber novas mensagens. Fica bloqueado para novos
          disparos nesta e em qualquer outra campanha da conta, até decisão em contrário.
        </p>
      )}

      <div className="barra-lista" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          Nome, leads, canal, mensagem, cadência e demais configurações desta campanha.
        </span>
        <Link href={`/campanhas/${campanha.id}/editar`} className="ver-detalhes" style={{ fontWeight: 600 }}>
          Editar campanha
        </Link>
      </div>

      <div className="barra-lista">
        <div className="acoes" style={{ flexWrap: 'wrap', rowGap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Número de envio:</span>
          <select
            value={modoEnvio}
            onChange={(e) => setModoEnvio(e.target.value as 'fixo' | 'rodizio')}
            style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}
          >
            <option value="fixo">Canal fixo</option>
            <option value="rodizio">Rodízio entre canais</option>
          </select>
          {modoEnvio === 'fixo' && (
            <select
              value={canalFixoId ?? ''}
              onChange={(e) => setCanalFixoId(e.target.value ? Number(e.target.value) : null)}
              style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}
            >
              <option value="">Canal padrão</option>
              {canaisConectados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.provider})
                </option>
              ))}
            </select>
          )}
          {modoEnvio === 'rodizio' && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {canaisConectados.map((c) => (
                <label key={c.id} style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  <input type="checkbox" checked={canaisRodizio.has(c.id)} onChange={() => {
                    setCanaisRodizio((atual) => {
                      const proximo = new Set(atual);
                      if (proximo.has(c.id)) proximo.delete(c.id); else proximo.add(c.id);
                      return proximo;
                    });
                  }} /> {c.nome}
                </label>
              ))}
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {canaisRodizio.size} canal(is) no rodízio
              </span>
            </div>
          )}
          {!canaisConectados.length && (
            <span style={{ fontSize: 12, color: 'var(--red)' }}>Nenhum canal conectado em Configurações → WhatsApp</span>
          )}
        </div>
      </div>

      <div className="barra-lista">
        <div className="acoes">
          <button type="button" onClick={todas}>Selecionar todas</button>
          <div className="sep" />
          <button type="button" onClick={nenhuma}>Limpar seleção</button>
          <div className="sep" />
          <button type="button" onClick={soZap}>Só com WhatsApp</button>
          <div className="sep" />
          <button type="button" disabled={!escolhidos.size} onClick={enriquecerSelecionados}>
            Enriquecer selecionados
          </button>
          <div className="sep" />
          {disparando ? (
            <button type="button" onClick={pararDisparo}>Parar disparo</button>
          ) : (
            <button type="button" disabled={!escolhidos.size || !canaisConectados.length
              || (modoEnvio === 'fixo' ? canalFixoId == null : canaisRodizio.size === 0)} onClick={dispararSelecionados}>
              Disparar selecionados
            </button>
          )}
        </div>
      </div>

      <div className="barra-lista">
        <div className="acoes" style={{ flexWrap: 'wrap', rowGap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Mostrar:</span>
          <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value as 'todos' | SituacaoContato)}
            style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
            <option value="todos">Todos ({leads.length})</option>
            <option value="respondido">Responderam</option>
            <option value="optout">Pediram para sair</option>
            <option value="sem_resposta">Enviados sem resposta</option>
            <option value="bloqueado">Bloqueados</option>
            <option value="erro">Erros</option>
            <option value="nao_contatado">Ainda não contatados</option>
          </select>
          {filtroSituacao !== 'todos' && <span className="ajuda">{leadsVisiveis.length} lead(s) neste filtro</span>}
        </div>
      </div>

      {progresso && (() => {
        const contagem = Object.values(resultadosDisparo).reduce(
          (acc, r) => ({ ...acc, [r]: acc[r] + 1 }),
          { enviado: 0, erro: 0, bloqueado: 0 } as Record<'enviado' | 'erro' | 'bloqueado', number>,
        );
        return (
          <p className="ajuda">
            {disparando ? 'Disparando' : 'Disparo concluído'} {progresso.feito} de {progresso.total}
            {intervaloMin && disparando ? ` — intervalo de ${intervaloMin}–${intervaloMax}s entre envios` : ''}
            {progresso.feito > 0 && (
              <> — {contagem.enviado} enviado(s){contagem.bloqueado ? `, ${contagem.bloqueado} bloqueado(s) por opt-out` : ''}
                {contagem.erro ? `, ${contagem.erro} com erro` : ''}.</>
            )}
          </p>
        );
      })()}

      <ul className="lista" role="listbox" aria-multiselectable>
        {leadsVisiveis.map((l) => {
          const marcado = escolhidos.has(l.id);
          return (
            <li
              key={l.id}
              className="linha"
              role="option"
              tabIndex={0}
              aria-selected={marcado}
              data-zap={l.tem_whatsapp === 'sim' ? 'sim' : 'nao'}
              onClick={() => alternar(l.id)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternar(l.id); } }}
            >
              <span className="marca-sel">
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.6L3.3 6 8 1" stroke="var(--sobre-ink)" strokeWidth="1.8" />
                </svg>
              </span>
              <span className="quem">
                <span className="nome">{l.empresa}</span>
                <span className="onde">{l.endereco ?? 'Endereço não informado'}</span>
                {l.especialidades && <span className="selo selo-ramo">{l.especialidades}</span>}
                {l.place_id && (
                  enriquecendo.has(l.id) ? (
                    <span className="ajuda" style={{ display: 'block' }}>Enriquecendo…</span>
                  ) : l.decisor_nome ? (
                    <span className="ajuda" style={{ display: 'block' }}>
                      {l.decisor_nome}{l.linkedin && ' · LinkedIn'}
                      {l.email_status === 'valid' && l.email ? ` · ${l.email}` : ''}
                    </span>
                  ) : l.erro_enriquecimento ? (
                    <span className="ajuda" style={{ display: 'block', color: 'var(--red)' }}>{l.erro_enriquecimento}</span>
                  ) : (
                    <button type="button" className="btn-teste" style={{ marginTop: 6, height: 26, fontSize: 11 }}
                            onClick={(e) => { e.stopPropagation(); enriquecerUm(l); }}>
                      Enriquecer
                    </button>
                  )
                )}
              </span>
              <span className="nota">
                {l.rating ? (
                  <><span className="num">{l.rating.toFixed(1).replace('.', ',')}</span><span>{l.reviews ?? 0}</span></>
                ) : <span>—</span>}
              </span>
              <span className="zap">
                <span className="selo" data-zap-selo={l.tem_whatsapp === 'sim' ? 'sim' : l.tem_whatsapp === 'nao' ? 'nao' : 'incerto'}>
                  {l.tem_whatsapp === 'sim' ? 'WhatsApp' : l.tem_whatsapp === 'nao' ? 'Sem WhatsApp' : 'Não verificado'}
                </span>
                <span className="zap-numero">{l.telefone_original ?? 'sem telefone'}</span>
                <span className="ajuda" style={{ display: 'block', color:
                  l.situacao_contato === 'optout' || l.situacao_contato === 'erro' ? 'var(--red)' : undefined }}>
                  {{
                    optout: 'pediu para sair',
                    respondido: 'respondeu',
                    sem_resposta: 'enviado — sem resposta',
                    bloqueado: 'bloqueado',
                    erro: 'erro no último envio',
                    nao_contatado: 'ainda não contatado',
                  }[l.situacao_contato]}
                </span>
                {resultadosDisparo[l.id] === 'enviado' && <span className="ajuda">enviado agora</span>}
                {resultadosDisparo[l.id] === 'bloqueado' && (
                  <span className="ajuda" style={{ color: 'var(--ink-2)' }}>bloqueado — opt-out</span>
                )}
                {resultadosDisparo[l.id] === 'erro' && (
                  <span className="ajuda" style={{ color: 'var(--red)' }}>erro no envio</span>
                )}
                {!resultadosDisparo[l.id] && l.disparo === 'sim' && <span className="ajuda">já disparado</span>}
                <button type="button" className="ver-detalhes" onClick={(e) => alternarDetalhes(l.id, e)}>
                  {expandidos.has(l.id) ? 'ocultar detalhes' : 'ver detalhes'}
                </button>
                {' · '}
                <button type="button" className="ver-detalhes" onClick={(e) => { e.stopPropagation(); abrirEdicaoLead(l); }}>
                  editar lead
                </button>
              </span>

              {expandidos.has(l.id) && (
                <div className="detalhes-lead" style={{ gridColumn: '1 / -1' }} onClick={(e) => e.stopPropagation()}>
                  {[
                    ['Empresa', l.empresa],
                    ['Endereço', l.endereco],
                    ['Categoria', l.especialidades],
                    ['Telefone', l.telefone_original],
                    ['CNPJ', l.cnpj],
                    ['Decisor', l.decisor_nome],
                  ].map(([rotulo, valor]) => valor ? (
                    <div key={rotulo}>
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{rotulo}</span>
                      <div style={{ fontSize: 13 }}>{valor}</div>
                    </div>
                  ) : null)}
                  {l.site && (
                    <div>
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>Site</span>
                      <div style={{ fontSize: 13 }}><a href={l.site} target="_blank" rel="noreferrer">{l.site}</a></div>
                    </div>
                  )}
                  {l.linkedin && (
                    <div>
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>LinkedIn</span>
                      <div style={{ fontSize: 13 }}><a href={l.linkedin} target="_blank" rel="noreferrer">{l.linkedin}</a></div>
                    </div>
                  )}
                  {l.email && (
                    <div>
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>E-mail</span>
                      <div style={{ fontSize: 13 }}>
                        {l.email}{l.email_status && l.email_status !== 'valid' ? ` (${l.email_status})` : ''}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {!leads.length && <p className="vazio">Nenhum lead nesta campanha.</p>}
      </ul>

      <Modal titulo="Editar lead" aberto={!!leadEditando} onFechar={() => setLeadEditando(null)}>
        {leadEditando && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Empresa
                <input value={formLead.empresa} onChange={(e) => setFormLead((f) => ({ ...f, empresa: e.target.value }))}
                  style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Telefone
                <input value={formLead.telefone} onChange={(e) => setFormLead((f) => ({ ...f, telefone: e.target.value }))}
                  style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Categoria/ramo
                <input value={formLead.especialidades} onChange={(e) => setFormLead((f) => ({ ...f, especialidades: e.target.value }))}
                  style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Endereço
                <input value={formLead.endereco} onChange={(e) => setFormLead((f) => ({ ...f, endereco: e.target.value }))}
                  style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
              </label>
            </div>
            {avisoLead && (
              <p className="ajuda" style={{ marginTop: 10, color: avisoLead.includes('supress') ? 'var(--ink-2)' : 'var(--red)' }}>
                {avisoLead}
              </p>
            )}
            <div className="modal-acoes">
              <button type="button" onClick={() => setLeadEditando(null)} disabled={salvandoLead}>Cancelar</button>
              <button type="button" onClick={salvarLead} disabled={salvandoLead}>
                {salvandoLead ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
