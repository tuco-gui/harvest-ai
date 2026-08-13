import { normalizarTelefone } from './telefone';
import type { EventoInboundNormalizado, TipoMensagemInbound } from './inboundTipos';

/**
 * Adapter Evolution (Fase 3B) — converte o payload de webhook da Evolution
 * API para o MESMO evento normalizado interno do adapter WAHA. Formato de
 * referência: `{ event: "messages.upsert", instance, data: { key: { id,
 * fromMe, remoteJid }, pushName, message: { conversation | extendedTextMessage
 * | imageMessage | ... }, messageType, messageTimestamp } }`. NÃO VERIFICADO
 * contra um webhook real desta instância — baseado na documentação pública
 * da Evolution API e em issues do repositório oficial. Antes de cadastrar o
 * webhook real em produção, capturar 1 payload real e conferir os nomes de
 * campo aqui.
 */
export type PayloadWebhookEvolution = {
  event?: string;
  instance?: string;
  data?: {
    key?: { id?: string; fromMe?: boolean; remoteJid?: string };
    pushName?: string;
    messageTimestamp?: number;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string };
      videoMessage?: { caption?: string };
      [chave: string]: unknown;
    };
  };
};

const CHAVES_MIDIA = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'];

function extrairTexto(msg: NonNullable<NonNullable<PayloadWebhookEvolution['data']>['message']>): string | null {
  if (typeof msg.conversation === 'string' && msg.conversation.length > 0) return msg.conversation;
  if (typeof msg.extendedTextMessage?.text === 'string' && msg.extendedTextMessage.text.length > 0) return msg.extendedTextMessage.text;
  return null;
}

function tipoMensagem(msg: NonNullable<NonNullable<PayloadWebhookEvolution['data']>['message']>): TipoMensagemInbound {
  if (extrairTexto(msg)) return 'texto';
  if (CHAVES_MIDIA.some((chave) => chave in msg)) return 'midia';
  return 'outro';
}

function timestampIso(bruto: number | undefined): string {
  if (typeof bruto !== 'number' || !Number.isFinite(bruto)) return new Date().toISOString();
  const ms = bruto > 2_000_000_000 ? bruto : bruto * 1000; // mesmo raciocínio do adapter WAHA
  return new Date(ms).toISOString();
}

/**
 * null = evento ignorado de propósito: não é `messages.upsert` (é
 * connection.update, qrcode.updated etc.), é mensagem de grupo (`@g.us` —
 * fora de escopo desta fase), ou está incompleto demais para processar com
 * segurança (sem id ou sem telefone válido).
 */
export function normalizarEventoEvolution(body: PayloadWebhookEvolution): EventoInboundNormalizado | null {
  if (body?.event !== 'messages.upsert') return null;
  const d = body.data;
  const key = d?.key;
  if (!d || !key) return null;

  const jid = String(key.remoteJid ?? '');
  if (!jid || jid.endsWith('@g.us')) return null; // mensagem de grupo — fora de escopo 3B

  const telefone = normalizarTelefone(jid.split('@')[0]);
  if (!telefone) return null;

  const messageIdExterno = key.id ? String(key.id) : null;
  if (!messageIdExterno) return null;

  const msg = d.message ?? {};

  return {
    provider: 'evolution',
    telefone,
    mensagem: extrairTexto(msg),
    messageIdExterno,
    timestamp: timestampIso(d.messageTimestamp),
    nomeContato: d.pushName ?? null,
    tipoMensagem: tipoMensagem(msg),
    fromMe: key.fromMe === true,
    payloadBruto: body,
  };
}

/** Nome da instância do evento — usado só para resolução de conta (lib/inboundConta.ts), não faz parte do evento normalizado. */
export function instanciaDoWebhookEvolution(body: PayloadWebhookEvolution): string | null {
  return body?.instance ?? null;
}
