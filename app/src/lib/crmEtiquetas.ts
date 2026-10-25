/** Paleta compacta inspirada na UX do DeskcommCRM; nome + cor são acessíveis. */
export const PALETA_ETIQUETAS = [
  { cor: '#C0392B', nome: 'Vermelho' },
  { cor: '#D97706', nome: 'Âmbar' },
  { cor: '#CA8A04', nome: 'Amarelo' },
  { cor: '#15803D', nome: 'Verde' },
  { cor: '#0F766E', nome: 'Turquesa' },
  { cor: '#2563EB', nome: 'Azul' },
  { cor: '#7C3AED', nome: 'Roxo' },
  { cor: '#64748B', nome: 'Cinza' },
] as const;
export type EtiquetaCRM = { nome: string; cor: string | null };
export const PRIORIDADES = ['baixa','normal','alta','urgente'] as const;
export type Prioridade = typeof PRIORIDADES[number];
export const MINUTOS_TRIAGEM: Record<Prioridade, number> = {
  baixa: 1440, normal: 240, alta: 60, urgente: 15,
};
export const NOMES_PRIORIDADE: Record<Prioridade, string> = {
  baixa:'Baixa', normal:'Normal', alta:'Alta', urgente:'Urgente',
};
export function nomeEtiqueta(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const n = v.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
  if (n.length < 1 || n.length > 28 || /[<>\r\n]/.test(n)) return null;
  return n;
}
export function corEtiqueta(v: unknown): string | null | undefined {
  if (v === null || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const c = v.trim().toUpperCase();
  return PALETA_ETIQUETAS.some(t => t.cor.toUpperCase() === c) ? c : undefined;
}
export function prioridadeValida(p: unknown): p is Prioridade {
  return typeof p === 'string' && PRIORIDADES.includes(p as Prioridade);
}
export function prazoTriagem(ultimaRecebida: string, prioridade: Prioridade) {
  const m = Date.parse(ultimaRecebida);
  if (!Number.isFinite(m)) return null;
  return new Date(m + MINUTOS_TRIAGEM[prioridade] * 60000).toISOString();
}
export function estadoSla(prazo: string | null, status: string, agora = Date.now()) {
  if (status === 'resolvido') return 'concluido' as const;
  if (!prazo) return 'sem_prazo' as const;
  const t = Date.parse(prazo);
  if (!Number.isFinite(t)) return 'sem_prazo' as const;
  return t < agora ? 'vencido' as const : t - agora <= 15 * 60000 ? 'em_risco' as const : 'no_prazo' as const;
}
export function atualizarSelecao(atual: string[], alterar: string[], acao: 'incluir'|'remover') {
  const set = new Set(atual);
  for(const n of alterar) { if (acao === 'incluir') set.add(n); else set.delete(n); }
  return [...set].slice(0, 8);
}
