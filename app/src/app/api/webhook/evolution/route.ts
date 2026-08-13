import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizarEventoEvolution, instanciaDoWebhookEvolution, type PayloadWebhookEvolution } from '@/lib/inboundEvolution';
import { resolverContaEvolution } from '@/lib/inboundConta';
import { processarEventoInbound } from '@/lib/inbound';

/**
 * Webhook da Evolution (Fase 3B). Mesmo desenho da rota WAHA (app/api/webhook/waha):
 * rota fina — parsing, adapter (payload Evolution → MESMO evento normalizado),
 * resolução de conta pelo nome da instância, e delega ao pipeline comum
 * (lib/inbound.ts). Nenhuma lógica comercial duplicada entre as duas rotas.
 *
 * Mesma política de status HTTP da rota WAHA: 200 para tudo que foi
 * entendido (mesmo se ignorado/descartado), 400 só para payload ilegível,
 * 500 só para falha real de banco.
 *
 * Cadastro do webhook real na Evolution e verificação do payload de
 * produção ficam como pendência (ver RELATORIO_ENTREGAS.md, Entrega 05).
 */
export async function POST(req: Request) {
  let body: PayloadWebhookEvolution;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'payload inválido' }, { status: 400 });
  }

  const evento = normalizarEventoEvolution(body);
  if (!evento) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'evento não é messages.upsert individual processável' });
  }

  const admin = supabaseAdmin();
  const contaId = await resolverContaEvolution(admin, instanciaDoWebhookEvolution(body));
  const resultado = await processarEventoInbound(admin, evento, contaId);

  if (!resultado.ok) {
    const status = resultado.erro === 'conta_nao_resolvida' ? 200 : 500;
    return NextResponse.json(resultado, { status });
  }
  return NextResponse.json(resultado);
}
