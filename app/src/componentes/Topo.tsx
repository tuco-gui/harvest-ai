'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabaseNoNavegador } from '@/lib/supabase/browser';
import {
  Search, Send, Briefcase, Workflow, Settings, Users,
  Headphones, Activity, Building, UserCog, Wrench,
  ChevronDown, ChevronLeft, ChevronRight, Sun, Moon,
} from 'lucide-react';

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

const ICONES: Record<string, React.ReactNode> = {
  '/': <Search size={18} strokeWidth={1.8} />,
  '/campanhas': <Send size={18} strokeWidth={1.8} />,
  '/crm': <Briefcase size={18} strokeWidth={1.8} />,
  '/funis': <Workflow size={18} strokeWidth={1.8} />,
  '/configuracoes': <Settings size={18} strokeWidth={1.8} />,
  '/usuarios': <Users size={18} strokeWidth={1.8} />,
  '/chamados': <Headphones size={18} strokeWidth={1.8} />,
  '/status': <Activity size={18} strokeWidth={1.8} />,
  '/contas': <Building size={18} strokeWidth={1.8} />,
  '/equipe': <UserCog size={18} strokeWidth={1.8} />,
  '/sistema': <Wrench size={18} strokeWidth={1.8} />,
};

export default function Topo(p: Props) {
  const caminho = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState<null | 'perfil' | 'contas'>(null);
  const [recolhida, setRecolhida] = useState(false);
  const caixa = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('harvest_sidebar');
      if (salvo === 'recolhida') setRecolhida(true);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('harvest_sidebar', recolhida ? 'recolhida' : 'expandida'); } catch {}
  }, [recolhida]);

  // Fechar dropdown ao clicar fora
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

  // Fechar dropdown ao recolher sidebar
  useEffect(() => {
    if (recolhida) setMenu(null);
  }, [recolhida]);

  // Fechar dropdown ao mudar de rota
  useEffect(() => {
    setMenu(null);
  }, [caminho]);

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
            {recolhida ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {(p.contas.length > 1 || p.ehSuperAdmin) && (
          <div className="lateral-workspace" style={{ position: 'relative' }} ref={dropdownRef}>
            <button className="lateral-workspace-btn"
              onClick={() => setMenu(menu === 'contas' ? null : 'contas')}
              aria-expanded={menu === 'contas'}>
              <span className="ws-nome">{p.contaNome}</span>
              <ChevronDown size={12} style={{ flexShrink: 0 }} />
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
                <button className="menu-item" onClick={trocarTema}>
                  <span className="tema-mini">{matchMedia('(prefers-color-scheme:dark)').matches ? <Sun size={14} /> : <Moon size={14} />}</span>
                  Alternar tema
                </button>
                <button className="menu-item" onClick={sair}>Sair</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="app-main">
        <div className="topo-barra">
          <button className="tema" onClick={trocarTema} aria-label="Alternar tema">
            <span className="sol"><Sun size={16} /></span>
            <span className="lua"><Moon size={16} /></span>
          </button>
          <div className="menu-raiz">
            <button className="eu" onClick={() => setMenu(menu === 'perfil' ? null : 'perfil')}
              aria-expanded={menu === 'perfil'}>
              {p.iniciais}
            </button>
            {menu === 'perfil' && (
              <div className="menu" style={{ top: '100%', right: 0, marginTop: 6, minWidth: 200 }}>
                <div className="menu-cabecalho">
                  <strong>{p.nome}</strong>
                  <small>{p.email}</small>
                  <small>{NOME_PAPEL[p.papel] ?? p.papel}</small>
                </div>
                <div className="menu-risco" />
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
