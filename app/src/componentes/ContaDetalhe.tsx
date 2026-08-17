'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Usuario = { id: string; nome: string | null; email: string; papel: string; criado_em: string };
type Campanha = { id: number; nome: string; origem: string; criado_em: string; encontradas: number; com_whatsapp: number };
type Erro = { tipo: string; empresa: string; erro: string; quando: string };
type Chamado = { id: number; assunto: string; categoria: string; status: string; criado_em: string; prazo_sla: string };
type Integracoes = {
  serpapi: boolean; whatsapp: boolean; ia: boolean;
  decisor: string | boolean | null; linkedin: boolean; email: boolean;
};

const NOME_ORIGEM: Record<string, string> = { busca: 'Busca', planilha: 'Planilha', manual: 'Manual' };
const NOME_PAPEL: Record<string, string> = { admin: 'Administrador', operador: 'Operador', super_admin: 'Super admin' };
const NOME_STATUS: Record<string, string> = { aberta: 'Aberto', respondida: 'Respondido', fechada: 'Fechado' };

export default function ContaDetalhe({
  conta, usuarios, integracoes, campanhas, erros, chamados,
}: {
  conta: { id: string; nome: string; slug: string; ativo: boolean; modulos_habilitados: string[] | null };
  usuarios: Usuario[]; integracoes: Integracoes; campanhas: Campanha[]; erros: Erro[]; chamados: Chamado[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<'usuarios' | 'modulos' | 'integracoes' | 'campanhas' | 'erros' | 'chamados'>('usuarios');
  const [modulos, setModulos] = useState<string[]>(conta.modulos_habilitados ?? ['whatsapp', 'ia', 'usuarios', 'chamados', 'status']);
  const [salvandoModulos, setSalvandoModulos] = useState(false);
  const [avisoModulos, setAvisoModulos] = useState<string | null>(null);

  async function trabalharNestaConta() {
    await fetch('/api/conta-ativa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: conta.id }),
    });
    router.push('/');
  }

  async function alternarCrm() {
    const novos = modulos.includes('crm')
      ? modulos.filter((m) => m !== 'crm')
      : [...modulos, 'crm'];
    setSalvandoModulos(true);
    setAvisoModulos(null);
    const r = await fetch('/api/contas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: conta.id, modulos_habilitados: novos }),
    });
    const d = await r.json().catch(() => ({}));
    setSalvandoModulos(false);
    if (!r.ok) {
      setAvisoModulos(d.erro ?? 'Não foi possível alterar o módulo.');
      return;
    }
    setModulos(d.modulos_habilitados ?? novos);
    setAvisoModulos(novos.includes('crm') ? 'CRM liberado para esta conta.' : 'CRM desativado para esta conta.');
    router.refresh();
  }

  const badge = (rotulo: string, ok: boolean | string | null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
      <span>{rotulo}</span>
      <span className="selo" data-zap-selo={ok ? 'sim' : 'nao'}>
        {ok ? (typeof ok === 'string' ? ok : 'Configurada') : 'Não configurada'}
      </span>
    </div>
  );

  return (
    <div className="pagina">
      <p className="ajuda"><Link href="/contas">← Contas</Link></p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, letterSpacing: '-.02em' }}>
          {conta.nome} {!conta.ativo && <span className="selo" data-zap-selo="nao">inativa</span>}
        </h2>
        <button type="button" className="salvar" onClick={trabalharNestaConta}>Trabalhar nesta conta</button>
      </div>

      <div className="modos" style={{ marginTop: 16, marginBottom: 20 }}>
        <button aria-pressed={aba === 'usuarios'} onClick={() => setAba('usuarios')}>Usuários ({usuarios.length})</button>
        <button aria-pressed={aba === 'modulos'} onClick={() => setAba('modulos')}>Módulos</button>
        <button aria-pressed={aba === 'integracoes'} onClick={() => setAba('integracoes')}>Integrações</button>
        <button aria-pressed={aba === 'campanhas'} onClick={() => setAba('campanhas')}>Campanhas ({campanhas.length})</button>
        <button aria-pressed={aba === 'erros'} onClick={() => setAba('erros')}>
          Log de erros{erros.length > 0 ? ` (${erros.length})` : ''}
        </button>
        <button aria-pressed={aba === 'chamados'} onClick={() => setAba('chamados')}>
          Chamados{chamados.length > 0 ? ` (${chamados.length})` : ''}
        </button>
      </div>

      {aba === 'usuarios' && (
        <table className="tabela">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Desde</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome || '—'}</td>
                <td style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                <td>{NOME_PAPEL[u.papel] ?? u.papel}</td>
                <td style={{ color: 'var(--ink-3)' }}>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
            {!usuarios.length && <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Nenhum usuário ainda.</td></tr>}
          </tbody>
        </table>
      )}

      {aba === 'modulos' && (
        <div className="cartaocfg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <strong>CRM</strong>
              <p className="ajuda" style={{ margin: '4px 0 0' }}>
                Pipeline de oportunidades, qualificação de leads e gestão comercial.
              </p>
            </div>
            <button
              type="button"
              className={modulos.includes('crm') ? 'btn-teste' : 'salvar'}
              disabled={salvandoModulos}
              onClick={alternarCrm}
            >
              {salvandoModulos ? 'Salvando…' : modulos.includes('crm') ? 'Desativar CRM' : 'Liberar CRM'}
            </button>
          </div>
          <p className="ajuda" style={{ marginTop: 12 }}>
            {modulos.includes('crm')
              ? 'O CRM está visível para administradores desta conta.'
              : 'O CRM está oculto e as APIs permanecem bloqueadas para esta conta.'}
          </p>
          {avisoModulos && <p className="ajuda" style={{ marginTop: 8 }}>{avisoModulos}</p>}
        </div>
      )}

      {aba === 'integracoes' && (
        <div className="cartaocfg">
          {badge('SerpAPI (busca no Google Maps)', integracoes.serpapi)}
          {badge('WhatsApp (Evolution)', integracoes.whatsapp)}
          {badge('Inteligência artificial (mensagens)', integracoes.ia)}
          {badge('Decisor (Perplexity ou grátis)', integracoes.decisor)}
          {badge('LinkedIn (Serper/Tavily)', integracoes.linkedin)}
          {badge('E-mail (Anymail/Apollo/Snov)', integracoes.email)}
          <p className="ajuda" style={{ marginTop: 10 }}>
            Chaves ficam em Configurações — aqui só mostra se estão cadastradas, não os valores.
          </p>
        </div>
      )}

      {aba === 'campanhas' && (
        <table className="tabela">
          <thead><tr><th>Campanha</th><th>Origem</th><th>Quando</th><th>Encontradas</th><th>Com WhatsApp</th></tr></thead>
          <tbody>
            {campanhas.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/campanhas/${c.id}`} style={{ fontWeight: 600, textDecoration: 'underline' }}>{c.nome}</Link></td>
                <td style={{ color: 'var(--ink-2)' }}>{NOME_ORIGEM[c.origem] ?? c.origem}</td>
                <td style={{ color: 'var(--ink-3)' }}>{new Date(c.criado_em).toLocaleString('pt-BR')}</td>
                <td>{c.encontradas}</td>
                <td>{c.com_whatsapp}</td>
              </tr>
            ))}
            {!campanhas.length && <tr><td colSpan={5} style={{ color: 'var(--ink-3)' }}>Nenhuma campanha ainda.</td></tr>}
          </tbody>
        </table>
      )}

      {aba === 'erros' && (
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Tipo</th><th>Empresa</th><th>Motivo</th></tr></thead>
          <tbody>
            {erros.map((e, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{e.quando}</td>
                <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{e.tipo}</td>
                <td>{e.empresa}</td>
                <td style={{ color: 'var(--ink-2)' }}>{e.erro}</td>
              </tr>
            ))}
            {!erros.length && <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Nenhum erro registrado.</td></tr>}
          </tbody>
        </table>
      )}

      {aba === 'chamados' && (
        <table className="tabela">
          <thead><tr><th>Assunto</th><th>Categoria</th><th>Status</th><th>Aberto em</th></tr></thead>
          <tbody>
            {chamados.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/chamados/${c.id}`} style={{ fontWeight: 600, textDecoration: 'underline' }}>{c.assunto}</Link></td>
                <td style={{ color: 'var(--ink-2)' }}>{c.categoria}</td>
                <td>{NOME_STATUS[c.status] ?? c.status}</td>
                <td style={{ color: 'var(--ink-3)' }}>{new Date(c.criado_em).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {!chamados.length && <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Nenhum chamado ainda.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
