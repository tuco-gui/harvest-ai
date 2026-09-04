'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Funil = {
  id: number; nome: string; ativo: boolean; criado_em: string;
  pipeline: number; encerrados: number;
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
    <div className="pagina">
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Funis / Pipelines</h2>
      <p className="ajuda" style={{ marginBottom: 16 }}>
        Cada funil define os estágios do pipeline comercial. Ao criar uma campanha, você escolhe em qual funil e
        estágio os leads serão posicionados quando receberem o primeiro disparo.
      </p>

      <div className="barra-lista" style={{ marginBottom: 12 }}>
        <div className="acoes" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criarFunil()}
            placeholder="Nome do novo funil…"
            style={{ height: 36, padding: '0 10px', background: 'var(--sunken)', border: '1px solid var(--rule)', borderRadius: 2, fontSize: 14, flex: 1 }}
          />
          <button type="button" disabled={!novoNome.trim() || criando} onClick={criarFunil}>
            {criando ? 'Criando…' : 'Criar funil'}
          </button>
        </div>
      </div>

      <ul className="lista">
        {funisIniciais.map((f) => (
          <li key={f.id} className="linha" style={{ cursor: 'pointer' }}
            onClick={() => { window.location.href = `/funis/${f.id}`; }}>
            <span className="quem">
              <span className="nome">{f.nome}</span>
              <span className="onde">
                {f.pipeline} estágio(s) no pipeline · {f.encerrados} encerrado(s)
              </span>
            </span>
            <span className="nota">
              <span className="selo" data-zap-selo={f.ativo ? 'sim' : 'nao'}>
                {f.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <span className="ajuda">
                {new Date(f.criado_em).toLocaleDateString('pt-BR')}
              </span>
            </span>
          </li>
        ))}
        {!funisIniciais.length && <li className="vazio">Nenhum funil criado ainda.</li>}
      </ul>
    </div>
  );
}
