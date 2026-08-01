'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Conta = { id: string; nome: string; slug: string; ativo: boolean; criado_em: string };

export default function Contas({
  contas, contaAtiva, nUsuariosPorConta,
}: { contas: Conta[]; contaAtiva: string | null; nUsuariosPorConta: Record<string, number> }) {
  const router = useRouter();

  const [nomeConta, setNomeConta] = useState('');
  const [criandoConta, setCriandoConta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null); setCriandoConta(true);
    const r = await fetch('/api/contas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nomeConta }),
    });
    const d = await r.json();
    setCriandoConta(false);
    if (!r.ok) { setAviso(d.erro); return; }
    setNomeConta('');
    router.refresh();
  }

  async function editarConta(c: Conta) {
    const novo = prompt('Novo nome da empresa:', c.nome);
    if (!novo || !novo.trim() || novo.trim() === c.nome) return;
    setAviso(null);
    const r = await fetch('/api/contas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, nome: novo.trim() }),
    });
    const d = await r.json();
    if (!r.ok) { setAviso(d.erro); return; }
    router.refresh();
  }

  async function excluirConta(c: Conta) {
    const nUsuarios = nUsuariosPorConta[c.id] ?? 0;
    if (!confirm(
      `Excluir ${c.nome}? Isso apaga ${nUsuarios} usuário(s), leads, mensagens e configurações dessa conta. Não tem como desfazer.`,
    )) return;
    setAviso(null);
    const r = await fetch('/api/contas', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    });
    const d = await r.json();
    if (!r.ok) { setAviso(d.erro); return; }
    router.refresh();
  }

  async function trabalharEm(id: string) {
    await fetch('/api/conta-ativa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: id }),
    });
    router.refresh();
  }

  return (
    <div className="pagina" style={{ maxWidth: 940 }}>
      <section className="secao">
        <h2>Clientes</h2>
        <p className="resumo-secao">
          Cada empresa é uma conta separada, com as próprias chaves, leads e usuários. Uma nunca
          enxerga a outra. Usuários, integrações e mensagens de cada conta ficam em{' '}
          <Link href="/usuarios">Usuários</Link> e Configurações, depois de "trabalhar nesta conta".
        </p>

        <table className="tabela">
          <thead>
            <tr><th>Empresa</th><th>Usuários</th><th>Criada</th><th className="acao">&nbsp;</th></tr>
          </thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.id}>
                <td>
                  <b style={{ fontWeight: 600 }}>{c.nome}</b>
                  {contaAtiva === c.id && (
                    <span className="selo" style={{ marginLeft: 10 }}>trabalhando aqui</span>
                  )}
                </td>
                <td>{nUsuariosPorConta[c.id] ?? 0}</td>
                <td style={{ color: 'var(--ink-3)' }}>
                  {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                </td>
                <td className="acao">
                  {contaAtiva !== c.id && (
                    <button onClick={() => trabalharEm(c.id)}>Trabalhar nesta conta</button>
                  )}
                  <button onClick={() => editarConta(c)}>Editar</button>
                  <button onClick={() => excluirConta(c)}>Excluir</button>
                </td>
              </tr>
            ))}
            {!contas.length && (
              <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Nenhuma conta ainda.</td></tr>
            )}
          </tbody>
        </table>

        <form className="cartaocfg" style={{ marginTop: 22 }} onSubmit={criarConta}>
          <div className="linha-form">
            <div className="grupo">
              <label className="label" htmlFor="nc">Nome da empresa</label>
              <input id="nc" value={nomeConta} onChange={(e) => setNomeConta(e.target.value)}
                     placeholder="Guinffer Pratas" />
            </div>
            <button className="salvar" disabled={criandoConta || nomeConta.trim().length < 2}>
              {criandoConta ? 'Criando…' : 'Criar conta'}
            </button>
          </div>
        </form>

        {aviso && <p className="erro" style={{ marginTop: 16 }}>{aviso}</p>}
      </section>
    </div>
  );
}
