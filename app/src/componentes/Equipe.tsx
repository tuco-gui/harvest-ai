'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Perfil = { id: string; nome: string | null; email: string | null };

export default function Equipe({ equipe, meuId }: { equipe: Perfil[]; meuId: string }) {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [criando, setCriando] = useState(false);

  const [aviso, setAviso] = useState<string | null>(null);
  const [senhaNova, setSenhaNova] = useState<{ email: string; senha: string; emailEnviado?: boolean } | null>(null);

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null); setSenhaNova(null); setCriando(true);
    const r = await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, papel: 'super_admin' }),
    });
    const d = await r.json();
    setCriando(false);
    if (!r.ok) { setAviso(d.erro); return; }
    setSenhaNova({ email: d.email, senha: d.senha, emailEnviado: d.emailEnviado });
    setNome(''); setEmail('');
    router.refresh();
  }

  async function remover(u: Perfil) {
    if (!confirm(`Remover ${u.email}? Ele perde o acesso na hora.`)) return;
    const r = await fetch('/api/usuarios', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    });
    const d = await r.json();
    if (!r.ok) { setAviso(d.erro); return; }
    router.refresh();
  }

  async function gerarSenha(u: Perfil) {
    if (!confirm(`Gerar uma senha nova para ${u.email}? A senha atual dele para de funcionar.`)) return;
    setAviso(null); setSenhaNova(null);
    const r = await fetch('/api/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    });
    const d = await r.json();
    if (!r.ok) { setAviso(d.erro); return; }
    setSenhaNova({ email: d.email, senha: d.senha, emailEnviado: d.emailEnviado });
  }

  return (
    <div className="pagina">
      <section className="secao">
        <h2>Equipe Figueira</h2>
        <p className="resumo-secao">
          Super admin enxerga e mexe em todas as contas de cliente, sem exceção.
        </p>

        <table className="tabela">
          <tbody>
            {equipe.map((u) => (
              <tr key={u.id}>
                <td>{u.nome || '—'}</td>
                <td style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                <td className="acao">
                  <button onClick={() => gerarSenha(u)}>Gerar nova senha</button>
                  {u.id !== meuId && <button onClick={() => remover(u)}>Remover</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {senhaNova && (
          <div className="senha-nova" style={{ marginTop: 22 }}>
            Passe estes dados para <b>{senhaNova.email}</b>: <code>{senhaNova.senha}</code>
            <br />
            {senhaNova.emailEnviado
              ? 'Também mandei por e-mail para essa pessoa.'
              : 'Esta senha aparece uma vez só e não fica guardada. Anote agora.'}
          </div>
        )}

        <form className="cartaocfg" style={{ marginTop: 22 }} onSubmit={criarUsuario}>
          <div className="linha-form">
            <div className="grupo">
              <label className="label" htmlFor="un">Nome</label>
              <input id="un" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grupo">
              <label className="label" htmlFor="ue">E-mail</label>
              <input id="ue" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="salvar" disabled={criando || !email.trim()}>
              {criando ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        </form>

        {aviso && <p className="erro" style={{ marginTop: 16 }}>{aviso}</p>}
      </section>
    </div>
  );
}
