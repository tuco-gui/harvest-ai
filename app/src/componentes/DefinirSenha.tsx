'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Tela obrigatória enquanto senha_provisoria=true. Sem isso, o usuário
 *  continuaria trabalhando com a senha "NomeDaEmpresa1234" para sempre. */
export default function DefinirSenha({ email }: { email: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirmar) { setErro('As senhas não conferem.'); return; }

    setSalvando(true);
    const r = await fetch('/api/perfil/senha', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    });
    const d = await r.json();
    setSalvando(false);
    if (!r.ok) { setErro(d.erro); return; }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="entrada">
      <form className="cartao" onSubmit={salvar}>
        <span className="marca">HARVEST<em>.</em>AI</span>
        <p className="sub">Antes de continuar, defina uma senha só sua.</p>

        <div className="grupo">
          <label className="label">Conta</label>
          <input value={email} disabled />
        </div>

        <div className="grupo">
          <label className="label" htmlFor="senha">Senha nova</label>
          <input id="senha" type="password" autoComplete="new-password" required
                 value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        <div className="grupo">
          <label className="label" htmlFor="confirmar">Confirmar senha nova</label>
          <input id="confirmar" type="password" autoComplete="new-password" required
                 value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        </div>

        <p className="ajuda">Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.</p>

        {erro && <p className="erro">{erro}</p>}

        <button className="entrar" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Definir senha e entrar'}
        </button>
      </form>
    </main>
  );
}
