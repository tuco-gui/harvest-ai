/**
 * Utilitários do CRM Harvest inspirados no fluxo Tarefas do DeskcommCRM.
 * Estendem crm_atividades: não substituem Twenty, Chatwoot, WAHA ou dados.
 */
export type TarefaCrm = {
  id: number;
  oportunidade_id: number;
  titulo: string;
  descricao: string | null;
  concluida: boolean;
  vence_em: string | null;
  criado_em: string;
  empresa: string;
  contato: string;
  owner_id: string | null;
  responsavel_nome: string;
};

export type FiltroTarefa = 'abertas' | 'atrasadas' | 'hoje' | 'proximas' | 'concluidas' | 'todas';

export function prazoLocal(iso: string | null): Date | null {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function classificarPrazo(iso: string | null, concluida: boolean, agora = new Date()):
  'concluida' | 'atrasada' | 'hoje' | 'proxima' | 'sem_prazo' {
  if (concluida) return 'concluida';
  const d = prazoLocal(iso);
  if (!d) return 'sem_prazo';
  if (d.getTime() < agora.getTime()) return 'atrasada';
  if (d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() &&
      d.getDate() === agora.getDate()) return 'hoje';
  return 'proxima';
}

export function filtrarTarefas(
  tarefas: TarefaCrm[], filtro: FiltroTarefa, texto: string, owner: string, agora = new Date(),
): TarefaCrm[] {
  const q = texto.trim().toLocaleLowerCase('pt-BR');
  return tarefas
    .filter(t => {
      if (owner && t.owner_id !== owner) return false;
      if (q && ![t.titulo, t.descricao ?? '', t.empresa, t.contato]
        .some(v => v.toLocaleLowerCase('pt-BR').includes(q))) return false;
      const prazo = classificarPrazo(t.vence_em, t.concluida, agora);
      if (filtro === 'abertas') return !t.concluida;
      if (filtro === 'concluidas') return t.concluida;
      if (filtro === 'atrasadas') return prazo === 'atrasada';
      if (filtro === 'hoje') return prazo === 'hoje';
      if (filtro === 'proximas') return prazo === 'proxima';
      return true;
    })
    .sort((a, b) => {
      if (a.concluida !== b.concluida) return Number(a.concluida) - Number(b.concluida);
      return (prazoLocal(a.vence_em)?.getTime() ?? Number.MAX_SAFE_INTEGER)
        - (prazoLocal(b.vence_em)?.getTime() ?? Number.MAX_SAFE_INTEGER);
    });
}

export function validarNovaTarefa(titulo: unknown, venceEm: unknown, descricao: unknown): string | null {
  if (typeof titulo !== 'string' || titulo.trim().length < 3 || titulo.trim().length > 180) {
    return 'O título deve ter entre 3 e 180 caracteres.';
  }
  if (descricao != null && (typeof descricao !== 'string' || descricao.length > 2000)) {
    return 'A descrição não pode ultrapassar 2.000 caracteres.';
  }
  if (venceEm != null && venceEm !== '' && (typeof venceEm !== 'string' ||
      Number.isNaN(Date.parse(venceEm)))) {
    return 'Informe uma data e hora válidas.';
  }
  return null;
}
