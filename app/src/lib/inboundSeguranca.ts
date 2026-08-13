import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Segurança dos webhooks inbound (Fase 3B) — cada provider usa o mecanismo
 * que ele de fato oferece, nada inventado:
 *
 * - WAHA assina o corpo cru (raw bytes) com HMAC-SHA512 quando a sessão é
 *   criada com `config.webhooks[].hmac.key`, mandando o resultado no header
 *   `X-Webhook-Hmac` (+ `X-Webhook-Hmac-Algorithm: sha512`). Fonte: WAHA —
 *   waha.devlike.pro/docs/how-to/security.
 * - Evolution API não documenta assinatura/HMAC nativa para webhooks (só
 *   `enabled`/`url`/`webhookByEvents`/`events`, sem campo de secret — ver
 *   docs.evolution-api.com/docs/04-Webhooks/00-set-webhook). Mitigação:
 *   token compartilhado embutido no PRÓPRIO caminho da URL cadastrada no
 *   provider (`/api/webhook/evolution/<token>`), comparado em tempo
 *   constante — é o padrão usual quando o provider não assina o payload.
 *
 * As duas verificações falham fechado: sem segredo configurado no ambiente,
 * a rota rejeita (não existe "modo inseguro" silencioso em produção).
 */

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type ResultadoAssinaturaWaha =
  | { ok: true }
  | { ok: false; motivo: 'segredo_nao_configurado' | 'header_ausente' | 'assinatura_invalida' };

/**
 * `corpoCru` precisa ser o texto exato recebido (antes de qualquer
 * `JSON.parse`) — HMAC é sobre os bytes crus, não sobre o objeto reparseado.
 */
export function verificarAssinaturaWaha(
  corpoCru: string, headerHmac: string | null,
): ResultadoAssinaturaWaha {
  const chave = process.env.WAHA_WEBHOOK_HMAC_KEY;
  if (!chave) return { ok: false, motivo: 'segredo_nao_configurado' };
  if (!headerHmac) return { ok: false, motivo: 'header_ausente' };

  const esperado = createHmac('sha512', chave).update(corpoCru, 'utf8').digest('hex');
  if (!compararSeguro(headerHmac.toLowerCase(), esperado.toLowerCase())) {
    return { ok: false, motivo: 'assinatura_invalida' };
  }
  return { ok: true };
}

export type ResultadoTokenEvolution =
  | { ok: true }
  | { ok: false; motivo: 'segredo_nao_configurado' | 'token_invalido' };

export function verificarTokenEvolution(tokenRecebido: string | null | undefined): ResultadoTokenEvolution {
  const esperado = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (!esperado) return { ok: false, motivo: 'segredo_nao_configurado' };
  if (!tokenRecebido || !compararSeguro(tokenRecebido, esperado)) {
    return { ok: false, motivo: 'token_invalido' };
  }
  return { ok: true };
}
