'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Funil = { id: number; nome: string; ativo: boolean; criado_em: string };
type Estagio = {
  id: number; funil_id: number; nome: string; ordem: number;
  grupo: 'pipeline' | 'encerrado'; probabilidade: number; cor: string | null;
};

const CORES_PADRAO = [
  '#8b8b8b', '#d48a1c', '#3478c7', '#7655b8', '#b94b8a',
  '#d55c2a', '#1A7A4A', '#C4191F', '#555555', '#2196F3',
];

export default function FunilDetalhe({ funil, estagios: estagiosIniciais }: { funil: Funil; estagios: Estagio[] }) {
  const router = useRouter();
  const [estagios, setEstagios] = useState(estagiosIniciais);
  const [novoNome, setNovoNome] = useState('');
  const [novoGrupo, setNovoGrupo] = useState<'pipeline' | 'encerrado'>('pipeline');
  const [novoCor, setNovoCor] = useState('#8b8b8b');
  const [editando, setEditando] = useState<number | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', probabilidade: 0, cor: '#8b8b8b' });
  const [salvando, setSalvando] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [nomeFunil, setNomeFunil] = useState(funil.nome);

  const pipeline = estagios.filter((e) => e.grupo === 'pipeline').sort((a, b) => a.ordem - b.ordem);
  const encerrados = estagios.filter((e) => e.grupo === 'encerrado').sort((a, b) => a.ordem - b.ordem);

  async function salvarNomeFunil() {
    if (!nomeFunil.trim() || nomeFunil === funil.nome || salvando) { setRenomeando(false); return; }
    setSalvando(true);
    try {
      const r = await fetch(`/api/funis/${funil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeFunil.trim() }),
      });
      if (r.ok) { setRenomeando(false); router.refresh(); }
      else { alert('Não consegui renomear.'); setNomeFunil(funil.nome); }
    } catch { alert('Sem conexão.'); setNomeFunil(funil.nome); }
    finally { setSalvando(false); }
  }

  async function adicionarEstagio() {
    if (!novoNome.trim() || salvando) return;
    setSalvando(true);
    try {
      const r = await fetch(`/api/funis/${funil.id}/estagios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoNome.trim(),
          grupo: novoGrupo,
          probabilidade: novoGrupo === 'encerrado' ? 0 : undefined,
          cor: novoCor,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.estagio) {
        setEstagios((atual) => [...atual, d.estagio].sort((a, b) => a.ordem - b.ordem));
        setNovoNome('');
        setNovoCor('#8b8b8b');
      } else {
        alert(d.erro ?? 'Não consegui adicionar o estágio.');
      }
    } catch {
      alert('Sem conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao(estagioId: number) {
    if (salvando) return;
    setSalvando(true);
    try {
      const r = await fetch(`/api/funis/${funil.id}/estagios/${estagioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEdit),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setEstagios((atual) => atual.map((e) =>
          e.id === estagioId ? { ...e, nome: formEdit.nome, probabilidade: formEdit.probabilidade, cor: formEdit.cor } : e,
        ));
        setEditando(null);
      } else {
        alert(d.erro ?? 'Não consegui salvar.');
      }
    } catch {
      alert('Sem conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  }

  async function removerEstagio(estagioId: number) {
    if (!confirm('Remover este estágio? Oportunidades neste estágio voltarão para o primeiro estágio do pipeline.') || salvando) return;
    setSalvando(true);
    try {
      const r = await fetch(`/api/funis/${funil.id}/estagios/${estagioId}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setEstagios((atual) => atual.filter((e) => e.id !== estagioId));
      } else {
        alert(d.erro ?? 'Não consegui remover.');
      }
    } catch {
      alert('Sem conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  }

  async function moverEstagio(estagioId: number, direcao: -1 | 1) {
    const idx = estagios.findIndex((e) => e.id === estagioId);
    if (idx < 0) return;
    const vizinhoIdx = idx + direcao;
    if (vizinhoIdx < 0 || vizinhoIdx >= estagios.length) return;
    if (estagios[idx].grupo !== estagios[vizinhoIdx].grupo) return;

    const novaOrdem = estagios[vizinhoIdx].ordem;
    const novaLista = [...estagios];
    novaLista[idx] = { ...novaLista[idx], ordem: novaOrdem };
    novaLista[vizinhoIdx] = { ...novaLista[vizinhoIdx], ordem: estagios[idx].ordem };
    setEstagios(novaLista);

    await fetch(`/api/funis/${funil.id}/estagios/${estagioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordem: novaOrdem }),
    });
  }

  function renderEstagio(e: Estagio, idx: number, total: number) {
    const emEdicao = editando === e.id;
    const cor = e.cor || '#8b8b8b';
    return (
      <li key={e.id} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderBottom: '1px solid var(--rule)', background: emEdicao ? 'var(--sel)' : 'transparent',
        borderRadius: 3, transition: 'background .12s',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 40, color: 'var(--ink-3)', fontSize: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: cor, flex: 'none' }} />
          {e.ordem}
        </span>

        {emEdicao ? (
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input value={formEdit.nome} onChange={(ev) => setFormEdit((f) => ({ ...f, nome: ev.target.value }))}
              onKeyDown={(ev) => ev.key === 'Enter' && salvarEdicao(e.id)}
              style={{ height: 32, padding: '0 8px', fontSize: 13, border: '1px solid var(--accent)', borderRadius: 2, flex: '1 1 160px' }}
              autoFocus placeholder="Nome do estágio"
            />
            <input type="number" min={0} max={100} value={formEdit.probabilidade}
              onChange={(ev) => setFormEdit((f) => ({ ...f, probabilidade: Number(ev.target.value) }))}
              style={{ height: 32, width: 70, padding: '0 6px', fontSize: 13, border: '1px solid var(--rule)', borderRadius: 2 }}
              placeholder="%"
            />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {CORES_PADRAO.map((c) => (
                <button key={c} type="button" onClick={() => setFormEdit((f) => ({ ...f, cor: c }))}
                  style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: formEdit.cor === c ? '2px solid var(--ink)' : '2px solid var(--rule)', cursor: 'pointer', padding: 0 }}
                  aria-label={`Cor ${c}`}
                />
              ))}
              <input type="color" value={formEdit.cor}
                onChange={(ev) => setFormEdit((f) => ({ ...f, cor: ev.target.value }))}
                style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
                title="Cor personalizada"
              />
            </div>
            <span className="selo" data-zap-selo={e.grupo === 'pipeline' ? 'sim' : 'nao'}>
              {e.grupo === 'pipeline' ? 'Pipeline' : 'Encerrado'}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="btn-primario" onClick={() => salvarEdicao(e.id)} disabled={salvando}
                style={{ height: 30, padding: '0 12px', fontSize: 12 }}>
                {salvando ? '…' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setEditando(null)}
                style={{ height: 30, padding: '0 10px', fontSize: 12, color: 'var(--ink-3)', border: '1px solid var(--rule)', borderRadius: 2 }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              onClick={() => { setEditando(e.id); setFormEdit({ nome: e.nome, probabilidade: e.probabilidade, cor }); }}>
              {e.nome}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 40, textAlign: 'right' }}>{e.probabilidade}%</span>
            <span className="selo" data-zap-selo={e.grupo === 'pipeline' ? 'sim' : 'nao'}>
              {e.grupo === 'pipeline' ? 'Pipeline' : 'Encerrado'}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button type="button" onClick={() => moverEstagio(e.id, -1)} disabled={idx === 0 || estagios[idx - 1]?.grupo !== e.grupo}
                style={{ width: 26, height: 26, borderRadius: 2, fontSize: 13, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}
                aria-label="Mover para cima">↑</button>
              <button type="button" onClick={() => moverEstagio(e.id, 1)} disabled={idx >= total - 1 || estagios[idx + 1]?.grupo !== e.grupo}
                style={{ width: 26, height: 26, borderRadius: 2, fontSize: 13, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}
                aria-label="Mover para baixo">↓</button>
              <button type="button" onClick={() => removerEstagio(e.id)}
                style={{ width: 26, height: 26, borderRadius: 2, fontSize: 13, display: 'grid', placeItems: 'center', color: 'var(--red)' }}
                aria-label="Remover">✕</button>
            </div>
          </>
        )}
      </li>
    );
  }

  return (
    <div className="pagina pagina-larga">
      <p className="ajuda"><Link href="/funis">← Funis</Link></p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        {renomeando ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={nomeFunil} onChange={(e) => setNomeFunil(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && salvarNomeFunil()}
              style={{ height: 36, padding: '0 10px', fontSize: 18, fontFamily: 'var(--display)', fontWeight: 800, border: '1px solid var(--accent)', borderRadius: 2 }}
              autoFocus
            />
            <button className="btn-primario" onClick={salvarNomeFunil} disabled={salvando} style={{ height: 36, padding: '0 14px', fontSize: 13 }}>
              Salvar
            </button>
            <button onClick={() => { setRenomeando(false); setNomeFunil(funil.nome); }}
              style={{ height: 36, padding: '0 10px', fontSize: 13, color: 'var(--ink-3)', border: '1px solid var(--rule)', borderRadius: 2 }}>
              Cancelar
            </button>
          </div>
        ) : (
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22, margin: 0, cursor: 'pointer' }}
            onClick={() => setRenomeando(true)} title="Clique para renomear">
            {funil.nome} <span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 400 }}>✎</span>
          </h2>
        )}
      </div>

      <p className="resumo-secao" style={{ marginBottom: 20 }}>
        {funil.ativo ? 'Ativo' : 'Inativo'} · {pipeline.length} estágio(s) no pipeline · {encerrados.length} encerrado(s)
      </p>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--ink-2)' }}>Pipeline</h3>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--rule)', borderRadius: 3, background: 'var(--surface)' }}>
          {pipeline.map((e, i) => renderEstagio(e, i, estagios.length))}
          {!pipeline.length && <li style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Nenhum estágio no pipeline.</li>}
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--ink-2)' }}>Encerrados</h3>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--rule)', borderRadius: 3, background: 'var(--surface)' }}>
          {encerrados.map((e, i) => renderEstagio(e, i, estagios.length))}
          {!encerrados.length && <li style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Nenhum estágio de encerramento.</li>}
        </ul>
      </section>

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        padding: 14, border: '1px solid var(--rule)', borderRadius: 3, background: 'var(--sunken)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: novoCor, flex: 'none' }} />
        <input type="color" value={novoCor} onChange={(e) => setNovoCor(e.target.value)}
          style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
        />
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionarEstagio()}
          placeholder="Nome do novo estágio…"
          style={{ height: 36, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14, flex: 1, minWidth: 160 }}
        />
        <select value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value as 'pipeline' | 'encerrado')}
          style={{ height: 36, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
          <option value="pipeline">Pipeline</option>
          <option value="encerrado">Encerrado</option>
        </select>
        <button type="button" disabled={!novoNome.trim() || salvando} onClick={adicionarEstagio}
          className="btn-primario" style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
          {salvando ? '…' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}
