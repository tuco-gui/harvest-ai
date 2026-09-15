import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { listarInboxes } from '@/lib/chatwoot';

/**
 * GET /api/canais/chatwoot — lista inboxes do Chatwoot vinculados a esta conta.
 * POST — vincula/desvincula inboxes Chatwoot nesta conta.
 *
 * Não inventa suporte: consulta a API real do Chatwoot e mostra apenas
 * os canais que a instalação self-hosted efetivamente tem.
 *
 * Suporta múltiplos inboxes por conta (WhatsApp + Instagram + Messenger + Telegram + outros).
 */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });

  const admin = supabaseAdmin();

  // Buscar account_id Chatwoot da conta (de crm_vinculos ou do primeiro chatwoot_inbox)
  const { data: vinculo } = await admin
    .from('crm_vinculos')
    .select('chatwoot_account_id')
    .eq('conta_id', perfil.conta_id)
    .maybeSingle();

  const chatwootAccountId = vinculo?.chatwoot_account_id;

  // Buscar inboxes vinculados nesta conta
  const { data: inboxesVinculados } = await admin
    .from('chatwoot_inboxes')
    .select('*')
    .eq('conta_id', perfil.conta_id)
    .order('tipo_canal');

  // Se tem account_id, consultar inboxes disponíveis no Chatwoot
  let inboxesDisponiveis: Array<{ id: number; name: string; channel_type?: string }> = [];
  if (chatwootAccountId) {
    try {
      inboxesDisponiveis = await listarInboxes(chatwootAccountId);
    } catch (e) {
      return NextResponse.json({
        ok: false,
        configurado: true,
        chatwootAccountId,
        inboxes: inboxesVinculados ?? [],
        erro: e instanceof Error ? e.message : 'Erro ao consultar Chatwoot',
      }, { status: 502 });
    }
  }

  return NextResponse.json({
    ok: true,
    configurado: !!chatwootAccountId,
    chatwootAccountId,
    inboxes: inboxesVinculados ?? [],
    // Inboxes disponíveis no Chatwoot que ainda não estão vinculados
    disponiveis: chatwootAccountId
      ? inboxesDisponiveis
          .filter((i) => !(inboxesVinculados ?? []).some((v) => v.chatwoot_inbox_id === i.id))
          .map((i) => ({
            id: i.id,
            nome: i.name,
            tipo: i.channel_type ?? 'desconhecido',
          }))
      : [],
  });
}

/**
 * POST /api/canais/chatwoot
 *
 * Ações:
 *   vincular   — vincula um inbox Chatwoot a esta conta
 *   desvincular — remove o vínculo de um inbox
 *   configurar  — define o chatwoot_account_id da conta
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const admin = supabaseAdmin();
  const acao = String(b.acao ?? 'configurar');

  // --- Configurar account_id ---
  if (acao === 'configurar') {
    const chatwootAccountId = Number(b.chatwootAccountId);
    if (!Number.isInteger(chatwootAccountId)) {
      return NextResponse.json({ erro: 'chatwootAccountId inválido.' }, { status: 400 });
    }

    const { error } = await admin
      .from('crm_vinculos')
      .upsert({
        conta_id: perfil.conta_id,
        chatwoot_account_id: chatwootAccountId,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'conta_id' });

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, chatwootAccountId });
  }

  // --- Vincular inbox ---
  if (acao === 'vincular') {
    const inboxId = Number(b.chatwootInboxId);
    const tipoCanal = String(b.tipoCanal ?? 'outro').trim().toLowerCase();
    const nome = String(b.nome ?? '').trim();

    if (!Number.isInteger(inboxId)) {
      return NextResponse.json({ erro: 'chatwootInboxId inválido.' }, { status: 400 });
    }
    const tiposValidos = ['whatsapp', 'instagram', 'facebook', 'telegram', 'sms', 'email', 'widget', 'api', 'line', 'outro'];
    if (!tiposValidos.includes(tipoCanal)) {
      return NextResponse.json({ erro: `tipoCanal inválido. Use: ${tiposValidos.join(', ')}` }, { status: 400 });
    }

    // Buscar account_id do vínculo existente
    const { data: vinculo } = await admin
      .from('crm_vinculos')
      .select('chatwoot_account_id')
      .eq('conta_id', perfil.conta_id)
      .maybeSingle();

    if (!vinculo?.chatwoot_account_id) {
      return NextResponse.json({ erro: 'Configure o Chatwoot Account ID primeiro.' }, { status: 400 });
    }

    const { data: inbox, error } = await admin
      .from('chatwoot_inboxes')
      .upsert({
        conta_id: perfil.conta_id,
        chatwoot_account_id: vinculo.chatwoot_account_id,
        chatwoot_inbox_id: inboxId,
        tipo_canal: tipoCanal,
        nome: nome || `Inbox ${inboxId}`,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'conta_id, chatwoot_inbox_id' })
      .select('*')
      .maybeSingle();

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inbox });
  }

  // --- Desvincular inbox ---
  if (acao === 'desvincular') {
    const inboxId = Number(b.chatwootInboxId);
    if (!Number.isInteger(inboxId)) {
      return NextResponse.json({ erro: 'chatwootInboxId inválido.' }, { status: 400 });
    }

    const { error } = await admin
      .from('chatwoot_inboxes')
      .delete()
      .eq('conta_id', perfil.conta_id)
      .eq('chatwoot_inbox_id', inboxId);

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: `Ação desconhecida: ${acao}` }, { status: 400 });
}
