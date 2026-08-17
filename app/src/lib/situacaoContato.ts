export type SituacaoContato =
  | 'optout'
  | 'respondido'
  | 'bloqueado'
  | 'erro'
  | 'sem_resposta'
  | 'nao_contatado';

/** Resume o histórico cronológico de um lead sem misturar resposta, opt-out e falha. */
export function classificarSituacaoContato(
  statuses: string[],
  suprimido: boolean,
  disparoLegado = false,
): SituacaoContato {
  if (statuses.includes('optout')) return 'optout';
  if (statuses.includes('recebido')) return 'respondido';

  const ultimo = [...statuses].reverse().find((status) =>
    ['enviado', 'erro', 'bloqueado_supressao'].includes(status));
  if (ultimo === 'bloqueado_supressao' || suprimido) return 'bloqueado';
  if (ultimo === 'erro') return 'erro';
  if (ultimo === 'enviado' || disparoLegado) return 'sem_resposta';
  return 'nao_contatado';
}
