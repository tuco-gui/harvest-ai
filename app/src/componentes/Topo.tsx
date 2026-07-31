'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabaseNoNavegador } from '@/lib/supabase/browser';

type Conta = { id: string; nome: string };

type Props = {
  nome: string;
  email: string;
  papel: string;
  iniciais: string;
  contaNome: string;
  contas: Conta[];       // só o super admin recebe a lista cheia
  ehSuperAdmin: boolean;
};

const NOME_PAPEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  operador: 'Operador',
};

export default function Topo(p: Props) {
  const caminho = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState<null | 'perfil' | 'contas'>(null);
  const caixa = useRef<HTMLElement>(null);

  // fecha ao clicar fora ou apertar Esc — senão o menu fica preso na tela
  useEffect(() => {
    function fora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setMenu(null);
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setMenu(null); }
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  function trocarTema() {
    const raiz = document.documentElement;
    const escuroAgora = raiz.dataset.tema
      ? raiz.dataset.tema === 'escuro'
      : matchMedia('(prefers-color-scheme:dark)').matches;
    raiz.dataset.tema = escuroAgora ? 'claro' : 'escuro';
    localStorage.setItem('harvest_tema', raiz.dataset.tema);
  }

  async function trocarConta(id: string | null) {
    await fetch('/api/conta-ativa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: id }),
    });
    setMenu(null);
    router.refresh();
  }

  async function sair() {
    await supabaseNoNavegador().auth.signOut();
    router.replace('/entrar');
    router.refresh();
  }

  return (
    <header className="topo" ref={caixa}>
      <Link href="/" className="marca">HARVEST<em>.</em>AI</Link>

      {p.ehSuperAdmin ? (
        <div className="menu-raiz">
          <button
            className="conta"
            onClick={() => setMenu(menu === 'contas' ? null : 'contas')}
            aria-expanded={menu === 'contas'}
          >
            {p.contaNome}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
          {menu === 'contas' && (
            <div className="menu">
              <span className="menu-titulo">Trabalhar na conta</span>
              {p.contas.map((c) => (
                <button key={c.id} className="menu-item" onClick={() => trocarConta(c.id)}>
                  {c.nome}
                </button>
              ))}
              {!p.contas.length && <span className="menu-vazio">Nenhuma conta cadastrada</span>}
              <div className="menu-risco" />
              <button className="menu-item" onClick={() => trocarConta(null)}>Sair da conta</button>
              <Link href="/contas" className="menu-item" onClick={() => setMenu(null)}>
                Gerenciar contas
              </Link>
            </div>
          )}
        </div>
      ) : (
        <span className="conta">{p.contaNome}</span>
      )}

      <nav className="nav">
        <Link href="/" aria-current={caminho === '/' ? 'page' : undefined}>Prospecção</Link>
        <Link href="/configuracoes" aria-current={caminho.startsWith('/configuracoes') ? 'page' : undefined}>
          Configurações
        </Link>
        {p.ehSuperAdmin && (
          <Link href="/contas" aria-current={caminho.startsWith('/contas') ? 'page' : undefined}>
            Contas
          </Link>
        )}
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

      {/* Antes o clique aqui deslogava direto. Um menu evita que um toque
          errado derrube a sessão no meio do trabalho. */}
      <div className="menu-raiz">
        <button
          className="eu"
          onClick={() => setMenu(menu === 'perfil' ? null : 'perfil')}
          aria-expanded={menu === 'perfil'}
          aria-label="Sua conta"
        >
          {p.iniciais}
        </button>
        {menu === 'perfil' && (
          <div className="menu menu-dir">
            <span className="menu-titulo">{p.nome || p.email}</span>
            <span className="menu-vazio">{p.email}</span>
            <span className="menu-vazio">{NOME_PAPEL[p.papel] ?? p.papel}</span>
            <div className="menu-risco" />
            <button className="menu-item" onClick={sair}>Sair</button>
          </div>
        )}
      </div>
    </header>
  );
}
