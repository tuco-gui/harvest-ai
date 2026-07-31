'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseNoNavegador } from '@/lib/supabase/browser';

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    const { error } = await supabaseNoNavegador().auth.signInWithPassword({ email, password: senha });

    if (error) {
      // a mensagem do GoTrue vem em inglês e é vaga demais para o usuário
      setErro(
        error.message.includes('Invalid login')
          ? 'E-mail ou senha não conferem.'
          : 'Não consegui entrar agora. Tente de novo em instantes.',
      );
      setEnviando(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="entrada">
      <form className="cartao" onSubmit={entrar}>
        <span className="marca">HARVEST<em>.</em>AI</span>
        <p className="sub">by Figueira Marketing</p>

        <div className="grupo">
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="grupo">
          <label className="label" htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required
                 value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        {erro && <p className="erro">{erro}</p>}

        <button className="entrar" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
