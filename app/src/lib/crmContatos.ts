import type { Oportunidade } from './twenty';

export type ContatoCrm = {
  chave: string;
  nome: string;
  empresa: string;
  telefone: string | null;
  email: string | null;
  owner_id: string | null;
  negocios: Array<{ id: number | string; empresa: string; estagio: string; valor: number; atualizado_em: string }>;
  tags: string[];
  atualizado_em: string;
  possivelDuplicidade: boolean;
};

function normalizarTexto(v: string): string {
  return v.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function normalizarTelefone(v: string | null): string {
  return (v ?? '').replace(/\D/g, '');
}

/**
 * CRM de contatos derivado das oportunidades, sem uma nova tabela de pessoas
 * e SEM mesclar automaticamente identidades ambíguas. Na ausência de nome ou
 * identificador, cada oportunidade permanece independente.
 */
export function contatosDasOportunidades(ops: Oportunidade[]): ContatoCrm[] {
  const grupos = new Map<string, ContatoCrm>();
  const contagemFones = new Map<string, number>();
  const contagemEmails = new Map<string, number>();
  for (const op of ops) {
    const nome = op.contato?.trim() || '';
    const telefone = normalizarTelefone(op.telefone);
    const email = normalizarTexto(op.email ?? '');
    if (telefone) contagemFones.set(telefone, (contagemFones.get(telefone) ?? 0) + 1);
    if (email) contagemEmails.set(email, (contagemEmails.get(email) ?? 0) + 1);
    const identidade = normalizarTexto(nome);
    // Se dois cadastros tiverem mesmo telefone, mas nomes diferentes, NÃO mesclar.
    const chave = identidade && (email || telefone)
      ? `${identidade}:${email ? 'e:' + email : 't:' + telefone}`
      : `op:${op.id}`;
    const existente = grupos.get(chave);
    const negocio = {
      id: op.id, empresa: op.empresa, estagio: op.estagio,
      valor: Number(op.valor ?? 0), atualizado_em: op.atualizado_em,
    };
    if (existente) {
      existente.negocios.push(negocio);
      existente.tags = [...new Set([...existente.tags, ...(op.tags ?? [])])];
      if (op.atualizado_em > existente.atualizado_em) existente.atualizado_em = op.atualizado_em;
      continue;
    }
    grupos.set(chave, {
      chave, nome: nome || op.empresa || 'Contato sem nome',
      empresa: op.empresa || '—',
      telefone: op.telefone, email: op.email,
      owner_id: op.owner_id,
      negocios: [negocio], tags: [...new Set(op.tags ?? [])],
      atualizado_em: op.atualizado_em,
      possivelDuplicidade: false,
    });
  }
  return [...grupos.values()].map(c => ({
    ...c,
    possivelDuplicidade: !!(
      (normalizarTelefone(c.telefone) && (contagemFones.get(normalizarTelefone(c.telefone)) ?? 0) > c.negocios.length)
      || (c.email && (contagemEmails.get(normalizarTexto(c.email)) ?? 0) > c.negocios.length)
    ),
  })).sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
}

export function pesquisarContatos(contatos: ContatoCrm[], busca: string, somenteDuplicados: boolean): ContatoCrm[] {
  const texto = normalizarTexto(busca);
  return contatos.filter(c =>
    (!somenteDuplicados || c.possivelDuplicidade) &&
    (!texto || [c.nome, c.empresa, c.email ?? '', c.telefone ?? '', ...c.tags]
      .some(v => normalizarTexto(v).includes(texto)))
  );
}
