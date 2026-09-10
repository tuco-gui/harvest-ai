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

const S = 18;

const ICONES: Record<string, React.ReactNode> = {
  '/': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  '/campanhas': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>,
  '/crm': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  '/funis': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>,
  '/configuracoes': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  '/usuarios': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  '/chamados': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>,
  '/status': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>,
  '/contas': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  '/equipe': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M19 7v3a2 2 0 0 1-2 2H7"/></svg>,
  '/sistema': <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
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

  // Fechar dropdown ao recolher sidebar
  useEffect(() => {
    if (recolhida) setMenu(null);
  }, [recolhida]);

  // Fechar dropdown ao mudar de rota
  useEffect(() => {
    setMenu(null);
  }, [caminho]);

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
        <span className="nav-icone">{ICONES[href]}</span>
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
            {recolhida
              ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>}
          </button>
        </div>

        {(p.contas.length > 1 || p.ehSuperAdmin) && (
          <div className="lateral-workspace" style={{ position: 'relative' }}>
            <button className="lateral-workspace-btn"
              onClick={() => setMenu(menu === 'contas' ? null : 'contas')}
              aria-expanded={menu === 'contas'}>
              <span className="ws-nome">{p.contaNome}</span>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m6 9 6 6 6-6"/></svg>
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
            <span className="lateral-usuario-nome">{p.nome || p.email}</span>
            {menu === 'perfil' && (
              <div className="menu" style={{ bottom: '100%', left: 6, right: 6, marginBottom: 6 }}>
                <div className="menu-cabecalho">
                  <strong>{p.nome}</strong>
                  <small>{p.email}</small>
                  <small>{NOME_PAPEL[p.papel] ?? p.papel}</small>
                </div>
                <div className="menu-risco" />
                <button className="menu-item" onClick={trocarTema}>Alternar tema</button>
                <button className="menu-item" onClick={sair}>Sair</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="app-main">
        <div className="topo-barra">
          <button className="tema" onClick={trocarTema} aria-label="Alternar tema">
            <span className="sol">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            </span>
            <span className="lua">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            </span>
          </button>
        </div>
        {p.children}
      </div>
    </div>
  );
}
