/**
 * Client do WAHA (WhatsApp HTTP API), engine NOWEB — TRANSPORTE WhatsApp.
 *
 * WAHA é apenas transporte: envia e recebe mensagens WhatsApp. A fonte de
 * verdade de conversas/inboxes é o Chatwoot. O webhook do WAHA alimenta
 * inbound_eventos (contexto Harvest), não substitui o Chatwoot.
 *
 * Infra compartilhada do Harvest — WAHA_API_URL/WAHA_API_KEY são env do
 * servidor, nunca por conta. Cada canal ganha uma sessão própria.
 */

export type WahaStatus = {
  status: string;
  me?: { id: string; pushName?: string } | null;
};

export function wahaSessionName(contaId: string, canalId?: number): string {
  const tenant = contaId.replace(/[^a-zA-Z0-9]/g, '');
  return canalId == null ? `conta_${tenant}` : `harvest_${tenant}_c${canalId}`;
}

/** Número conectado (E.164 sem '+', ex.: 5511951783049) ou null. */
export async function getNumeroConectado(sessionName: string): Promise<string | null> {
  const st = await getStatus(sessionName);
  const me = st?.me?.id; // formato WAHA: "5511951783049@c.us" ou similar
  if (!me) return null;
  const limpo = me.replace(/@.*$/, '').replace(/\D/g, '');
  return limpo || null;
}

/**
 * Única fonte de verdade sobre qual provedor de WhatsApp a conta usa.
 * Nunca infira pelo que está configurado/conectado — sempre leia esta coluna.
 */
export function usaWaha(cred: { whatsapp_provider?: string | null } | null | undefined): boolean {
  return cred?.whatsapp_provider === 'waha';
}

function base() {
  return (process.env.WAHA_API_URL ?? '').replace(/\/+$/, '');
}

function headers() {
  return { 'Content-Type': 'application/json', 'X-Api-Key': process.env.WAHA_API_KEY ?? '' };
}

/**
 * URL do webhook inbound do Harvest — WAHA envia mensagens recebidas para cá.
 * Em produção: https://harvest.figueiramarketing.com.br/api/webhook/waha
 * Sobrescreva com WAHA_WEBHOOK_URL se o domínio for diferente.
 */
function webhookUrl(): string {
  return (process.env.WAHA_WEBHOOK_URL ?? '').replace(/\/+$/, '')
    || 'https://harvest.figueiramarketing.com.br/api/webhook/waha';
}

/**
 * Chave HMAC compartilhada entre WAHA e Harvest. WAHA assina o corpo cru
 * com HMAC-SHA512; Harvest verifica em lib/inboundSeguranca.ts.
 * MESMA chave que em WAHA_WEBHOOK_HMAC_KEY (usada pelo Harvest para verificação).
 */
function webhookHmacKey(): string | null {
  return process.env.WAHA_WEBHOOK_HMAC_KEY || null;
}

