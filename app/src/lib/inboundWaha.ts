import { normalizarTelefone } from './telefone';
import type { EventoInboundNormalizado, TipoMensagemInbound } from './inboundTipos';

/**
 * Adapter WAHA (Fase 3B) — converte o payload de webhook do WAHA para o
 * evento normalizado interno. Formato de referência (WAHA — engine NOWEB):
 * `{ event, session, engine, payload: { id, timestamp, from, fromMe, to,
 * body, hasMedia, notifyName, _data } }`. NÃO VERIFICADO contra um webhook
 * real desta instância — baseado na documentação pública do WAHA
 * (waha.devlike.pro/docs/how-to/receive-messages, /how-to/event-message).
 * Antes de cadastrar o webhook real em produção, capturar 1 payload real e
 * conferir os nomes de campo aqui.
 */
export type PayloadWebhookWaha = {
  event?: string;
  session?: string;
  payload?: {
    id?: string;
    timestamp?: number;
    from?: string;
    fromMe?: boolean;
    body?: string;
    hasMedia?: boolean;
    notifyName?: string;
    _data?: { notifyName?: string };
  };
};

const EVENTOS_MENSAGEM = new Set(['message', 'message.any']);

function tipoMensagem(p: NonNullable<PayloadWebhookWaha['payload']>): TipoMensagemInbound {
  if (p.hasMedia) return 'midia';
  if (typeof p.body === 'string' && p.body.length > 0) return 'texto';
  return 'outro';
}

function timestampIso(bruto: number | undefined): string {
  if (typeof bruto !== 'number' || !Number.isFinite(bruto)) return new Date().toISOString();
  // WAHA manda epoch em segundos; alguns eventos já vêm em ms — > 2e9 só é
  // possível em segundos depois do ano 2033, então acima disso já é ms.
  const ms = bruto > 2_000_000_000 ? bruto : bruto * 1000;
  return new Date(ms).toISOString();
}

/**
 * null = evento ignorado de propósito: não é mensagem (ack, state.change,
 * group.join...), é de grupo (`@g.us` — fora de escopo desta fase, não há
 * um único lead/telefone para correlacionar), ou está incompleto demais
 * para processar com segurança (sem id ou sem telefone válido).
 */
export function normalizarEventoWaha(body: PayloadWebhookWaha): EventoInboundNormalizado | null {
  if (!body?.event || !EVENTOS_MENSAGEM.has(body.event)) return null;
  const p = body.payload;
  if (!p) return null;

  const jid = String(p.from ?? '');
  if (!jid || jid.endsWith('@g.us')) return null; // mensagem de grupo — fora de escopo 3B

  const telefone = normalizarTelefone(jid.split('@')[0]);
  if (!telefone) return null;

  const messageIdExterno = p.id ? String(p.id) : null;
  if (!messageIdExterno) return null;

  return {
    provider: 'waha',
    telefone,
    mensagem: typeof p.body === 'string' && p.body.length > 0 ? p.body : null,
    messageIdExterno,
    timestamp: timestampIso(p.timestamp),
    nomeContato: p.notifyName ?? p._data?.notifyName ?? null,
    tipoMensagem: tipoMensagem(p),
    fromMe: p.fromMe === true,
    payloadBruto: body,
  };
}

/** Nome de sessão do evento — usado só para resolução de conta (lib/inboundConta.ts), não faz parte do evento normalizado. */
export function sessionDoWebhookWaha(body: PayloadWebhookWaha): string | null {
  return body?.session ?? null;
}
