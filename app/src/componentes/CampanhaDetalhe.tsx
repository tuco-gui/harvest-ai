'use client';

import Link from 'next/link';
import { useState } from 'react';

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
};

type Canal = { id: number; nome: string; provider: string; ativo: boolean; padrao: boolean };

type Campanha = {
  id: number; nome: string; origem: string; encontradas: number; com_whatsapp: number;
  tipo?: string; status?: string;
  mensagem_modo?: string | null; mensagens?: string[] | null; contexto_ia?: string | null;
  cadencia_modo?: string; cadencia_min?: number | null; cadencia_max?: number | null;
  agendado_para?: string | null; agendado_timezone?: string | null;
};

type Metricas = {
  enviadas: number; leadsContatados: number; erros: number;
  bloqueados: number; respondidos: number; optouts: number;
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
  const [leads, setLeads] = useState(leadsIniciais);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [enriquecendo, setEnriquecendo] = useState<Set<number>>(new Set());
  const [disparando, setDisparando] = useState(false);
  const [pararRef] = useState({ atual: false });
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);

  // Número de envio (Fase 3B.1): fixo num canal escolhido, ou rodízio entre os ativos.
  const [modoEnvio, setModoEnvio] = useState<'fixo' | 'rodizio'>(
    canais.length > 1 ? 'rodizio' : 'fixo',
  );
  const padrao = canais.find((c) => c.padrao && c.ativo) ?? canais.find((c) => c.ativo);
  const [canalFixoId, setCanalFixoId] = useState<number | null>(padrao?.id ?? null);

  // ---- Configuração de campanha (Entrega 12): mensagem / cadência / agendamento ----
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [msgModo, setMsgModo] = useState(campanha.mensagem_modo ?? 'padrao');
  const [msgTextos, setMsgTextos] = useState<string[]>(
    campanha.mensagens?.length ? campanha.mensagens : ['', ''],
  );
  const [msgContextoIa, setMsgContextoIa] = useState(campanha.contexto_ia ?? '');
  const [cadenciaModo, setCadenciaModo] = useState(campanha.cadencia_modo ?? 'padrao');
  const [cadenciaMin, setCadenciaMin] = useState(campanha.cadencia_min ?? 40);
  const [cadenciaMax, setCadenciaMax] = useState(campanha.cadencia_max ?? 90);
  const [agendamentoModo, setAgendamentoModo] = useState<'agora' | 'agendar'>(
    campanha.agendado_para ? 'agendar' : 'agora',
  );
  const [agendadoPara, setAgendadoPara] = useState(campanha.agendado_para?.slice(0, 16) ?? '');
  const [configAviso, setConfigAviso] = useState<string | null>(null);
  const [statusAtual, setStatusAtual] = useState(campanha.status ?? 'em_execucao');

  async function salvarConfigCampanha() {
    setSalvandoConfig(true);
    setConfigAviso(null);
    try {
      const body: Record<string, unknown> = {
        id: campanha.id,
        mensagemModo: msgModo === 'padrao' ? null : msgModo,
        mensagens: msgModo === 'rodizio' ? msgTextos.filter((t) => t.trim()) : [],
        contextoIa: msgModo === 'ia' ? msgContextoIa : null,
        cadenciaModo,
        cadenciaMin: cadenciaModo === 'personalizada' ? Number(cadenciaMin) : null,
        cadenciaMax: cadenciaModo === 'personalizada' ? Number(cadenciaMax) : null,
      };
      if (agendamentoModo === 'agendar' && agendadoPara) {
        body.agendadoPara = new Date(agendadoPara).toISOString();
        body.status = 'agendada';
        setStatusAtual('agendada');
      } else {
        body.agendadoPara = null;
        body.status = 'em_execucao';
        setStatusAtual('em_execucao');
      }
      const r = await fetch('/api/campanhas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setConfigAviso(d.erro ?? 'Não consegui salvar a configuração.'); return; }
      setConfigAviso('Configuração salva.');
    } catch {
      setConfigAviso('Sem conexão com o servidor.');
    } finally {
      setSalvandoConfig(false);
    }
  }

  const comZap = leads.filter((l) => l.tem_whatsapp === 'sim').length;

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
    if (cadenciaModo === 'personalizada') return [Number(cadenciaMin) || 1, Number(cadenciaMax) || (Number(cadenciaMin) || 1) + 1];
    const faixa = CADENCIAS[cadenciaModo];
    if (faixa) return faixa;
    return [intervaloMin, intervaloMax];
  }

  async function dispararSelecionados() {
    const alvos = leads.filter((l) => escolhidos.has(l.id) && l.telefone);
    if (!alvos.length) return;
    if (!confirm(`Disparar mensagem pra ${alvos.length} lead(s) agora?`)) return;
    pararRef.atual = false;
    setDisparando(true);
    setProgresso({ feito: 0, total: alvos.length });
    const [min, max] = cadenciaEfetiva();
    for (let i = 0; i < alvos.length; i++) {
      if (pararRef.atual) break;
      const l = alvos[i];
      const canalId = modoEnvio === 'fixo' ? canalFixoId : null;
      // eslint-disable-next-line no-await-in-loop
      await fetch('/api/disparo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: l, indice: i, campanhaId: campanha.id,
          canalId, modoEnvio,
        }),
      }).catch(() => null);
      setLeads((atual) => atual.map((x) => (x.id === l.id ? { ...x, disparo: 'sim' } : x)));
      setProgresso({ feito: i + 1, total: alvos.length });
      if (i < alvos.length - 1 && !pararRef.atual) {
        const espera = min + Math.random() * (max - min);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, espera * 1000));
      }
    }
    setDisparando(false);
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
          <div className="etapa">
            <span className="num">{metricas.optouts}</span>
            <span className="label">Opt-outs</span>
          </div>
          <div className="etapa">
            <span className="num">{metricas.erros + metricas.bloqueados}</span>
            <span className="label">Erros/bloqueados</span>
          </div>
        </section>
      )}

      <details className="barra-lista" style={{ padding: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)' }}>
          Configuração da campanha (mensagem, cadência, agendamento)
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Estratégia de mensagem</span>
            <select value={msgModo} onChange={(e) => setMsgModo(e.target.value)}
                    style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
              <option value="padrao">Usar configuração padrão da conta</option>
              <option value="fixa">Mensagem fixa (usa a config. da conta)</option>
              <option value="rodizio">Rodízio de mensagens (2 a 5, específicas desta campanha)</option>
              <option value="ia">A IA escreve (contexto específico desta campanha)</option>
            </select>
            {msgModo === 'rodizio' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {msgTextos.map((t, i) => (
                  <textarea key={i} value={t} rows={2} placeholder={`Mensagem ${i + 1}`}
                    onChange={(e) => setMsgTextos((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                    style={{ padding: 8, background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  {msgTextos.length < 5 && (
                    <button type="button" onClick={() => setMsgTextos((arr) => [...arr, ''])}>+ mensagem</button>
                  )}
                  {msgTextos.length > 2 && (
                    <button type="button" onClick={() => setMsgTextos((arr) => arr.slice(0, -1))}>- mensagem</button>
                  )}
                </div>
              </div>
            )}
            {msgModo === 'ia' && (
              <textarea value={msgContextoIa} rows={3} placeholder="Contexto específico desta campanha para a IA usar ao escrever (opcional — se vazio, usa o contexto padrão da conta)"
                onChange={(e) => setMsgContextoIa(e.target.value)}
                style={{ marginTop: 8, width: '100%', padding: 8, background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
            )}
          </div>

          <div>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Cadência entre envios</span>
            <select value={cadenciaModo} onChange={(e) => setCadenciaModo(e.target.value)}
                    style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
              <option value="padrao">Padrão da conta ({intervaloMin}–{intervaloMax}s)</option>
              <option value="rapida">Rápida (10–25s)</option>
              <option value="moderada">Moderada (30–60s)</option>
              <option value="conservadora">Conservadora (60–120s)</option>
              <option value="personalizada">Personalizada</option>
            </select>
            {cadenciaModo === 'personalizada' && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" min={1} value={cadenciaMin} onChange={(e) => setCadenciaMin(Number(e.target.value))}
                  style={{ width: 80, height: 32, padding: '0 8px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>a</span>
                <input type="number" min={1} value={cadenciaMax} onChange={(e) => setCadenciaMax(Number(e.target.value))}
                  style={{ width: 80, height: 32, padding: '0 8px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>segundos</span>
              </div>
            )}
          </div>

          <div>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Agendamento</span>
            <select value={agendamentoModo} onChange={(e) => setAgendamentoModo(e.target.value as 'agora' | 'agendar')}
                    style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
              <option value="agora">Disparar quando eu clicar (agora)</option>
              <option value="agendar">Agendar para depois</option>
            </select>
            {agendamentoModo === 'agendar' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input type="datetime-local" value={agendadoPara} onChange={(e) => setAgendadoPara(e.target.value)}
                  style={{ height: 32, padding: '0 8px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2 }} />
                <span className="ajuda">
                  Fuso horário: {campanha.agendado_timezone ?? 'America/Sao_Paulo'}. O agendamento aqui salva a
                  data/status da campanha; o disparo automático nesse horário depende de um executor server-side
                  ainda não implementado nesta entrega (ver RELATORIO_ENTREGAS.md, Entrega 12) — hoje, "agendar"
                  marca a campanha como <b>agendada</b> para controle manual, mas o disparo em si continua sendo
                  feito clicando em "Disparar selecionados" quando chegar a hora.
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={salvarConfigCampanha} disabled={salvandoConfig}>
              {salvandoConfig ? 'Salvando…' : 'Salvar configuração'}
            </button>
            {configAviso && <span className="ajuda">{configAviso}</span>}
          </div>
        </div>
      </details>

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
              {canais.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.ativo}>
                  {c.nome} ({c.provider}){c.ativo ? '' : ' — inativo'}
                </option>
              ))}
            </select>
          )}
          {modoEnvio === 'rodizio' && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {canais.filter((c) => c.ativo).length} canal(is) ativo(s) — alterna por lead
            </span>
          )}
          {!canais.length && (
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
            <button type="button" disabled={!escolhidos.size} onClick={dispararSelecionados}>
              Disparar selecionados
            </button>
          )}
        </div>
      </div>

      {progresso && (
        <p className="ajuda">
          Disparando {progresso.feito} de {progresso.total}
          {intervaloMin ? ` — intervalo de ${intervaloMin}–${intervaloMax}s entre envios` : ''}.
        </p>
      )}

      <ul className="lista" role="listbox" aria-multiselectable>
        {leads.map((l) => {
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
                {l.disparo === 'sim' && <span className="ajuda">já disparado</span>}
                <button type="button" className="ver-detalhes" onClick={(e) => alternarDetalhes(l.id, e)}>
                  {expandidos.has(l.id) ? 'ocultar detalhes' : 'ver detalhes'}
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
    </div>
  );
}
