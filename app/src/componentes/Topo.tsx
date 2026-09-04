'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabaseNoNavegador } from '@/lib/supabase/browser';

type Conta = { id: string; nome: string };
export type ModuloVisivel = 'whatsapp' | 'ia' | 'usuarios' | 'chamados' | 'status' | 'enriquecimento' | 'crm';

type Props = {
  nome: string;
  email: string;
  papel: string;
  iniciais: string;
  avatarUrl: string | null;
  contaNome: string;
  contas: Conta[];       // workspaces do usuário (ou todas se super_admin)
  ehSuperAdmin: boolean;
  modulos: ModuloVisivel[]; // módulos habilitados para a conta (visibilidade)
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

  // BUG CONFIRMADO (QA 2026-08-14): em algumas rotas (ex.: /chamados), o
  // script inline no <head> que aplica o tema salvo antes da pintura (ver
  // app/layout.tsx) não estava efetivando data-tema a tempo — a página
  // abria no tema padrão (escuro) mesmo com 'harvest_tema' salvo como
  // 'claro' no localStorage. Rede de segurança: assim que o Topo (presente
  // em toda página autenticada) monta, reaplica o tema salvo se por algum
  // motivo ainda não foi aplicado. Só escreve se `dataset.tema` ainda
  // estiver vazio — nunca sobrescreve um tema já certo, então não introduz
  // flash nem some com a escolha do usuário.
  useEffect(() => {
    const raiz = document.documentElement;
    if (!raiz.dataset.tema) {
      try {
        const salvo = localStorage.getItem('harvest_tema');
        if (salvo) raiz.dataset.tema = salvo;
      } catch { /* localStorage indisponível — mantém o padrão */ }
    }
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
    // Hard navigation para garantir descarte total do estado da conta anterior
    window.location.assign('/');
  }

  async function sair() {
    await supabaseNoNavegador().auth.signOut();
    router.replace('/entrar');
    router.refresh();
  }

  return (
    <header className="topo" ref={caixa}>
      <Link href="/" className="marca">HARVEST<em>.</em>AI</Link>

      {p.contas.length > 1 || p.ehSuperAdmin ? (
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
              <span className="menu-titulo">Trocar workspace</span>
              {p.contas.map((c) => (
                <button key={c.id} className="menu-item" onClick={() => trocarConta(c.id)}>
                  {c.nome}
                </button>
              ))}
              {!p.contas.length && <span className="menu-vazio">Nenhuma conta acessível</span>}
              <div className="menu-risco" />
              <button className="menu-item" onClick={() => trocarConta(null)}>Sair da conta</button>
              {p.ehSuperAdmin && (
                <Link href="/contas" className="menu-item" onClick={() => setMenu(null)}>
                  Gerenciar contas
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <span className="conta">{p.contaNome}</span>
      )}

      <nav className="nav">
        <Link href="/" aria-current={caminho === '/' ? 'page' : undefined}>Prospecção</Link>
        <Link href="/campanhas" aria-current={caminho.startsWith('/campanhas') ? 'page' : undefined}>
          Campanhas
        </Link>
        {p.modulos.includes('crm') && (
          <Link href="/crm" aria-current={caminho.startsWith('/crm') ? 'page' : undefined}>
            CRM
          </Link>
        )}
        <Link href="/configuracoes" aria-current={caminho.startsWith('/configuracoes') ? 'page' : undefined}>
          Configurações
        </Link>
        {p.papel !== 'operador' && p.modulos.includes('usuarios') && (
          <Link href="/usuarios" aria-current={caminho.startsWith('/usuarios') ? 'page' : undefined}>
            Usuários
          </Link>
        )}
        <Link href="/chamados" aria-current={caminho.startsWith('/chamados') ? 'page' : undefined}>
          Chamados
        </Link>
        <Link href="/status" aria-current={caminho.startsWith('/status') ? 'page' : undefined}>
          Saúde
        </Link>
        {p.ehSuperAdmin && (
          <>
            <Link href="/contas" aria-current={caminho.startsWith('/contas') ? 'page' : undefined}>
              Contas
            </Link>
            <Link href="/equipe" aria-current={caminho.startsWith('/equipe') ? 'page' : undefined}>
              Equipe
            </Link>
            <Link href="/sistema" aria-current={caminho.startsWith('/sistema') ? 'page' : undefined}>
              Sistema
            </Link>
          </>
        )}
      </nav>

      {/* Rótulo Dia/Noite (Entrega 15): "tema claro/escuro" soava técnico
          para o cliente. Dia/Noite comunica a mesma escolha de forma direta,
          sem infantilizar — o ícone (lua/sol) já dá o contexto visual. */}
      <button className="tema" onClick={trocarTema} aria-label="Alternar entre Dia e Noite">
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
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" width={28} height={28}
                 style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          ) : (
            p.iniciais
          )}
        </button>
        {menu === 'perfil' && (
          <div className="menu menu-dir">
            <span className="menu-titulo">{p.nome || p.email}</span>
            <span className="menu-vazio">{p.email}</span>
            <span className="menu-vazio">{NOME_PAPEL[p.papel] ?? p.papel}</span>
            <div className="menu-risco" />
            <Link href="/perfil" className="menu-item" onClick={() => setMenu(null)}>
              Editar perfil
            </Link>
            <button className="menu-item" onClick={sair}>Sair</button>
          </div>
        )}
      </div>
    </header>
  );
}
