'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Conversa = {
  id: number;
  conta_id: string;
  assunto: string;
  categoria: string;
  status: 'aberta' | 'respondida' | 'fechada';
  criado_em: string;
  prazo_sla: string;
  respondido_em: string | null;
  contas?: { nome: string } | null;
};

const NOME_CATEGORIA: Record<string, string> = {
  duvida: 'Dúvida', tecnico: 'Técnico', financeiro: 'Financeiro', outro: 'Outro',
};
const NOME_STATUS: Record<string, string> = { aberta: 'Aberto', respondida: 'Respondido', fechada: 'Fechado' };

function slaVencido(c: Conversa) {
  return c.status === 'aberta' && new Date(c.prazo_sla).getTime() < Date.now();
}

export default function Chamados({
  conversas, mostrarConta, podeAbrir,
}: { conversas: Conversa[]; mostrarConta: boolean; podeAbrir: boolean }) {
  const router = useRouter();

  const [assunto, setAssunto] = useState('');
  const [categoria, setCategoria] = useState('duvida');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function abrirChamado(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null); setEnviando(true);
    const r = await fetch('/api/conversas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assunto, categoria, mensagem }),
    });
    const d = await r.json();
    setEnviando(false);
    if (!r.ok) { setAviso(d.erro); return; }
    setAssunto(''); setMensagem('');
    router.push(`/chamados/${d.id}`);
  }

  return (
    <div className="pagina">
      <section className="secao">
        <h2>Chamados</h2>
        <p className="resumo-secao">
          Prazo de resposta: 4 horas. Fica marcado em vermelho quando estoura.
        </p>

        <table className="tabela">
          <thead>
            <tr>
              {mostrarConta && <th>Conta</th>}
              <th>Assunto</th><th>Categoria</th><th>Status</th><th>Aberto em</th>
            </tr>
          </thead>
          <tbody>
            {conversas.map((c) => (
              <tr key={c.id}>
                {mostrarConta && <td>{c.contas?.nome ?? '—'}</td>}
                <td><Link href={`/chamados/${c.id}`}>{c.assunto}</Link></td>
                <td style={{ color: 'var(--ink-2)' }}>{NOME_CATEGORIA[c.categoria] ?? c.categoria}</td>
                <td>
                  <span className="selo" style={{
                    borderColor: slaVencido(c) ? 'var(--red)' : c.status === 'respondida' ? 'var(--green)' : 'var(--rule-2)',
                    color: slaVencido(c) ? 'var(--red)' : c.status === 'respondida' ? 'var(--green)' : 'var(--ink-2)',
                  }}>
                    {slaVencido(c) ? 'SLA vencido' : NOME_STATUS[c.status]}
                  </span>
                </td>
                <td style={{ color: 'var(--ink-3)' }}>{new Date(c.criado_em).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {!conversas.length && (
              <tr><td colSpan={mostrarConta ? 5 : 4} style={{ color: 'var(--ink-3)' }}>Nenhum chamado ainda.</td></tr>
            )}
          </tbody>
        </table>

        {podeAbrir && (
          <form className="cartaocfg" style={{ marginTop: 22 }} onSubmit={abrirChamado}>
            <div className="linha-form">
              <div className="grupo">
                <label className="label" htmlFor="assunto">Assunto</label>
                <input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)}
                       placeholder="Não consigo disparar mensagens" />
              </div>
              <div className="grupo" style={{ maxWidth: 190 }}>
                <label className="label" htmlFor="categoria">Categoria</label>
                <select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  <option value="duvida">Dúvida</option>
                  <option value="tecnico">Técnico</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
            <div className="grupo">
              <label className="label" htmlFor="mensagem">Mensagem</label>
              <textarea id="mensagem" rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Descreva o que está acontecendo." />
            </div>
            <button className="salvar" disabled={enviando || !assunto.trim() || !mensagem.trim()}>
              {enviando ? 'Abrindo…' : 'Abrir chamado'}
            </button>
          </form>
        )}

        {aviso && <p className="erro" style={{ marginTop: 16 }}>{aviso}</p>}
      </section>
    </div>
  );
}
