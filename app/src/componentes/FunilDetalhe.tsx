'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Funil = { id: number; nome: string; ativo: boolean; criado_em: string };
type Estagio = {
  id: number; funil_id: number; nome: string; ordem: number;
  grupo: 'pipeline' | 'encerrado'; probabilidade: number;
};

export default function FunilDetalhe({ funil, estagios: estagiosIniciais }: { funil: Funil; estagios: Estagio[] }) {
  const router = useRouter();
  const [estagios, setEstagios] = useState(estagiosIniciais);
  const [novoNome, setNovoNome] = useState('');
  const [novoGrupo, setNovoGrupo] = useState<'pipeline' | 'encerrado'>('pipeline');
  const [editando, setEditando] = useState<number | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', probabilidade: 0 });
  const [salvando, setSalvando] = useState(false);

  const pipeline = estagios.filter((e) => e.grupo === 'pipeline').sort((a, b) => a.ordem - b.ordem);
  const encerrados = estagios.filter((e) => e.grupo === 'encerrado').sort((a, b) => a.ordem - b.ordem);

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
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.estagio) {
        setEstagios((atual) => [...atual, d.estagio].sort((a, b) => a.ordem - b.ordem));
        setNovoNome('');
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
          e.id === estagioId ? { ...e, nome: formEdit.nome, probabilidade: formEdit.probabilidade } : e,
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
    if (!confirm('Remover este estágio?') || salvando) return;
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

    // Trocar ordem localmente
    const novaOrdem = estagios[vizinhoIdx].ordem;
    const novaLista = [...estagios];
    novaLista[idx] = { ...novaLista[idx], ordem: novaOrdem };
    novaLista[vizinhoIdx] = { ...novaLista[vizinhoIdx], ordem: estagios[idx].ordem };
    setEstagios(novaLista);

    // Salvar no servidor
    await fetch(`/api/funis/${funil.id}/estagios/${estagioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordem: novaOrdem }),
    });
  }

  function renderEstagio(e: Estagio) {
    const emEdicao = editando === e.id;
    return (
      <li key={e.id} className="linha" style={{
        gridTemplateColumns: '36px 1fr 100px 80px 120px',
        cursor: emEdicao ? 'default' : 'pointer',
      }}>
        <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>{e.ordem}</span>
        <span className="quem" onClick={() => {
          if (!emEdicao) { setEditando(e.id); setFormEdit({ nome: e.nome, probabilidade: e.probabilidade }); }
        }}>
          {emEdicao ? (
            <input value={formEdit.nome} onChange={(ev) => setFormEdit((f) => ({ ...f, nome: ev.target.value }))}
              onKeyDown={(ev) => ev.key === 'Enter' && salvarEdicao(e.id)}
              style={{ height: 28, padding: '0 8px', fontSize: 13, border: '1px solid var(--accent)', borderRadius: 2 }}
              autoFocus
            />
          ) : (
            <span className="nome">{e.nome}</span>
          )}
        </span>
        <span>
          {emEdicao ? (
            <input type="number" min={0} max={100} value={formEdit.probabilidade}
              onChange={(ev) => setFormEdit((f) => ({ ...f, probabilidade: Number(ev.target.value) }))}
              style={{ height: 28, width: 60, padding: '0 6px', fontSize: 13, border: '1px solid var(--rule)', borderRadius: 2 }}
            />
          ) : (
            <span className="ajuda">{e.probabilidade}%</span>
          )}
        </span>
        <span>
          <span className="selo" data-zap-selo={e.grupo === 'pipeline' ? 'sim' : 'nao'}>
            {e.grupo === 'pipeline' ? 'Pipeline' : 'Encerrado'}
          </span>
        </span>
        <span style={{ display: 'flex', gap: 4 }}>
          {emEdicao ? (
            <>
              <button type="button" className="ver-detalhes" onClick={() => salvarEdicao(e.id)} disabled={salvando}>
                {salvando ? '…' : 'Salvar'}
              </button>
              <button type="button" className="ver-detalhes" onClick={() => setEditando(null)}>Cancelar</button>
            </>
          ) : (
            <>
              <button type="button" className="ver-detalhes" onClick={() => moverEstagio(e.id, -1)} disabled={e.ordem <= 1}>↑</button>
              <button type="button" className="ver-detalhes" onClick={() => moverEstagio(e.id, 1)}>↓</button>
              <button type="button" className="ver-detalhes" style={{ color: 'var(--red)' }}
                onClick={() => removerEstagio(e.id)}>Remover</button>
            </>
          )}
        </span>
      </li>
    );
  }

  return (
    <div className="pagina pagina-larga">
      <p className="ajuda"><Link href="/funis">← Funis</Link></p>
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>{funil.nome}</h2>
      <p className="resumo-secao">
        {funil.ativo ? 'Ativo' : 'Inativo'} · {pipeline.length} estágio(s) no pipeline · {encerrados.length} encerrado(s)
      </p>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Pipeline</h3>
        <ul className="lista">
          {pipeline.map(renderEstagio)}
          {!pipeline.length && <li className="vazio">Nenhum estágio no pipeline.</li>}
        </ul>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Encerrados</h3>
        <ul className="lista">
          {encerrados.map(renderEstagio)}
          {!encerrados.length && <li className="vazio">Nenhum estágio de encerramento.</li>}
        </ul>
      </section>

      <div className="barra-lista" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionarEstagio()}
          placeholder="Novo estágio…"
          style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14, flex: 1, minWidth: 160 }}
        />
        <select value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value as 'pipeline' | 'encerrado')}
          style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14 }}>
          <option value="pipeline">Pipeline</option>
          <option value="encerrado">Encerrado</option>
        </select>
        <button type="button" disabled={!novoNome.trim() || salvando} onClick={adicionarEstagio}>
          {salvando ? 'Adicionando…' : 'Adicionar estágio'}
        </button>
      </div>
    </div>
  );
}
