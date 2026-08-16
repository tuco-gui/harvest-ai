'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseNoNavegador } from '@/lib/supabase/browser';
import { senhaFraca } from '@/lib/senha';

export default function VerificarCodigo() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<'codigo' | 'senha'>('codigo');
  const [salvando, setSalvando] = useState(false);

  async function validar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const r = await supabaseNoNavegador().auth.verifyOtp({
      email,
      token: codigo.trim(),
      type: 'recovery',
    });
    if (r.error) {
      setErro(
        r.error.message.includes('Token') || r.error.message.includes('expired')
          ? 'Código inválido ou expirado. Peça um novo.'
          : 'Não consegui validar agora. Tente de novo em instantes.',
      );
      return;
    }
    setEtapa('senha');
  }

  async function definir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirmar) { setErro('As senhas não conferem.'); return; }
    const fraqueza = senhaFraca(senha);
    if (fraqueza) { setErro(fraqueza); return; }

    setSalvando(true);
    const r = await fetch('/api/perfil/senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    });
    const d = await r.json().catch(() => ({}) as any);
    setSalvando(false);
    if (!r.ok) { setErro(d.erro ?? 'Não consegui salvar a senha.'); return; }

    router.replace('/');
    router.refresh();
  }

  if (etapa === 'codigo') {
    return (
      <main className="entrada">
        <form className="cartao" onSubmit={validar}>
          <span className="marca">HARVEST<em>.</em>AI</span>
          <p className="sub">Informe o código de 6 dígitos</p>

          <div className="grupo">
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" required
                   value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grupo">
            <label className="label" htmlFor="codigo">Código</label>
            <input id="codigo" inputMode="numeric" autoComplete="one-time-code" required
                   placeholder="123456" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </div>

          {erro && <p className="erro">{erro}</p>}

          <button className="entrar" disabled={!codigo.trim() || !email.trim()}>
            Verificar código
          </button>

          <p className="ajuda" style={{ marginTop: 18 }}>
            <Link href="/entrar">Voltar ao login</Link>
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="entrada">
      <form className="cartao" onSubmit={definir}>
        <span className="marca">HARVEST<em>.</em>AI</span>
        <p className="sub">Defina sua senha</p>

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
