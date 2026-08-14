import { normalizarTelefone } from './telefone';
import type { EventoInboundNormalizado, TipoMensagemInbound } from './inboundTipos';

/**
 * Adapter WAHA (Fase 3B) — converte o payload de webhook do WAHA para o
 * evento normalizado interno. Formato VERIFICADO contra payloads reais de
 * produção em 2026-08-13 (8 eventos reais em `inbound_eventos`, incluindo
 * um opt-out real do QA do cliente).
 *
 * BUG CONFIRMADO E CORRIGIDO (2026-08-13): quando o WhatsApp do contato usa
 * "addressing mode" LID (`_data.key.addressingMode === 'lid'` — endereçamento
 * por Linked ID, cada vez mais comum, não é caso raro), `payload.from` vem
 * como `<lid_numerico>@lid`, e o número puro do lid NÃO é o telefone real —
 * é um identificador opaco. O código anterior fazia `from.split('@')[0]` sem
 * checar o `@lid`, gravando o número do lid como se fosse telefone. Isso
 * quebrava: (1) correlação com prospecta_leads (nunca batia); (2) opt-out —
 * a supressão seria aplicada a um "telefone" que não existe, sem bloquear o
 * número real em disparos futuros. WAHA expõe o telefone real em
 * `_data.key.remoteJidAlt` (`<telefone>@s.whatsapp.net`) nesses casos —
 * confirmado com o payload real do evento de opt-out (lead real localizado
 * por esse número). Este adapter agora prefere `remoteJidAlt` quando
 * `addressingMode === 'lid'`.
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
    _data?: {
      notifyName?: string;
      key?: { remoteJid?: string; remoteJidAlt?: string; addressingMode?: string };
    };
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

  const jidBruto = String(p.from ?? '');
  if (!jidBruto || jidBruto.endsWith('@g.us')) return null; // mensagem de grupo — fora de escopo 3B

  // Endereçamento LID: `from` não é telefone. Preferir o JID alternativo
  // baseado em telefone real (`remoteJidAlt`), que o WAHA expõe em
  // `_data.key` quando `addressingMode === 'lid'`. Sem ele, não há telefone
  // real disponível — descarta em vez de gravar um lid como se fosse
  // telefone (ver nota no topo do arquivo).
  const key = p._data?.key;
  const usaLid = jidBruto.endsWith('@lid') || key?.addressingMode === 'lid';
  const jid = usaLid
    ? (key?.remoteJidAlt && key.remoteJidAlt.endsWith('@s.whatsapp.net') ? key.remoteJidAlt : null)
    : jidBruto;
  if (!jid) return null;

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
