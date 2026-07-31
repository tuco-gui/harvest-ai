'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { supabaseNoNavegador } from '@/lib/supabase/browser';

type Props = { nome: string | null; email: string | null; avatarUrl: string | null };

export default function Perfil(p: Props) {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(p.avatarUrl);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const [aviso, setAviso] = useState<string | null>(null);

  const iniciais = (p.nome ?? p.email ?? '?')
    .split(' ').filter(Boolean).slice(0, 2).map((c) => c[0]).join('').toUpperCase();

  async function trocarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    setAviso(null); setEnviandoFoto(true);
    const forma = new FormData();
    forma.append('arquivo', arquivo);
    const r = await fetch('/api/perfil/avatar', { method: 'POST', body: forma });
    const d = await r.json();
    setEnviandoFoto(false);
    if (!r.ok) { setAviso(d.erro); return; }
    setAvatarUrl(d.avatar_url);
    router.refresh(); // o avatar do topo também precisa atualizar
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (senha.length < 8) { setAviso('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmar) { setAviso('As senhas não conferem.'); return; }

    setSalvandoSenha(true);
    const { error } = await supabaseNoNavegador().auth.updateUser({ password: senha });
    setSalvandoSenha(false);
    if (error) { setAviso('Não consegui trocar a senha. Tente de novo.'); return; }
    setSenha(''); setConfirmar('');
    setAviso('Senha alterada.');
  }

  return (
    <div className="pagina">
      <section className="secao">
        <h2>Sua foto</h2>
        <div className="cartaocfg" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" width={64} height={64}
                 style={{ borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--surface)',
              border: '1px solid var(--rule)', display: 'grid', placeItems: 'center',
              fontSize: 20, fontWeight: 600, color: 'var(--ink-2)',
            }}>
              {iniciais}
            </div>
          )}
          <div>
            <input ref={arquivoRef} type="file" accept="image/*" onChange={trocarFoto} hidden />
            <button type="button" className="salvar" disabled={enviandoFoto}
                    onClick={() => arquivoRef.current?.click()}>
              {enviandoFoto ? 'Enviando…' : 'Trocar foto'}
            </button>
            <p className="ajuda">JPG ou PNG, até 3 MB.</p>
          </div>
        </div>
      </section>

      <section className="secao">
        <h2>Trocar senha</h2>
        <p className="resumo-secao">Vale para o seu próximo login.</p>
        <form className="cartaocfg" onSubmit={trocarSenha}>
          <div className="grupo">
            <label className="label" htmlFor="senha">Nova senha</label>
            <input id="senha" type="password" autoComplete="new-password"
                   value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="grupo">
            <label className="label" htmlFor="confirmar">Confirmar nova senha</label>
            <input id="confirmar" type="password" autoComplete="new-password"
                   value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </div>
          <button className="salvar" disabled={salvandoSenha || !senha}>
            {salvandoSenha ? 'Salvando…' : 'Salvar senha'}
          </button>
        </form>
      </section>

      {aviso && <p className="aviso">{aviso}</p>}
    </div>
  );
}
