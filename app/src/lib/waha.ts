/**
 * Client do WAHA (WhatsApp HTTP API), engine NOWEB. Infra compartilhada do
 * Harvest — WAHA_API_URL/WAHA_API_KEY são env do servidor, nunca por conta.
 * Cada conta ganha uma sessão nomeada deterministicamente a partir do
 * conta_id, nunca gravada em lugar nenhum.
 */

export type WahaStatus = {
  status: string;
  me?: { id: string; pushName?: string } | null;
};

export function wahaSessionName(contaId: string): string {
  return `conta_${contaId.replace(/-/g, '')}`;
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

async function getStatus(sessionName: string): Promise<WahaStatus | null> {
  const r = await fetch(`${base()}/api/sessions/${sessionName}`, {
    headers: headers(),
    signal: AbortSignal.timeout(20_000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`WAHA respondeu ${r.status}`);
  return r.json();
}

/** Garante que a sessão existe e está iniciada. Cria com engine NOWEB se ainda não existir. */
export async function getOrCreateSession(sessionName: string): Promise<WahaStatus> {
  let atual = await getStatus(sessionName);
  if (!atual) {
    const criado = await fetch(`${base()}/api/sessions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: sessionName, config: { engine: { engine: 'NOWEB' } } }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!criado || !criado.ok) {
      // A criação em si falhou — não adianta devolver STOPPED, porque o
      // chamador (poll do front) trataria isso como "ainda inicializando" e
      // ficaria recriando a sessão para sempre. ERRO é status terminal.
      return { status: 'ERRO' };
    }
    atual = await getStatus(sessionName);
  }
  if (atual?.status === 'STOPPED' || atual?.status === 'FAILED') {
    await fetch(`${base()}/api/sessions/${sessionName}/start`, {
      method: 'POST',
      headers: headers(),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {});
    atual = await getStatus(sessionName);
  }
  return atual ?? { status: 'STOPPED' };
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