export async function getStatus(sessionName: string): Promise<WahaStatus | null> {
  const r = await fetch(`${base()}/api/sessions/${sessionName}`, {
    headers: headers(),
    signal: AbortSignal.timeout(20_000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`WAHA respondeu ${r.status}`);
  return r.json();
}

/**
 * Garante que a sessão existe, está iniciada e com webhook registrado.
 * Cria com engine NOWEB se ainda não existir. Registra o webhook
 * (URL + HMAC) para que mensagens recebidas sejam entregues ao Harvest.
 */
export async function getOrCreateSession(sessionName: string): Promise<WahaStatus> {
  let precisavaCriar = false;
  let atual = await getStatus(sessionName);
  if (!atual) {
    const criado = await fetch(`${base()}/api/sessions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: sessionName, config: { engine: { engine: 'NOWEB' } } }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!criado || !criado.ok) {
      return { status: 'ERRO' };
    }
    precisavaCriar = true;
    atual = await getStatus(sessionName);
  }
  if (atual?.status === 'STOPPED' || atual?.status === 'FAILED') {
    await fetch(`${base()}/api/sessions/${sessionName}/start`, {
      method: 'POST',
      headers: headers(),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {});
    atual = await getStatus(sessionName);
    precisavaCriar = true; // start também pode precisar de webhook
  }

  // Sempre garante que o webhook está registrado — tanto na criação quanto
  // em sessões existentes que podem ter perdido a configuração.
  // Custo: 1 PUT/POST por chamada que encontra a sessão WORKING. Em
  // produção, a rota de disparo chama getOrCreateSession uma vez por
  // mensagem; para evitar overhead, o webhook SÓ é registrado quando a
  // sessão acaba de ser criada/iniciada (precisavaCriar) OU quando a
  // sessão já existe mas não tem webhook configurado (verificado em
  // /api/waha/webhook — diagnóstico sob demanda, não em loop).
  if (precisavaCriar && atual?.status === 'WORKING') {
    await registrarWebhookWaha(sessionName).catch(() => {});
  }

  return atual ?? { status: 'STOPPED' };
}

/**
 * Registra o webhook inbound na sessão WAHA — camada de TRANSPORTE.
 * Sem esta chamada, o WAHA recebe mensagens mas não tem para onde enviar.
 * O webhook alimenta inbound_eventos (contexto Harvest). A fonte de
 * verdade de conversas continua sendo o Chatwoot.
 *
 * Retorna true se o webhook foi registrado com sucesso.
 */
export async function registrarWebhookWaha(sessionName: string): Promise<boolean> {
  const hmacKey = webhookHmacKey();
  if (!hmacKey) {
    console.error(`[waha] WAHA_WEBHOOK_HMAC_KEY não configurado — não é possível registrar webhook para ${sessionName}`);
    return false;
  }
  const url = webhookUrl();
  if (!url) {
    console.error(`[waha] WAHA_WEBHOOK_URL não configurado — não é possível registrar webhook para ${sessionName}`);
    return false;
  }

  const body = {
    url,
    events: ['message', 'message.any'],
    hmac: { key: hmacKey },
  };

  // Tenta PUT primeiro (atualiza webhook existente); se 404, cria com POST.
  try {
    const put = await fetch(`${base()}/api/sessions/${sessionName}/webhook`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (put.ok) return true;
    if (put.status !== 404) {
      console.error(`[waha] PUT webhook ${sessionName} retornou ${put.status}`);
      return false;
    }
  } catch {
    // PUT falhou — tenta POST
  }

  try {
    const post = await fetch(`${base()}/api/sessions/${sessionName}/webhook`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (post.ok) return true;
    console.error(`[waha] POST webhook ${sessionName} retornou ${post.status}`);
    return false;
  } catch (e) {
    console.error(`[waha] Falha ao registrar webhook ${sessionName}:`, e);
    return false;
  }
}

/**
 * Verifica se o webhook está registrado e correto na sessão WAHA.
 * Usado pelo diagnóstico (GET /api/waha/webhook) e pelo health check.
 */
export async function verificarWebhookWaha(sessionName: string): Promise<{
  registrado: boolean;
  url?: string;
  events?: string[];
  erro?: string;
}> {
  try {
    const r = await fetch(`${base()}/api/sessions/${sessionName}/webhook`, {
      headers: headers(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return { registrado: false, erro: `HTTP ${r.status}` };
    const d = await r.json();
    const url = d?.url ?? d?.webhookUrl ?? null;
    const events = d?.events ?? null;
    const hmacConfigurado = !!(d?.hmac?.key || d?.hmacKey);
    return {
      registrado: !!url && hmacConfigurado,
      url: url ?? undefined,
      events: events ?? undefined,
    };
  } catch (e) {
    return { registrado: false, erro: e instanceof Error ? e.message : 'Falha desconhecida' };
  }
}

/** QR em data URI, ou null se a sessão não estiver esperando pareamento. */
export async function getQrCode(sessionName: string): Promise<string | null> {
  try {
    const r = await fetch(`${base()}/api/${sessionName}/auth/qr`, {
      headers: headers(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Desconecta e apaga a sessão — próxima chamada a getOrCreateSession recria do zero. */
export async function logoutSession(sessionName: string): Promise<void> {
  await fetch(`${base()}/api/${sessionName}/logout`, {
    method: 'POST', headers: headers(), signal: AbortSignal.timeout(20_000),
  }).catch(() => {});
  await fetch(`${base()}/api/sessions/${sessionName}`, {
    method: 'DELETE', headers: headers(), signal: AbortSignal.timeout(20_000),
  }).catch(() => {});
}

function chatId(numero: string) {
  return `${numero.replace(/\D/g, '')}@c.us`;
}

export async function sendText(sessionName: string, numero: string, texto: string): Promise<boolean> {
  try {
    const r = await fetch(`${base()}/api/sendText`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ session: sessionName, chatId: chatId(numero), text: texto }),
      signal: AbortSignal.timeout(30_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const CHECK_LOTE = 5; // ponytail: instância WAHA roda em 1 CPU/1GB, não aguenta 1 req por lead em paralelo

/**
 * Consulta em lotes de CHECK_LOTE números por vez. Quando o check de um
 * número falha (rede, timeout, resposta não-ok), a chave dele fica AUSENTE
 * do resultado — nunca `false` — porque `false` significa "WAHA confirmou
 * que não tem WhatsApp", e isso é bem diferente de "não consegui checar".
 */
export async function checkNumbers(sessionName: string, numeros: string[]): Promise<Record<string, boolean>> {
  const resultado: Record<string, boolean> = {};
  for (let i = 0; i < numeros.length; i += CHECK_LOTE) {
    const lote = numeros.slice(i, i + CHECK_LOTE);
    await Promise.all(lote.map(async (numero) => {
      try {
        const r = await fetch(
          `${base()}/api/contacts/check-exists?session=${sessionName}&phone=${numero.replace(/\D/g, '')}`,
          { headers: headers(), signal: AbortSignal.timeout(20_000) },
        );
        if (!r.ok) return; // falha do check: omite a chave
        const d = await r.json();
        resultado[numero] = d?.numberExists === true;
      } catch {
        // idem: omite a chave, não confunde com "confirmado sem WhatsApp"
      }
    }));
  }
  return resultado;
}
