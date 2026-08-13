import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizarEventoEvolution, instanciaDoWebhookEvolution, type PayloadWebhookEvolution } from '@/lib/inboundEvolution';
import { resolverContaEvolution } from '@/lib/inboundConta';
import { processarEventoInbound } from '@/lib/inbound';
import { verificarTokenEvolution } from '@/lib/inboundSeguranca';

/**
 * Webhook da Evolution (Fase 3B). Mesmo desenho da rota WAHA
 * (app/api/webhook/waha): rota fina — valida, adapter (payload Evolution →
 * MESMO evento normalizado), resolução de conta pelo nome da instância, e
 * delega ao pipeline comum (lib/inbound.ts). Nenhuma lógica comercial
 * duplicada entre as duas rotas.
 *
 * Segurança: a Evolution API não documenta assinatura/HMAC nativa para
 * webhooks (só enabled/url/webhookByEvents/events —
 * docs.evolution-api.com/docs/04-Webhooks/00-set-webhook). Mitigação: um
 * segmento de token no PRÓPRIO caminho da URL cadastrada no provider
 * (`.../api/webhook/evolution/<token>`, comparado em tempo constante contra
 * `EVOLUTION_WEBHOOK_TOKEN`). Sem a env configurada, a rota rejeita tudo
 * (falha fechada) — mesma política da rota WAHA.
 *
 * IMPORTANTE ao cadastrar o webhook real: `webhookByEvents` precisa ficar
 * `false` — se `true`, a Evolution acrescenta um sufixo por evento
 * (`/messages-upsert` etc.) na URL, e o token deixa de bater com um único
 * caminho fixo.
 *
 * Mesma política de status HTTP da rota WAHA: 200 para tudo que foi
 * entendido e autenticado (mesmo se ignorado/descartado), 401 para token
 * ausente/inválido, 400 só para payload ilegível, 500 só para falha real de
 * banco.
 *
 * Cadastro do webhook real na Evolution e verificação do payload de
 * produção ficam como pendência (ver RELATORIO_ENTREGAS.md, Entrega 05).
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenValido = verificarTokenEvolution(token);
  if (!tokenValido.ok) {
    return NextResponse.json({ ok: false, erro: 'token inválido', motivo: tokenValido.motivo }, { status: 401 });
  }

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
