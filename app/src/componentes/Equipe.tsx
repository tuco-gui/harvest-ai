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
  const [otpEnviado, setOtpEnviado] = useState<{ email: string; primeiroAcesso?: boolean } | null>(null);

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null); setOtpEnviado(null); setCriando(true);
    const r = await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, papel: 'super_admin' }),
    });
    const d = await r.json();
    setCriando(false);
    if (!r.ok) { setAviso(d.erro); return; }
    setOtpEnviado({ email: d.email, primeiroAcesso: true });
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

  async function enviarOtp(u: Perfil) {
    if (!confirm(`Enviar um código de acesso para ${u.email}? A senha atual dele para de funcionar até ele definir a nova.`)) return;
    setAviso(null); setOtpEnviado(null);
    const r = await fetch('/api/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    });
    const d = await r.json();
    if (!r.ok) { setAviso(d.erro); return; }
    setOtpEnviado({ email: d.email, primeiroAcesso: false });
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
                  <button onClick={() => enviarOtp(u)}>Enviar código de acesso</button>
                  {u.id !== meuId && <button onClick={() => remover(u)}>Remover</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {otpEnviado && (
          <div className="senha-nova" style={{ marginTop: 22 }}>
            {otpEnviado.primeiroAcesso ? (
              <>Enviamos um código de primeiro acesso para <b>{otpEnviado.email}</b> por e-mail. A pessoa usa esse código para definir a própria senha.</>
            ) : (
              <>Enviamos um código de acesso para <b>{otpEnviado.email}</b> por e-mail. A senha atual dele para de funcionar até ele definir a nova em /verificar-codigo.</>
            )}
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
