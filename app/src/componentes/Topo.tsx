'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseNoNavegador } from '@/lib/supabase/browser';

type Props = { conta: string; iniciais: string; papel: string };

export default function Topo({ conta, iniciais, papel }: Props) {
  const caminho = usePathname();
  const router = useRouter();

  function trocarTema() {
    const raiz = document.documentElement;
    const escuroAgora = raiz.dataset.tema
      ? raiz.dataset.tema === 'escuro'
      : matchMedia('(prefers-color-scheme:dark)').matches;
    raiz.dataset.tema = escuroAgora ? 'claro' : 'escuro';
    localStorage.setItem('harvest_tema', raiz.dataset.tema);
  }

  async function sair() {
    await supabaseNoNavegador().auth.signOut();
    router.replace('/entrar');
    router.refresh();
  }

  return (
    <header className="topo">
      <Link href="/" className="marca">HARVEST<em>.</em>AI</Link>
      <span className="conta">{conta}</span>

      <nav className="nav">
        <Link href="/" aria-current={caminho === '/' ? 'page' : undefined}>Prospecção</Link>
        <Link href="/configuracoes" aria-current={caminho.startsWith('/configuracoes') ? 'page' : undefined}>
          Configurações
        </Link>
      </nav>

      <button className="tema" onClick={trocarTema} aria-label="Alternar tema claro e escuro">
        <svg className="lua" width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M12.5 8.6A5.4 5.4 0 016.4 2.5a5.5 5.5 0 106.1 6.1z" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <svg className="sol" width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7.5 .8v2M7.5 12.2v2M14.2 7.5h-2M2.8 7.5h-2M12.2 2.8l-1.4 1.4M4.2 10.8l-1.4 1.4M12.2 12.2l-1.4-1.4M4.2 4.2L2.8 2.8"
                stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>

      <button className="eu" onClick={sair} title={`${papel} — sair`}>{iniciais}</button>
    </header>
  );
}
