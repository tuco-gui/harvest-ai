'use client';

import { useState } from 'react';
import { ESTAGIOS_CRM, nomeEstagio } from '@/lib/crmStages';
import type { Oportunidade } from '@/lib/twenty';

type Owner = { id: string; nome: string };

export default function CrmPipeline({
  oportunidades,
  owners,
}: {
  oportunidades: Oportunidade[];
  owners: Owner[];
}) {
  const [ops, setOps] = useState<Oportunidade[]>(oportunidades);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [estagioAlvo, setEstagioAlvo] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Oportunidade | null>(null);
  const [salvando, setSalvando] = useState(false);

  function agrupar(estagio: string) {
    return ops.filter((o) => o.estagio === estagio);
  }

  async function moverPara(op: Oportunidade, estagio: string) {
    if (op.estagio === estagio) return;
    const ot = setOps((atual) => atual.map((x) => (x.id === op.id ? { ...x, estagio } : x)));
    try {
      const r = await fetch(`/api/crm/oportunidades/${op.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estagio }),
      });
      if (!r.ok) throw new Error('falhou');
    } catch {
      // Reverte se o servidor recusar (ex.: RLS / tenant).
      setOps((atual) => atual.map((x) => (x.id === op.id ? op : x)));
    }
  }

  async function salvarFicha(e: React.FormEvent) {
    e.preventDefault();
    if (!ficha) return;
    setSalvando(true);
    const r = await fetch(`/api/crm/oportunidades/${ficha.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa: ficha.empresa,
        contato: ficha.contato,
        telefone: ficha.telefone,
        email: ficha.email,
        owner_id: ficha.owner_id,
        valor: ficha.valor,
        proxima_acao: ficha.proxima_acao,
        observacoes: ficha.observacoes,
        previsao_fechamento: ficha.previsao_fechamento,
      }),
    });
    setSalvando(false);
    if (r.ok) {
      const d = await r.json();
      setOps((atual) => atual.map((x) => (x.id === ficha.id ? d.oportunidade : x)));
      setFicha(d.oportunidade);
    }
  }

  const nomeOwner = (id: string | null) => owners.find((o) => o.id === id)?.nome ?? '—';
  const valorFmt = (v: number) =>
    (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="crm-kanban">
      {ESTAGIOS_CRM.map((est) => (
        <section
          key={est.id}
          className={'coluna' + (estagioAlvo === est.id ? ' coluna-alvo' : '')}
          onDragOver={(e) => {
            e.preventDefault();
            setEstagioAlvo(est.id);
          }}
          onDragLeave={() => setEstagioAlvo((s) => (s === est.id ? null : s))}
          onDrop={() => {
            if (arrastando != null) {
              const op = ops.find((o) => o.id === arrastando);
              if (op) moverPara(op, est.id);
            }
            setArrastando(null);
            setEstagioAlvo(null);
          }}
        >
          <header className="coluna-cabecalho">
            <span>{est.nome}</span>
            <span className="coluna-contagem">{agrupar(est.id).length}</span>
          </header>
          <ul className="coluna-cards" role="list">
            {agrupar(est.id).map((op) => (
              <li
                key={op.id}
                className="cartao"
                draggable
                onDragStart={() => setArrastando(op.id)}
                onDragEnd={() => {
                  setArrastando(null);
                  setEstagioAlvo(null);
                }}
                onClick={() => setFicha(op)}
              >
                <strong className="cartao-empresa">{op.empresa || '—'}</strong>
                {op.contato && <span className="cartao-contato">{op.contato}</span>}
                <span className="cartao-valor">{valorFmt(op.valor)}</span>
                <span className="cartao-owner">{nomeOwner(op.owner_id)}</span>
                {op.proxima_acao && (
                  <span className="cartao-acao" title={op.proxima_acao}>
                    {op.proxima_acao}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {ficha && (
        <div className="crm-overlay" onClick={() => setFicha(null)}>
          <div className="crm-drawer" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-cabecalho">
              <h2>Ficha da oportunidade</h2>
              <button type="button" className="ver-detalhes" onClick={() => setFicha(null)}>
                Fechar
              </button>
            </header>
            <form onSubmit={salvarFicha} className="drawer-form">
              <label>
                Empresa
                <input value={ficha.empresa} onChange={(e) => setFicha({ ...ficha, empresa: e.target.value })} />
              </label>
              <label>
                Contato
                <input value={ficha.contato} onChange={(e) => setFicha({ ...ficha, contato: e.target.value })} />
              </label>
              <label>
                Telefone
                <input value={ficha.telefone ?? ''} onChange={(e) => setFicha({ ...ficha, telefone: e.target.value })} />
              </label>
              <label>
                E-mail
                <input value={ficha.email ?? ''} onChange={(e) => setFicha({ ...ficha, email: e.target.value })} />
              </label>
              <label>
                Estágio
                <select value={ficha.estagio} disabled>
                  <option>{nomeEstagio(ficha.estagio)}</option>
                </select>
              </label>
              <label>
                Owner
                <select
                  value={ficha.owner_id ?? ''}
                  onChange={(e) => setFicha({ ...ficha, owner_id: e.target.value || null })}
                >
                  <option value="">—</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Valor (R$)
                <input
                  type="number"
                  value={ficha.valor}
                  onChange={(e) => setFicha({ ...ficha, valor: Number(e.target.value) })}
                />
              </label>
              <label>
                Previsão de fechamento
                <input
                  type="date"
                  value={ficha.previsao_fechamento ?? ''}
                  onChange={(e) => setFicha({ ...ficha, previsao_fechamento: e.target.value || null })}
                />
              </label>
              <label>
                Próxima ação
                <textarea
                  value={ficha.proxima_acao ?? ''}
                  onChange={(e) => setFicha({ ...ficha, proxima_acao: e.target.value })}
                />
              </label>
              <label>
                Observações
                <textarea
                  value={ficha.observacoes ?? ''}
                  onChange={(e) => setFicha({ ...ficha, observacoes: e.target.value })}
                />
              </label>
              <div className="drawer-rodape">
                <button type="submit" className="btn-primario" disabled={salvando}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
