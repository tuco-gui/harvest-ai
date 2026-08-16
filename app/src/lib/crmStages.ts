/**
 * Estágios do Pipeline CRM (P0).
 *
 * Não são hardcoded arbitrariamente: espelham os estágios padrão do Twenty
 * (nova → ganho/perda). Quando o Twenty estiver plugado, estes IDs/nomes
 * devem ser substituídos pelos estágios reais do workspace (ver item 11 do
 * escopo). Por ora vivem aqui como camada configurável, editável em um só
 * lugar, sem espalhar strings de estágio pelo componente.
 */
export type Estagio = { id: string; nome: string; ordem: number };

export const ESTAGIOS_CRM: Estagio[] = [
  { id: 'novo', nome: 'Novo', ordem: 1 },
  { id: 'contato', nome: 'Em contato', ordem: 2 },
  { id: 'proposta', nome: 'Proposta', ordem: 3 },
  { id: 'negociacao', nome: 'Negociação', ordem: 4 },
  { id: 'ganho', nome: 'Ganho', ordem: 5 },
  { id: 'perdido', nome: 'Perdido', ordem: 6 },
];

export const ESTAGIO_PADRAO = 'novo';

export function estagioValido(id: string): boolean {
  return ESTAGIOS_CRM.some((e) => e.id === id);
}

export function nomeEstagio(id: string): string {
  return ESTAGIOS_CRM.find((e) => e.id === id)?.nome ?? id;
}
