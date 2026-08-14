/**
 * Normalização canônica de telefone — só dígitos, com DDI 55.
 *
 * Fase 3A: extraída para cá porque a mesma lógica já existia duplicada em
 * `api/busca/route.ts` e em `componentes/Prospeccao.tsx` (inline, cada uma
 * com seu próprio `normalizarTelefone`/`normalizar`). As proteções novas
 * (supressão, histórico de contato) precisam de UMA fonte de verdade, senão
 * "5511999990000" e "011999990000" viram dois contatos diferentes e a
 * supressão vaza. As duas cópias antigas não foram tocadas nesta fase — só
 * o código novo (lib/supressao.ts, lib/historicoContato.ts, disparo/route.ts)
 * usa esta função.
 */
export function normalizarTelefone(bruto?: string | null): string | null {
  if (!bruto) return null;
  let d = String(bruto).replace(/\D/g, '');
  if (d.length < 10) return null;
  if (!d.startsWith('55')) d = '55' + d;
  // Falha fechada contra identificadores que não são telefone (ex.: WhatsApp
  // LID — Linked ID opaco, 14-15 dígitos — vazando para cá por engano em
  // algum adapter). Telefone BR com DDI: 55 + DDD(2) + número(8 ou 9) = 12
  // ou 13 dígitos. Acima disso não é um telefone plausível — descarta em vez
  // de gravar lixo (bug real encontrado e corrigido em 2026-08-13, ver
  // lib/inboundWaha.ts).
  if (d.length > 13) return null;
  return d;
}
