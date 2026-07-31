'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Conta = { id: string; nome: string; slug: string; ativo: boolean; criado_em: string };
type Perfil = { id: string; nome: string | null; email: string | null; papel: string; conta_id: string | null };

const NOME_PAPEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  operador: 'Operador',
};

export default function Contas({
  contas, perfis, contaAtiva, meuId,
}: { contas: Conta[]; perfis: Perfil[]; contaAtiva: string | null; meuId: string }) {
  const router = useRouter();

  const [nomeConta, setNomeConta] = useState('');
  const [criandoConta, setCriandoConta] = useState(false);

  const [alvo, setAlvo] = useState<string>('');   // '' = equipe da Figueira
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState('operador');
  const [criandoUsuario, setCriandoUsuario] = useState(false);

  const [aviso, setAviso] = useState<string | null>(null);
  const [senhaNova, setSenhaNova] = useState<{ email: string; senha: string } | null>(null);

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

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null); setSenhaNova(null); setCriandoUsuario(true);

    const ehEquipe = alvo === '';
    const r = await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome, email,
        papel: ehEquipe ? 'super_admin' : papel,
        conta_id: ehEquipe ? null : alvo,
      }),
    });
    const d = await r.json();
    setCriandoUsuario(false);
    if (!r.ok) { setAviso(d.erro); return; }

    setSenhaNova({ email: d.email, senha: d.senha });
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
    setSenhaNova({ email: d.email, senha: d.senha });
  }

  async function trabalharEm(id: string) {
    await fetch('/api/conta-ativa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: id }),
    });
    router.refresh();
  }

  const equipe = perfis.filter((p) => p.papel === 'super_admin');

  return (
    <div className="pagina" style={{ maxWidth: 940 }}>
      <section className="secao">
        <h2>Contas de cliente</h2>
        <p className="resumo-secao">
          Cada empresa é uma conta separada, com as próprias chaves, leads e usuários. Uma nunca
          enxerga a outra.
        </p>

        <table className="tabela">
          <thead>
            <tr><th>Empresa</th><th>Usuários</th><th>Criada</th><th className="acao">&nbsp;</th></tr>
          </thead>
          <tbody>
            {contas.map((c) => {
              const nUsuarios = perfis.filter((p) => p.conta_id === c.id).length;
              return (
                <tr key={c.id}>
                  <td>
                    <b style={{ fontWeight: 600 }}>{c.nome}</b>
                    {contaAtiva === c.id && (
                      <span className="selo" style={{ marginLeft: 10 }}>trabalhando aqui</span>
                    )}
                  </td>
                  <td>{nUsuarios}</td>
                  <td style={{ color: 'var(--ink-3)' }}>
                    {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="acao">
                    {contaAtiva !== c.id && (
                      <button onClick={() => trabalharEm(c.id)}>Trabalhar nesta conta</button>
                    )}
                  </td>
                </tr>
              );
            })}
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
      </section>

      <section className="secao">
        <h2>Usuários</h2>
        <p className="resumo-secao">
          O operador busca e dispara. O administrador também mexe em chaves e mensagens.
          Não há envio de e-mail configurado ainda: ao criar um usuário ou gerar uma senha nova,
          passe os dados para a pessoa por fora (WhatsApp, por exemplo). Ela troca a senha depois,
          pelo próprio perfil.
        </p>

        {contas.map((c) => {
          const doCliente = perfis.filter((p) => p.conta_id === c.id);
          return (
            <div key={c.id} style={{ marginBottom: 26 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>{c.nome}</h3>
              <table className="tabela">
                <tbody>
                  {doCliente.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nome || '—'}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                      <td><span className="selo" data-papel={u.papel}>{NOME_PAPEL[u.papel]}</span></td>
                      <td className="acao">
                        <button onClick={() => gerarSenha(u)}>Gerar nova senha</button>
                        <button onClick={() => remover(u)}>Remover</button>
                      </td>
                    </tr>
                  ))}
                  {!doCliente.length && (
                    <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Sem usuários nesta conta.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}

        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>Equipe Figueira</h3>
        <table className="tabela">
          <tbody>
            {equipe.map((u) => (
              <tr key={u.id}>
                <td>{u.nome || '—'}</td>
                <td style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                <td><span className="selo" data-papel={u.papel}>{NOME_PAPEL[u.papel]}</span></td>
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
            Esta senha aparece uma vez só e não fica guardada. Anote agora.
          </div>
        )}

        <form className="cartaocfg" style={{ marginTop: 22 }} onSubmit={criarUsuario}>
          <div className="linha-form">
            <div className="grupo">
              <label className="label" htmlFor="uc">Conta</label>
              <select id="uc" value={alvo} onChange={(e) => setAlvo(e.target.value)}
                      style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                               border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                <option value="">Equipe Figueira (super admin)</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="grupo">
              <label className="label" htmlFor="un">Nome</label>
              <input id="un" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grupo">
              <label className="label" htmlFor="ue">E-mail</label>
              <input id="ue" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {alvo !== '' && (
              <div className="grupo" style={{ maxWidth: 190 }}>
                <label className="label" htmlFor="up">Papel</label>
                <select id="up" value={papel} onChange={(e) => setPapel(e.target.value)}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  <option value="operador">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            )}
            <button className="salvar" disabled={criandoUsuario || !email.trim()}>
              {criandoUsuario ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        </form>

        {aviso && <p className="erro" style={{ marginTop: 16 }}>{aviso}</p>}
      </section>
    </div>
  );
}
