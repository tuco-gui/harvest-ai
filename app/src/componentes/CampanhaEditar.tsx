'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

type Canal = { id: number; nome: string; provider: string; status: string; ativo: boolean; padrao: boolean };
type LeadResumo = { id: number; empresa: string; telefone_original: string | null };

type Campanha = {
  id: number; nome: string; status?: string;
  modo_envio_numero?: string | null; canal_ids?: number[] | null;
  mensagem_modo?: string | null; mensagens?: string[] | null; contexto_ia?: string | null;
  cadencia_modo?: string; cadencia_min?: number | null; cadencia_max?: number | null;
};

const CADENCIAS: Record<string, [number, number] | null> = {
  padrao: null, rapida: [10, 25], moderada: [30, 60], conservadora: [60, 120], personalizada: null,
};

export default function CampanhaEditar({
  campanha, leadsIniciais, intervaloMin, intervaloMax, canais,
}: {
  campanha: Campanha; leadsIniciais: LeadResumo[]; intervaloMin: number; intervaloMax: number; canais: Canal[];
}) {
  const canaisConectados = canais.filter((c) => c.ativo && c.status === 'conectado');
  const [nome, setNome] = useState(campanha.nome);
  const [leads, setLeads] = useState(leadsIniciais);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<LeadResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modoEnvio, setModoEnvio] = useState<'fixo' | 'rodizio'>(
    (campanha.modo_envio_numero as 'fixo' | 'rodizio') ?? (canaisConectados.length > 1 ? 'rodizio' : 'fixo'),
  );
  const [canalIds, setCanalIds] = useState<Set<number>>(new Set(
    (campanha.canal_ids ?? []).filter((id) => canaisConectados.some((c) => c.id === id)),
  ));

  const [msgModo, setMsgModo] = useState(campanha.mensagem_modo ?? 'padrao');
  const [msgTextos, setMsgTextos] = useState<string[]>(campanha.mensagens?.length ? campanha.mensagens : ['', '']);
  const [msgContextoIa, setMsgContextoIa] = useState(campanha.contexto_ia ?? '');
  const [cadenciaModo, setCadenciaModo] = useState(campanha.cadencia_modo ?? 'padrao');
  const [cadenciaMin, setCadenciaMin] = useState(campanha.cadencia_min ?? 40);
  const [cadenciaMax, setCadenciaMax] = useState(campanha.cadencia_max ?? 90);

  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Busca de leads pra adicionar (Entrega 22): debounce de 300ms, mínimo de
  // 2 caracteres — evita bater na API a cada tecla.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (busca.trim().length < 2) { setResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/campanhas/${campanha.id}/leads?q=${encodeURIComponent(busca.trim())}`);
        const d = await r.json().catch(() => ({}));
        setResultados(r.ok ? (d.leads ?? []) : []);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [busca, campanha.id]);

  async function adicionarLead(l: LeadResumo) {
    const r = await fetch(`/api/campanhas/${campanha.id}/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: l.id }),
    });
    if (r.ok) {
      setLeads((atual) => [...atual, l]);
      setResultados((atual) => atual.filter((x) => x.id !== l.id));
    }
  }

  async function removerLead(l: LeadResumo) {
    if (!confirm(`Remover "${l.empresa}" desta campanha? O cadastro do lead continua existindo.`)) return;
    const r = await fetch(`/api/campanhas/${campanha.id}/leads`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: l.id }),
    });
    if (r.ok) setLeads((atual) => atual.filter((x) => x.id !== l.id));
  }

  function alternarCanal(id: number) {
    if (modoEnvio === 'fixo') {
      setCanalIds(new Set([id]));
      return;
    }
    setCanalIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function salvar() {
    if (!canalIds.size) {
      setAviso('Selecione ao menos um canal conectado.');
      return;
    }
    setSalvando(true);
    setAviso(null);
    try {
      const mensagensDaCampanha = msgModo === 'fixa'
        ? [msgTextos[0] ?? ''].filter((t) => t.trim())
        : msgModo === 'rodizio' ? msgTextos.filter((t) => t.trim()) : [];
      if (msgModo === 'fixa' && !mensagensDaCampanha.length) {
        setAviso('Digite a mensagem fixa antes de salvar.');
        return;
      }
      if (msgModo === 'rodizio' && mensagensDaCampanha.length < 2) {
        setAviso('O rodízio precisa de pelo menos duas mensagens.');
        return;
      }
      const body: Record<string, unknown> = {
        id: campanha.id,
        nome: nome.trim() || campanha.nome,
        modoEnvio,
        canalIds: Array.from(canalIds),
        mensagemModo: msgModo === 'padrao' ? null : msgModo,
        mensagens: mensagensDaCampanha,
        contextoIa: msgModo === 'ia' ? msgContextoIa : null,
        cadenciaModo,
        cadenciaMin: cadenciaModo === 'personalizada' ? Number(cadenciaMin) : null,
        cadenciaMax: cadenciaModo === 'personalizada' ? Number(cadenciaMax) : null,
      };
      const r = await fetch('/api/campanhas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAviso(d.erro ?? 'Não consegui salvar a campanha.'); return; }
      setAviso('Salvo. Os dados persistem no servidor — um reload mantém tudo.');
    } catch {
      setAviso('Sem conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="pagina pagina-larga">
      <p className="ajuda"><Link href={`/campanhas/${campanha.id}`}>← Voltar para a campanha</Link></p>
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, letterSpacing: '-.02em' }}>
        Editar campanha
      </h2>
      <p className="resumo-secao">
        Nome, leads, canal de envio, mensagem e cadência — tudo persiste no servidor ao salvar.
      </p>

      <section className="secao">
        <h3 style={{ fontSize: 14 }}>Nome</h3>
        <input value={nome} onChange={(e) => setNome(e.target.value)}
          style={{ height: 38, width: '100%', maxWidth: 480, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
      </section>

      <section className="secao" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14 }}>Leads ({leads.length})</h3>
        <div style={{ position: 'relative', maxWidth: 480, marginBottom: 10 }}>
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar lead por empresa ou telefone para adicionar…"
            style={{ height: 38, width: '100%', padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}
          />
          {buscando && <span className="ajuda" style={{ display: 'block', marginTop: 4 }}>Buscando…</span>}
          {resultados.length > 0 && (
            <ul className="lista" style={{ marginTop: 6, maxHeight: 200, overflow: 'auto' }}>
              {resultados.map((l) => (
                <li key={l.id} className="linha" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default' }}>
                  <span>{l.empresa} <span className="ajuda">{l.telefone_original}</span></span>
                  <button type="button" onClick={() => adicionarLead(l)}>Adicionar</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ul className="lista">
          {leads.map((l) => (
            <li key={l.id} className="linha" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default' }}>
              <span>{l.empresa} <span className="ajuda">{l.telefone_original ?? 'sem telefone'}</span></span>
              <button type="button" style={{ color: 'var(--red)' }} onClick={() => removerLead(l)}>Remover</button>
            </li>
          ))}
          {!leads.length && <p className="vazio">Nenhum lead nesta campanha ainda.</p>}
        </ul>
      </section>

      <section className="secao" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14 }}>Número de envio</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={modoEnvio} onChange={(e) => {
            const modo = e.target.value as 'fixo' | 'rodizio';
            setModoEnvio(modo);
            if (modo === 'fixo' && canalIds.size > 1) setCanalIds(new Set([Array.from(canalIds)[0]]));
          }}
            style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
            <option value="fixo">Canal fixo</option>
            <option value="rodizio">Rodízio entre canais</option>
          </select>
          {!canaisConectados.length && <span style={{ fontSize: 12, color: 'var(--red)' }}>Nenhum canal conectado em Configurações → WhatsApp</span>}
        </div>
        {canaisConectados.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {canaisConectados.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type={modoEnvio === 'fixo' ? 'radio' : 'checkbox'} name={modoEnvio === 'fixo' ? 'canal-fixo' : undefined}
                  checked={canalIds.has(c.id)} onChange={() => alternarCanal(c.id)} />
                {c.nome} ({c.provider})
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="secao" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14 }}>Estratégia de mensagem</h3>
        <select value={msgModo} onChange={(e) => setMsgModo(e.target.value)}
          style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
          <option value="padrao">Usar configuração padrão da conta</option>
          <option value="fixa">Mensagem fixa desta campanha</option>
          <option value="rodizio">Rodízio de mensagens (2 a 5, específicas desta campanha)</option>
          <option value="ia">A IA escreve (contexto específico desta campanha)</option>
        </select>
        {msgModo === 'fixa' && (
          <textarea value={msgTextos[0] ?? ''} rows={4} placeholder="Digite a mensagem exata que será enviada"
            onChange={(e) => setMsgTextos((arr) => [e.target.value, ...arr.slice(1)])}
            style={{ marginTop: 8, width: '100%', maxWidth: 480, padding: 8, background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
        )}
        {msgModo === 'rodizio' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 }}>
            {msgTextos.map((t, i) => (
              <textarea key={i} value={t} rows={2} placeholder={`Mensagem ${i + 1}`}
                onChange={(e) => setMsgTextos((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                style={{ padding: 8, background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              {msgTextos.length < 5 && <button type="button" onClick={() => setMsgTextos((arr) => [...arr, ''])}>+ mensagem</button>}
              {msgTextos.length > 2 && <button type="button" onClick={() => setMsgTextos((arr) => arr.slice(0, -1))}>- mensagem</button>}
            </div>
          </div>
        )}
        {msgModo === 'ia' && (
          <textarea value={msgContextoIa} rows={3} placeholder="Contexto específico desta campanha para a IA usar ao escrever (opcional)"
            onChange={(e) => setMsgContextoIa(e.target.value)}
            style={{ marginTop: 8, width: '100%', maxWidth: 480, padding: 8, background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }} />
        )}
      </section>

      <section className="secao" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14 }}>Cadência entre envios</h3>
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
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
        <button type="button" onClick={salvar} disabled={salvando} style={{ fontWeight: 600 }}>
          {salvando ? 'Salvando…' : 'Salvar campanha'}
        </button>
        {aviso && <span className="ajuda">{aviso}</span>}
      </div>
    </div>
  );
}
