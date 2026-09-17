import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { processarEventoInbound } from '@/lib/inbound';
import { jaProcessadoCrossProvider } from '@/lib/dedup';
import { normalizarTelefone } from '@/lib/telefone';

/**
 * Webhook do Chatwoot — recebe eventos de mensagens (message_created).
 *
 * Chatwoot é source of truth de conversas. WAHA é transporte.
 * Este endpoint processa mensagens inbound do Chatwoot e despacha para
 * o pipeline comum (lib/inbound.ts) com provider='chatwoot'.
 *
 * Segurança: valida CHATWOOT_WEBHOOK_TOKEN (token de verificação configurado
 * no Chatwoot webhook settings).
 *
 * Deduplicação: verifica se a mesma mensagem já chegou via WAHA
 * (cross-provider dedup em lib/dedup.ts).
 */

type ChatwootWebhookPayload = {
  event?: string;
  account?: { id?: number };
  conversation?: { id?: number; inbox_id?: number; status?: string };
  message?: {
    id?: number;
    content?: string;
    message_type?: string;
    created_at?: number;
    private?: boolean;
  };
  contact?: { id?: number; name?: string; phone_number?: string; email?: string };
  channel?: { id?: number; name?: string };
};

function validarToken(req: Request): boolean {
  const token = process.env.CHATWOOT_WEBHOOK_TOKEN;
  if (!token) {
    // Sem token configurado — rejeitar tudo (falha fechada)
    console.error('[chatwoot-webhook] CHATWOOT_WEBHOOK_TOKEN não configurado');
    return false;
  }
  const received = req.headers.get('x-webhook-token') ?? '';
  return received === token;
}

function resolverContaId(
  accountId: number | undefined,
): string | null {
  // Por enquanto, mapear account_id Chatwoot → conta_id Harvest
  // FUTURE: usar tabela de mapeamento chatwoot_accounts se multi-tenant
  if (accountId === 1) return 'c8aaa6f0-33d6-46e2-b45f-c40e49e41037'; // Figueira QA
  return null;
}

export async function POST(req: Request) {
  if (!validarToken(req)) {
    return NextResponse.json({ ok: false, erro: 'token inválido' }, { status: 401 });
  }

  let body: ChatwootWebhookPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'payload inválido' }, { status: 400 });
  }

  // Apenas processar message_created de mensagens incoming
  if (body.event !== 'message_created') {
    return NextResponse.json({ ok: true, ignorado: true, motivo: `evento '${body.event}' ignorado` });
  }
  if (body.message?.message_type !== 'incoming') {
    return NextResponse.json({ ok: true, ignorado: true, motivo: `message_type '${body.message?.message_type}' ignorado` });
  }
  if (body.message?.private) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'mensagem privada ignorada' });
  }

  const admin = supabaseAdmin();
  const contaId = resolverContaId(body.account?.id);
  if (!contaId) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'conta não resolvida' });
  }

  const telefone = normalizarTelefone(body.contact?.phone_number ?? '');
  if (!telefone) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'telefone inválido' });
  }

  const messageIdExterno = body.message?.id ? String(body.message.id) : null;
  if (!messageIdExterno) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'message_id ausente' });
  }

  // Deduplicação cross-provider
  const timestamp = body.message?.created_at
    ? new Date(body.message.created_at * 1000).toISOString()
    : new Date().toISOString();

  const duplicado = await jaProcessadoCrossProvider(admin, {
    contaId,
    providerAtual: 'chatwoot',
    conversationId: body.conversation?.id ?? null,
    inboxId: body.conversation?.inbox_id ?? null,
    timestamp,
  });
  if (duplicado) {
    console.log(`[chatwoot-webhook] duplicado cross-provider: msg=${messageIdExterno} conv=${body.conversation?.id}`);
    return NextResponse.json({ ok: true, duplicado: true });
  }

  // Normalizar e processar via pipeline comum
  const resultado = await processarEventoInbound(admin, {
    provider: 'chatwoot',
    telefone,
    mensagem: body.message?.content ?? null,
    messageIdExterno,
    timestamp,
    nomeContato: body.contact?.name ?? null,
    tipoMensagem: 'texto',
    fromMe: false,
    payloadBruto: body,
  }, contaId);

  if (!resultado.ok) {
    const status = resultado.erro === 'conta_nao_resolvida' ? 200 : 500;
    return NextResponse.json(resultado, { status });
  }
  return NextResponse.json(resultado);
}
