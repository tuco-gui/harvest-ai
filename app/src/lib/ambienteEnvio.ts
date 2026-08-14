/**
 * Guarda de segurança "fail-closed" para staging (Entrega 15 / Fase de
 * evolução — STAGING). Objetivo: mesmo que alguém configure secrets de
 * staging errados (ex.: aponte staging para o WAHA de produção), NENHUMA
 * mensagem sai para um número real de terceiro nesse ambiente.
 *
 * Regra: se WHATSAPP_MODE=test, todo disparo só é permitido se o telefone
 * (E.164, só dígitos) estiver na whitelist WHATSAPP_QA_WHITELIST (lista
 * separada por vírgula). Fora da whitelist → bloqueado, sem exceção.
 *
 * Em produção (WHATSAPP_MODE ausente ou != 'test') esta função sempre
 * libera — não altera nenhum comportamento de produção.
 */
export function envioPermitidoNoAmbiente(telefone: string): { ok: true } | { ok: false; motivo: string } {
  const modo = (process.env.WHATSAPP_MODE ?? '').trim().toLowerCase();
  if (modo !== 'test') return { ok: true };

  const bruta = process.env.WHATSAPP_QA_WHITELIST ?? '';
  const whitelist = new Set(
    bruta.split(',').map((n) => n.replace(/\D/g, '')).filter(Boolean),
  );
  const digitos = telefone.replace(/\D/g, '');

  if (whitelist.has(digitos)) return { ok: true };
  return {
    ok: false,
    motivo: 'WHATSAPP_MODE=test: este ambiente só pode enviar para números da whitelist de QA (WHATSAPP_QA_WHITELIST).',
  };
}

/** True quando este deploy está rodando em modo de teste (staging). */
export function ehAmbienteDeTeste(): boolean {
  return (process.env.WHATSAPP_MODE ?? '').trim().toLowerCase() === 'test';
}
