'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Oportunidade } from '@/lib/twenty';
import { contatosDasOportunidades, pesquisarContatos } from '@/lib/crmContatos';

type Owner = { id: string; nome: string };

export default function ContatosCrm({ oportunidades, owners }: {
  oportunidades: Oportunidade[]; owners: Owner[];
}) {
  const [busca, setBusca] = useState('');
  const [owner, setOwner] = useState('');
  const [somenteDuplicados, setSomenteDuplicados] = useState(false);
  const contatos = useMemo(() => contatosDasOportunidades(oportunidades), [oportunidades]);
  const encontrados = useMemo(() => pesquisarContatos(contatos, busca, somenteDuplicados)
    .filter(c => !owner || c.owner_id === owner), [contatos, busca, somenteDuplicados, owner]);
  const suspeitos = contatos.filter(c => c.possivelDuplicidade).length;
  const comTelefone = contatos.filter(c => !!c.telefone).length;

  return <main className="pagina pagina-larga crm-contatos">
    <div className="crm-tarefas-caminho"><Link href="/crm">CRM</Link><span> / </span>Contatos</div>
    <header className="crm-tarefas-header">
      <div>
        <p className="label">CRM · RELACIONAMENTO</p>
        <h1>Contatos</h1>
        <p className="ajuda">Pessoas vinculadas aos seus negócios, com acesso rápido ao pipeline.</p>
      </div>
      <Link className="crm-atalho-tarefas" href="/crm">Ver oportunidades</Link>
    </header>
    <section className="crm-tarefas-kpis" aria-label="Resumo dos contatos">
      <div><span>Contatos identificados</span><strong>{contatos.length}</strong></div>
      <div><span>Com telefone</span><strong>{comTelefone}</strong></div>
      <div><span>Negócios vinculados</span><strong>{oportunidades.length}</strong></div>
      <div><span>Possíveis duplicidades</span><strong>{suspeitos}</strong></div>
    </section>
    <div className="crm-tarefas-filtros">
      <input value={busca} onChange={e => setBusca(e.target.value)}
        aria-label="Buscar contatos" placeholder="Buscar nome, empresa, telefone, e-mail ou etiqueta"/>
      <select aria-label="Filtrar responsável" value={owner} onChange={e => setOwner(e.target.value)}>
        <option value="">Todos os responsáveis</option>
        {owners.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
      <label className="crm-contatos-check">
        <input type="checkbox" checked={somenteDuplicados}
          onChange={e => setSomenteDuplicados(e.target.checked)}/>
        Possíveis duplicidades
      </label>
    </div>
    <p className="ajuda" style={{ marginBottom: 14 }}>
      {encontrados.length} contato(s). Os cadastros são derivados das oportunidades existentes.
      A tela não mescla registros automaticamente.
    </p>
    <div className="crm-contatos-grade">
      {encontrados.map(c => <article key={c.chave} className="crm-contato-card">
        <header>
          <span className="crm-contato-avatar" aria-hidden="true">
            {c.nome.trim().split(/\s+/).slice(0,2).map(p => p[0] ?? '').join('').toLocaleUpperCase('pt-BR')}
          </span>
          <div>
            <strong>{c.nome}</strong>
            <small>{c.empresa}</small>
          </div>
          {c.possivelDuplicidade && <span className="crm-contato-alerta" title="Mesmo e-mail ou telefone em registros que não foram mesclados">Revisar</span>}
        </header>
        <div className="crm-contato-dados">
          {c.telefone && <a href={'tel:' + c.telefone.replace(/[^\d+]/g, '')}>{c.telefone}</a>}
          {c.email && <a href={'mailto:' + c.email}>{c.email}</a>}
          {!c.telefone && !c.email && <span>Sem informações de contato</span>}
        </div>
        {c.tags.length > 0 && <div className="crm-contato-tags">
          {c.tags.slice(0,4).map(tag => <span key={tag}>{tag}</span>)}
        </div>}
        <footer>
          <span>{c.negocios.length} negócio(s) vinculado(s)</span>
          <div className="crm-contato-negocios">
            {c.negocios.slice(0,4).map(o => <Link key={o.id}
              href={'/crm?oportunidade=' + encodeURIComponent(String(o.id))}>
              {o.empresa || 'Negócio'} · {o.estagio}
            </Link>)}
          </div>
        </footer>
      </article>)}
    </div>
    {encontrados.length === 0 && <div className="crm-tarefas-vazio">
      <strong>Nenhum contato encontrado.</strong>
      <p>Altere os filtros ou cadastre uma oportunidade com nome do contato no CRM.</p>
    </div>}
    <p className="ajuda" style={{ marginTop: 19 }}>
      Nesta etapa, os contatos são uma visão das oportunidades. Cadastro independente,
      importação, mesclagem revisada e histórico de identidade ficam para a próxima evolução.
    </p>
  </main>;
}
