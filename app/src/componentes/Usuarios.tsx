'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Perfil = { id: string; nome: string | null; email: string | null; papel: string };

const NOME_PAPEL: Record<string, string> = { admin: 'Administrador', operador: 'Operador' };

export default function Usuarios({
  usuarios, contaNome, meuId, temSmtp,
}: { usuarios: Perfil[]; contaNome: string; meuId: string; temSmtp: boolean }) {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState('operador');
  const [criando, setCriando] = useState(false);

  const [aviso, setAviso] = useState<string | null>(null);
  const [otpEnviado, setOtpEnviado] = useState<{ email: string; primeiroAcesso?: boolean } | null>(null);

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null); setOtpEnviado(null); setCriando(true);
    const r = await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, papel }),
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
        <h2>Usuários — {contaNome}</h2>
        <p className="resumo-secao">
          O operador busca e dispara. O administrador também mexe em chaves e mensagens.{' '}
          {temSmtp
            ? 'Com o SMTP do sistema configurado, o acesso e as redefinições saem por e-mail: a pessoa recebe um código e define a própria senha.'
            : 'Sem SMTP configurado não é possível criar usuários nem redefinir senhas — o código de acesso não tem como ser entregue.'}
        </p>

        <table className="tabela">
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome || '—'}</td>
                <td style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                <td><span className="selo" data-papel={u.papel}>{NOME_PAPEL[u.papel] ?? u.papel}</span></td>
                <td className="acao">
                  <button onClick={() => enviarOtp(u)}>Enviar código de acesso</button>
                  {u.id !== meuId && <button onClick={() => remover(u)}>Remover</button>}
                </td>
              </tr>
            ))}
            {!usuarios.length && (
              <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Sem usuários nesta conta.</td></tr>
            )}
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
            <div className="grupo" style={{ maxWidth: 190 }}>
              <label className="label" htmlFor="up">Papel</label>
              <select id="up" value={papel} onChange={(e) => setPapel(e.target.value)}
                      style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                               border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
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
