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
  contas: Conta[];
  ehSuperAdmin: boolean;
  modulos: ModuloVisivel[];
  children: React.ReactNode;
};

const NOME_PAPEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  operador: 'Operador',
};

const ICONES: Record<string, string> = {
  '/': '🔍',
  '/campanhas': '📤',
  '/crm': '💼',
  '/funis': '🔀',
  '/configuracoes': '⚙️',
  '/usuarios': '👥',
  '/chamados': '🎫',
  '/status': '🩺',
  '/contas': '🏢',
  '/equipe': '🧑‍🤝‍🧑',
  '/sistema': '🔧',
};

export default function Topo(p: Props) {
  const caminho = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState<null | 'perfil' | 'contas'>(null);
  const [recolhida, setRecolhida] = useState(false);
  const caixa = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('harvest_sidebar');
      if (salvo === 'recolhida') setRecolhida(true);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('harvest_sidebar', recolhida ? 'recolhida' : 'expandida'); } catch {}
  }, [recolhida]);

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

  useEffect(() => {
    const raiz = document.documentElement;
    if (!raiz.dataset.tema) {
      try {
        const salvo = localStorage.getItem('harvest_tema');
        if (salvo) raiz.dataset.tema = salvo;
      } catch {}
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
    window.location.assign('/');
  }

  async function sair() {
    await supabaseNoNavegador().auth.signOut();
    router.replace('/entrar');
    router.refresh();
  }

  function link(href: string, label: string) {
    const ativo = href === '/' ? caminho === '/' : caminho.startsWith(href);
    return (
      <Link key={href} href={href} className="lateral-link" aria-current={ativo ? 'page' : undefined}>
        <span className="nav-icone">{ICONES[href] ?? '📄'}</span>
        <span>{label}</span>
      </Link>
    );
  }

  const temCrm = p.modulos.includes('crm');
  const temUsuarios = p.modulos.includes('usuarios') && p.papel !== 'operador';

  return (
    <div className="app-shell" ref={caixa as any}>
      <aside className={`lateral${recolhida ? ' recolhida' : ''}`}>
        <div className="lateral-topo">
          <Link href="/" className="lateral-brand">
            <span>HARVEST<em>.</em>AI</span>
          </Link>
          <button className="lateral-toggle" onClick={() => setRecolhida(!recolhida)}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}>
            {recolhida ? '»' : '«'}
          </button>
        </div>

        {(p.contas.length > 1 || p.ehSuperAdmin) && (
          <div className="lateral-workspace" style={{ position: 'relative' }}>
            <button className="lateral-workspace-btn"
              onClick={() => setMenu(menu === 'contas' ? null : 'contas')}
              aria-expanded={menu === 'contas'}>
              <span className="ws-nome">{p.contaNome}</span>
              <span style={{ fontSize: 10 }}>▼</span>
            </button>
            {menu === 'contas' && (
              <div className="menu" style={{ top: '100%', left: 6, right: 6, minWidth: 180 }}>
                <span className="menu-titulo">Trocar workspace</span>
                {p.contas.map((c) => (
                  <button key={c.id} className="menu-item" onClick={() => trocarConta(c.id)}>
                    {c.nome}
                  </button>
                ))}
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
        )}

        <nav className="lateral-nav">
          <div className="lateral-grupo">
            {link('/', 'Prospecção')}
            {link('/campanhas', 'Campanhas')}
            {temCrm && link('/crm', 'CRM')}
            {temCrm && p.papel !== 'operador' && link('/funis', 'Funis')}
          </div>
          <div className="lateral-grupo">
            <div className="lateral-grupo-titulo">Sistema</div>
            {link('/configuracoes', 'Configurações')}
            {temUsuarios && link('/usuarios', 'Usuários')}
            {link('/chamados', 'Chamados')}
            {link('/status', 'Saúde')}
          </div>
          {p.ehSuperAdmin && (
            <div className="lateral-grupo">
              <div className="lateral-grupo-titulo">Admin</div>
              {link('/contas', 'Contas')}
              {link('/equipe', 'Equipe')}
              {link('/sistema', 'Sistema')}
            </div>
          )}
        </nav>

        <div className="lateral-rodape">
          <div className="lateral-usuario" style={{ position: 'relative' }}
            onClick={() => setMenu(menu === 'perfil' ? null : 'perfil')}>
            <span className="lateral-usuario-avatar">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt="" width={26} height={26}
                  style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              ) : (
                p.iniciais
              )}
            </span>
            <span>{p.nome || p.email}</span>
            {menu === 'perfil' && (
              <div className="menu menu-dir" style={{ bottom: '100%', left: 6, right: 6, marginBottom: 6, minWidth: 180 }}>
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
        </div>
      </aside>

      <div className="app-main">
        <div className="topo-barra">
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
          <div className="menu-raiz">
            <button className="eu" onClick={() => setMenu(menu === 'perfil' ? null : 'perfil')}
              aria-expanded={menu === 'perfil'} aria-label="Sua conta">
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
        </div>
        {p.children}
      </div>
    </div>
  );
}
