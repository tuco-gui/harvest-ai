import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizarEventoWaha, sessionDoWebhookWaha, type PayloadWebhookWaha } from '@/lib/inboundWaha';
import { resolverContaWaha } from '@/lib/inboundConta';
import { processarEventoInbound } from '@/lib/inbound';

/**
 * Webhook do WAHA (Fase 3B). Rota fina de propósito: só faz parsing do
 * payload, chama o adapter (payload WAHA → evento normalizado), resolve a
 * conta pelo nome da sessão e delega o resto ao pipeline comum
 * (lib/inbound.ts) — a lógica comercial não duplica aqui.
 *
 * Sempre responde 200 quando o payload foi entendido (mesmo que o evento
 * tenha sido ignorado/descartado), para não gerar retries infinitos do
 * WAHA por algo que retry nenhum resolveria. Só payload ilegível (400) ou
 * falha real de banco (500) usam status de erro — aí sim vale reenviar.
 *
 * Cadastro do webhook real no WAHA e verificação do payload de produção
 * ficam como pendência (ver RELATORIO_ENTREGAS.md, Entrega 05).
 */
export async function POST(req: Request) {
  let body: PayloadWebhookWaha;
  try {
    body = await req.json();
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
