'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Funil = {
  id: number; nome: string; ativo: boolean; criado_em: string;
  total_estagios: number;
};

export default function Funis({ funis: funisIniciais }: { funis: Funil[] }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  async function criarFunil() {
    if (!novoNome.trim() || criando) return;
    setCriando(true);
    try {
      const r = await fetch('/api/funis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setNovoNome('');
        router.refresh();
      } else {
        alert(d.erro ?? 'Não consegui criar o funil.');
      }
    } catch {
      alert('Sem conexão com o servidor.');
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="pagina pagina-larga">
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22 }}>Funis / Pipelines</h2>
      <p className="ajuda" style={{ marginBottom: 20 }}>
        Cada funil define os estágios do pipeline comercial. Ao criar uma campanha, você escolhe em qual funil e
        estágio os leads serão posicionados quando receberem o primeiro disparo.
      </p>

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
        padding: 14, border: '1px solid var(--rule)', borderRadius: 3, background: 'var(--sunken)',
      }}>
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && criarFunil()}
          placeholder="Nome do novo funil…"
          style={{ height: 38, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14, flex: 1 }}
        />
        <button type="button" disabled={!novoNome.trim() || criando} onClick={criarFunil}
          className="btn-primario" style={{ height: 38, padding: '0 18px', fontSize: 13 }}>
          {criando ? 'Criando…' : 'Criar funil'}
        </button>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {funisIniciais.map((f) => (
          <li key={f.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              padding: '14px 16px', borderBottom: '1px solid var(--rule)', cursor: 'pointer',
              borderLeft: '3px solid transparent', transition: 'background .12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            onClick={() => { window.location.href = `/funis/${f.id}`; }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{f.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {f.total_estagios} estágio(s)
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
              <span className="selo" data-zap-selo={f.ativo ? 'sim' : 'nao'}>
                {f.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {new Date(f.criado_em).toLocaleDateString('pt-BR')}
              </span>
              <span style={{ color: 'var(--ink-3)', fontSize: 14 }}>→</span>
            </div>
          </li>
        ))}
        {!funisIniciais.length && (
          <li style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            Nenhum funil criado ainda.
          </li>
        )}
      </ul>
    </div>
  );
}
