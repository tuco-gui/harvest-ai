/**
 * Formatação de data/hora hydration-safe.
 *
 * Bug que isso corrige: `new Date(iso).toLocaleString('pt-BR')` sem
 * `timeZone` explícito usa o fuso horário PADRÃO DO RUNTIME — que no
 * servidor (container Docker, normalmente UTC) é diferente do fuso do
 * navegador de quem está usando o Harvest (America/Sao_Paulo). Isso faz o
 * SSR gerar um texto e a hidratação no cliente gerar outro, disparando
 * "Minified React error #418" (mismatch de conteúdo de texto).
 *
 * Fixando o `timeZone` explicitamente, servidor e cliente sempre calculam
 * exatamente o mesmo texto, não importa em que fuso a máquina de cada um
 * esteja rodando.
 */
const FUSO_HORARIO_NEGOCIO = 'America/Sao_Paulo';

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO_HORARIO_NEGOCIO });
}
