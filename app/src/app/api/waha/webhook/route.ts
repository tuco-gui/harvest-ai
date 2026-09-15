import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { registrarWebhookWaha, verificarWebhookWaha } from '@/lib/waha';
import { carregarCanais, sessaoWahaDoCanal } from '@/lib/whatsappCanais';

/**
 * Diagnóstico e registro de webhook WAHA.
 *
 * GET  — verifica se o webhook está registrado em todas as sessões WAHA da conta.
 * POST — (re)registra o webhook em todas as sessões WAHA da conta.
 *
 * O P0 do inbound é que o WAHA não tinha webhook registrado — as mensagens
 * recebidas não tinham para onde ser entregues. Esta rota permite:
 * 1. Diagnosticar quais sessões estão sem webhook;
 * 2. Registrar/re-registrar o webhook sem precisar recriar a sessão.
 */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });

  const admin = supabaseAdmin();
  const canais = await carregarCanais(admin, perfil.conta_id);
  const waha = canais.filter((c) => c.provider === 'waha' && c.ativo);

  if (!waha.length) {
    return NextResponse.json({ ok: true, canais: [], mensagem: 'Nenhum canal WAHA ativo nesta conta.' });
  }

  const resultados = await Promise.all(
    waha.map(async (c) => {
      const sessao = sessaoWahaDoCanal(c);
      const webhook = await verificarWebhookWaha(sessao);
      return {
        canalId: c.id,
        canalNome: c.nome,
        sessao,
        status: c.status,
        webhook,
      };
    }),
  );

  const todosOk = resultados.every((r) => r.webhook.registrado);
  const algumComErro = resultados.some((r) => !!r.webhook.erro);

  return NextResponse.json({
    ok: todosOk && !algumComErro,
    canais: resultados,
    mensagem: todosOk
      ? 'Todos os canais WAHA têm webhook registrado.'
      : 'Alguns canais WAHA estão sem webhook ou com erro. Use POST para (re)registrar.',
  });
}

export async function POST() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const canais = await carregarCanais(admin, perfil.conta_id);
  const waha = canais.filter((c) => c.provider === 'waha' && c.ativo);

  if (!waha.length) {
    return NextResponse.json({ ok: true, registrados: 0, mensagem: 'Nenhum canal WAHA ativo.' });
  }

  const resultados = await Promise.all(
    waha.map(async (c) => {
      const sessao = sessaoWahaDoCanal(c);
      const ok = await registrarWebhookWaha(sessao);
      return { canalId: c.id, canalNome: c.nome, sessao, ok };
    }),
  );

  const registrados = resultados.filter((r) => r.ok).length;

  return NextResponse.json({
    ok: registrados === resultados.length,
    registrados,
    total: resultados.length,
    canais: resultados,
    mensagem: registrados === resultados.length
      ? `Webhook registrado em ${registrados} canal(is) WAHA.`
      : `${registrados}/${resultados.length} canais com webhook registrado. Verifique os erros.`,
  });
}
