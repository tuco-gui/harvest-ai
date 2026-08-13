import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizarEventoWaha, sessionDoWebhookWaha, type PayloadWebhookWaha } from '@/lib/inboundWaha';
import { resolverContaWaha } from '@/lib/inboundConta';
import { processarEventoInbound } from '@/lib/inbound';
import { verificarAssinaturaWaha } from '@/lib/inboundSeguranca';

/**
 * Webhook do WAHA (Fase 3B). Rota fina de propósito: valida a assinatura,
 * chama o adapter (payload WAHA → evento normalizado), resolve a conta pelo
 * nome da sessão e delega o resto ao pipeline comum (lib/inbound.ts) — a
 * lógica comercial não duplica aqui.
 *
 * Segurança: exige `X-Webhook-Hmac` (HMAC-SHA512 do corpo cru, chave em
 * `WAHA_WEBHOOK_HMAC_KEY`) — mecanismo nativo do WAHA
 * (waha.devlike.pro/docs/how-to/security), configurado na sessão via
 * `config.webhooks[].hmac.key` com a MESMA chave. Sem a env configurada, a
 * rota rejeita tudo (falha fechada) — nunca aceita webhook sem verificação
 * "porque ainda não configuramos".
 *
 * Sempre responde 200 quando o payload foi entendido e autenticado (mesmo
 * que o evento tenha sido ignorado/descartado), para não gerar retries
 * infinitos do WAHA por algo que retry nenhum resolveria. 401 para
 * assinatura ausente/inválida, 400 para payload ilegível, 500 só para falha
 * real de banco.
 *
 * Cadastro do webhook real no WAHA (URL + hmac.key) e verificação do
 * payload de produção ficam como pendência (ver RELATORIO_ENTREGAS.md,
 * Entrega 05).
 */
export async function POST(req: Request) {
  const corpoCru = await req.text();

  const assinatura = verificarAssinaturaWaha(corpoCru, req.headers.get('x-webhook-hmac'));
  if (!assinatura.ok) {
    // Nunca ecoa a chave nem o header recebido na resposta — só o motivo.
    return NextResponse.json({ ok: false, erro: 'assinatura inválida', motivo: assinatura.motivo }, { status: 401 });
  }

  let body: PayloadWebhookWaha;
  try {
    body = JSON.parse(corpoCru);
  } catch {
    return NextResponse.json({ ok: false, erro: 'payload inválido' }, { status: 400 });
  }

  const evento = normalizarEventoWaha(body);
  if (!evento) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'evento não é mensagem individual processável' });
  }

  const admin = supabaseAdmin();
  const contaId = await resolverContaWaha(admin, sessionDoWebhookWaha(body));
  const resultado = await processarEventoInbound(admin, evento, contaId);

  if (!resultado.ok) {
    const status = resultado.erro === 'conta_nao_resolvida' ? 200 : 500;
    return NextResponse.json(resultado, { status });
  }
  return NextResponse.json(resultado);
}
