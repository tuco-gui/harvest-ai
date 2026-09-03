/**
 * Estágios do Pipeline CRM (P0).
 *
 * Não são hardcoded arbitrariamente: espelham os estágios padrão do Twenty
 * (nova → ganho/perda). Quando o Twenty estiver plugado, estes IDs/nomes
 * devem ser substituídos pelos estágios reais do workspace (ver item 11 do
 * escopo). Por ora vivem aqui como camada configurável, editável em um só
 * lugar, sem espalhar strings de estágio pelo componente.
 */
export type Estagio = {
  id: string;
  nome: string;
  ordem: number;
  grupo: 'pipeline' | 'encerrado';
  probabilidade: number;
};

export const ESTAGIOS_CRM: Estagio[] = [
  { id: 'novo', nome: 'Novo', ordem: 1, grupo: 'pipeline', probabilidade: 5 },
  { id: 'contatado', nome: 'Contatado', ordem: 2, grupo: 'pipeline', probabilidade: 10 },
  { id: 'respondeu', nome: 'Respondeu', ordem: 3, grupo: 'pipeline', probabilidade: 20 },
  { id: 'qualificando', nome: 'Qualificando', ordem: 4, grupo: 'pipeline', probabilidade: 35 },
  { id: 'reuniao', nome: 'Reunião', ordem: 5, grupo: 'pipeline', probabilidade: 50 },
  { id: 'proposta', nome: 'Proposta', ordem: 6, grupo: 'pipeline', probabilidade: 70 },
  { id: 'ganho', nome: 'Ganho', ordem: 7, grupo: 'pipeline', probabilidade: 100 },
  { id: 'sem_interesse', nome: 'Sem interesse', ordem: 8, grupo: 'encerrado', probabilidade: 0 },
  { id: 'optout', nome: 'Opt-out', ordem: 9, grupo: 'encerrado', probabilidade: 0 },
  { id: 'invalido', nome: 'Inválido', ordem: 10, grupo: 'encerrado', probabilidade: 0 },
  { id: 'perdido', nome: 'Perdido', ordem: 11, grupo: 'encerrado', probabilidade: 0 },
];

export const ESTAGIOS_PIPELINE = ESTAGIOS_CRM.filter((e) => e.grupo === 'pipeline');
export const ESTAGIOS_ENCERRADOS = ESTAGIOS_CRM.filter((e) => e.grupo === 'encerrado');

export const ESTAGIO_PADRAO = 'novo';

export function estagioValido(id: string): boolean {
  return ESTAGIOS_CRM.some((e) => e.id === id);
}

export function nomeEstagio(id: string): string {
  return ESTAGIOS_CRM.find((e) => e.id === id)?.nome ?? id;
}

export function probabilidadeEstagio(id: string): number {
  return ESTAGIOS_CRM.find((e) => e.id === id)?.probabilidade ?? 0;
}

/**
 * Twenty↔Harvest stage. VERIFICADO em 03/09/2026 contra o workspace real via
 * MCP: o enum de `Opportunity.stage` no Twenty é NEW/SCREENING/MEETING/
 * PROPOSAL/CUSTOMER (5 valores) — sem equivalente a "perdido". Os 4 estágios
 * de fechamento negativo do Harvest (sem_interesse/optout/invalido/perdido)
 * não têm alvo no Twenty; mapeiam para NEW.
 * ponytail: perda de granularidade nos estágios de "fechado sem sucesso" ao
 * sincronizar com o Twenty — se isso importar, criar um Select customizado
 * "Motivo de perda" no workspace e mapear aqui.
 */
export const ESTAGIO_PARA_TWENTY_STAGE: Record<string, string> = {
  novo: 'NEW',
  contatado: 'NEW',
  respondeu: 'NEW',
  qualificando: 'SCREENING',
  reuniao: 'MEETING',
  proposta: 'PROPOSAL',
  ganho: 'CUSTOMER',
  sem_interesse: 'NEW',
  optout: 'NEW',
  invalido: 'NEW',
  perdido: 'NEW',
};

const TWENTY_STAGE_PARA_ESTAGIO: Record<string, string> = {
  NEW: 'novo',
  SCREENING: 'qualificando',
  MEETING: 'reuniao',
  PROPOSAL: 'proposta',
  CUSTOMER: 'ganho',
};

export function twentyStageParaEstagio(stage: string | null | undefined): string {
  return (stage && TWENTY_STAGE_PARA_ESTAGIO[stage]) || ESTAGIO_PADRAO;
}

export function estagioParaTwentyStage(id: string): string {
  return ESTAGIO_PARA_TWENTY_STAGE[id] ?? 'NEW';
}
