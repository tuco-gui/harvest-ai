/**
 * Adapter de Chatwoot (P0, plano HAI-002 Seção 2).
 *
 * Camada isolada — NÃO está ligada a rotas/UI nesta rodada. Chatwoot é a
 * fonte de verdade de conversas/inbox (ADR conforme brief HAI-002); WAHA/
 * Evolution seguem como transporte WhatsApp, e o Harvest consome Chatwoot
 * via este arquivo quando essa integração for ativada.
 *
 * Envs (nomes apenas — nenhum valor real é lido/gravado neste código):
 *  - CHATWOOT_API_URL: base da instância (ex.: https://chatwoot.exemplo.com)
 *  - CHATWOOT_API_TOKEN: api_access_token (agent/admin), header
 *    `api_access_token` (formato confirmado na doc oficial do Chatwoot —
 *    Platform/Application API usa Bearer, mas a Client/Agent API usada aqui
 *    usa o header customizado `api_access_token`).
 *
 * account_id é passado por chamada (multi-tenant — Seção 3), não fixo em
 * env, já que cada conta Harvest pode apontar para um account_id Chatwoot
 * diferente.
 */

const CHATWOOT_TIMEOUT_MS = 10_000;

export type ChatwootInbox = { id: number; name: string; channel_type?: string };
export type ChatwootAgent = { id: number; name: string; email?: string };
export type ChatwootTeam = { id: number; name: string };
export type ChatwootContact = { id: number; name?: string; phone_number?: string | null; email?: string | null };
export type ChatwootConversation = {
  id: number;
  inbox_id: number;
  status: 'open' | 'resolved' | 'pending' | 'snoozed';
  contact_id?: number;
};
export type ChatwootMessage = {
  id: number;
  content: string | null;
  message_type: number;
  created_at: number;
  sender?: { id: number; name?: string };
};

function baseUrl(): string {
  const url = process.env.CHATWOOT_API_URL;
  if (!url) throw new Error('Chatwoot: falta CHATWOOT_API_URL.');
  return url.replace(/\/$/, '');
}

function headers(): HeadersInit {
  const token = process.env.CHATWOOT_API_TOKEN;
  if (!token) throw new Error('Chatwoot: falta CHATWOOT_API_TOKEN.');
  return { api_access_token: token, 'Content-Type': 'application/json' };
}

/** fetch com timeout + tratamento uniforme de erro, mesmo padrão do twenty.ts. */
async function request(path: string, init: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHATWOOT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { ...headers(), ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`Chatwoot: timeout (${CHATWOOT_TIMEOUT_MS}ms) em ${path}.`);
    throw new Error(`Chatwoot: falha de rede em ${path}: ${err?.message ?? err}`);
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Chatwoot: não autorizado (${res.status}) — verifique CHATWOOT_API_TOKEN.`);
  }
  if (res.status === 429) throw new Error('Chatwoot: rate limit excedido (429).');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Chatwoot: erro HTTP ${res.status} em ${path}.`);
  if (res.status === 204) return {};
  try {
    return await res.json();
  } catch {
    throw new Error(`Chatwoot: resposta inválida (não-JSON) em ${path}.`);
  }
}

export async function listarInboxes(accountId: number): Promise<ChatwootInbox[]> {
  const json = await request(`/api/v1/accounts/${accountId}/inboxes`);
  return json?.payload ?? [];
}

export async function listarConversas(
  accountId: number,
  filtros?: { inboxId?: number; status?: ChatwootConversation['status'] }
): Promise<ChatwootConversation[]> {
  const params = new URLSearchParams();
  if (filtros?.inboxId) params.set('inbox_id', String(filtros.inboxId));
  if (filtros?.status) params.set('status', filtros.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const json = await request(`/api/v1/accounts/${accountId}/conversations${qs}`);
  return json?.data?.payload ?? [];
}

export async function buscarConversa(accountId: number, conversationId: number): Promise<ChatwootConversation | null> {
  const json = await request(`/api/v1/accounts/${accountId}/conversations/${conversationId}`);
  return json ?? null;
}

export async function listarMensagens(accountId: number, conversationId: number): Promise<ChatwootMessage[]> {
  const json = await request(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`);
  return json?.payload ?? [];
}

/** Busca contato por telefone (E.164); cria se não existir. Telefone é chave secundária/display, não usada como match primário fora deste adapter. */
export async function encontrarOuCriarContato(
  accountId: number,
  input: { nome: string; telefone?: string | null; email?: string | null; inboxId?: number }
): Promise<ChatwootContact> {
  if (input.telefone) {
    const busca = await request(
      `/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(input.telefone)}`
    );
    const existente: ChatwootContact | undefined = busca?.payload?.[0];
    if (existente) return existente;
  }
  const payload: Record<string, unknown> = { name: input.nome };
  if (input.telefone) payload.phone_number = input.telefone;
  if (input.email) payload.email = input.email;
  if (input.inboxId) payload.inbox_id = input.inboxId;
  const criado = await request(`/api/v1/accounts/${accountId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return criado?.payload?.contact ?? criado;
}

/**
 * Envia mensagem numa conversa. NÃO USADO nesta rodada (envio real de
 * WhatsApp segue proibido pela Seção 9 do brief) — implementado apenas
 * como parte do adapter, coberto por teste com fetch mockado.
 */
export async function enviarMensagem(
  accountId: number,
  conversationId: number,
  conteudo: string,
  tipo: 'outgoing' | 'incoming' = 'outgoing'
): Promise<ChatwootMessage> {
  const json = await request(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: conteudo, message_type: tipo }),
  });
  return json;
}

export async function listarAgentes(accountId: number): Promise<ChatwootAgent[]> {
  const json = await request(`/api/v1/accounts/${accountId}/agents`);
  return json ?? [];
}

export async function listarTimes(accountId: number): Promise<ChatwootTeam[]> {
  const json = await request(`/api/v1/accounts/${accountId}/teams`);
  return json ?? [];
}

export async function alterarStatusConversa(
  accountId: number,
  conversationId: number,
  status: ChatwootConversation['status']
): Promise<void> {
  await request(`/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function atribuirAgente(accountId: number, conversationId: number, agentId: number | null): Promise<void> {
  await request(`/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ assignee_id: agentId }),
  });
}

export async function atribuirTime(accountId: number, conversationId: number, teamId: number | null): Promise<void> {
  await request(`/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ team_id: teamId }),
  });
}
