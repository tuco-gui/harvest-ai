/**
 * Modelo normalizado de evento inbound (Fase 3B) — formato interno único
 * que o restante do Harvest consome, independente de o evento ter vindo do
 * WAHA ou da Evolution. Os adapters (lib/inboundWaha.ts, lib/inboundEvolution.ts)
 * são os únicos lugares que conhecem o formato específico de cada provider;
 * a partir daqui (resolução de conta, idempotência, vínculo com lead/histórico)
 * a lógica é uma só.
 */

export type ProviderInbound = 'waha' | 'evolution';

export type TipoMensagemInbound = 'texto' | 'midia' | 'outro';

export type EventoInboundNormalizado = {
  /** De qual provider veio — nunca inferido, sempre da rota que recebeu o webhook. */
  provider: ProviderInbound;
  /** Telefone normalizado (lib/telefone.ts) — chave de correlação com lead/histórico. */
  telefone: string;
  /** Corpo em texto, quando a mensagem for de texto. null para mídia/outros tipos. */
  mensagem: string | null;
  /** Id da mensagem no provider — base da idempotência (provider + este campo). */
  messageIdExterno: string;
  /** ISO 8601. Do provider quando disponível; senão, momento do recebimento. */
  timestamp: string;
  /** Nome/contato exibido pelo WhatsApp, quando o provider mandar. */
  nomeContato: string | null;
  tipoMensagem: TipoMensagemInbound;
  /**
   * true = mensagem enviada pelo próprio Harvest (eco do envio), não uma
   * resposta recebida. Pipeline descarta antes de processar como inbound.
   */
  fromMe: boolean;
  /** Payload original do provider, guardado como referência/auditoria — nunca usado para decisão de negócio. */
  payloadBruto: unknown;
};

/**
 * Resultado da resolução de conta + lead/campanha, calculado DEPOIS da
 * normalização — nunca a partir de um conta_id que o provider tenha mandado
 * (o provider não é confiável para isso; ver lib/inboundConta.ts).
 */
export type EventoInboundResolvido = EventoInboundNormalizado & {
  contaId: string;
  leadId: number | null;
  campanhaId: number | null;
};
