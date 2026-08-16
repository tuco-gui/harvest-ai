'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function EsqueciSenha() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    const r = await fetch('/api/auth/esqueci-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const d = await r.json().catch(() => ({}) as any);
    setEnviando(false);

    if (!r.ok) {
      setErro(d.erro ?? 'Não consegui processar agora. Tente de novo em instantes.');
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <main className="entrada">
        <div className="cartao">
          <span className="marca">HARVEST<em>.</em>AI</span>
          <p className="sub">Código enviado</p>
          <p className="ajuda" style={{ marginTop: 0 }}>
            Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos para ele.
            Abra o e-mail, copie o código e informe aqui para definir a nova senha.
          </p>
          <button className="entrar" onClick={() => router.push('/verificar-codigo')}>
            Informar código
          </button>
          <p className="ajuda" style={{ marginTop: 18 }}>
            <Link href="/entrar">Voltar para o login</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="entrada">
      <form className="cartao" onSubmit={pedir}>
        <span className="marca">HARVEST<em>.</em>AI</span>
        <p className="sub">Esqueci minha senha</p>

        <div className="grupo">
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {erro && <p className="erro">{erro}</p>}

        <button className="entrar" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar código'}
        </button>

        <p className="ajuda" style={{ marginTop: 18 }}>
          <Link href="/entrar">Lembrou a senha? Voltar ao login</Link>
        </p>
      </form>
    </main>
  );
}
