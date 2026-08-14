import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { vincularLeadsACampanha } from '@/lib/campanhaLeads';

/**
 * Cria uma "lista" ou uma "campanha" (Entrega 12 — pesquisa ≠ campanha).
 * `tipo`: 'lista' (padrão histórico de compatibilidade seria 'campanha' —
 * ver migration 020) — uma lista é uma linha em prospecta_campanhas com
 * tipo='lista', reaproveitando o mesmo schema/vínculo N:N (campanha_leads)
 * em vez de criar uma tabela nova. `leadIds`, quando informado, já vincula
 * os leads selecionados nesta mesma chamada (a busca em si NÃO cria mais
 * campanha automaticamente — ver /api/busca).
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const nome = String(b.nome ?? '').trim();
  if (!nome) return NextResponse.json({ erro: 'Falta o nome da campanha.' }, { status: 400 });

  const origem = ['busca', 'planilha', 'manual'].includes(b.origem) ? b.origem : 'busca';
  const tipo = b.tipo === 'lista' ? 'lista' : 'campanha';
  const leadIds: number[] = Array.isArray(b.leadIds)
    ? b.leadIds.filter((n: unknown) => Number.isInteger(n))
    : [];

  const admin = supabaseAdmin();

  // encontradas/comWhatsapp: se vier leadIds, calcula server-side (não
  // confia em contagem vinda do navegador); senão aceita o valor explícito
  // (compatibilidade com o fluxo antigo de "campanha vazia, leads chegam
  // depois via /api/busca ou /api/leads/importar").
  let encontradas = Number(b.encontradas) || 0;
  let comWhatsapp = Number(b.comWhatsapp) || 0;
  if (leadIds.length) {
    const { data: leadsDaLista } = await admin
      .from('prospecta_leads').select('id, tem_whatsapp')
      .eq('conta_id', perfil.conta_id).in('id', leadIds);
    encontradas = leadsDaLista?.length ?? 0;
    comWhatsapp = (leadsDaLista ?? []).filter((l: any) => l.tem_whatsapp === 'sim').length;
  }

  const { data, error } = await supabaseAdmin()
    .from('prospecta_campanhas')
    .insert({
      conta_id: perfil.conta_id, criado_por: perfil.id, nome, origem, tipo,
      encontradas, com_whatsapp: comWhatsapp,
    })
    .select('id').single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  if (leadIds.length) {
    await vincularLeadsACampanha(admin, perfil.conta_id, data.id, leadIds, 'manual');
  }

  return NextResponse.json({ id: data.id });
}

/** Atualiza nome e/ou os números de "encontradas"/"com WhatsApp" — chamado
 *  de novo a cada leva adicionada à mesma campanha (busca, planilha, manual). */
export async function PATCH(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  if (!b.id) return NextResponse.json({ erro: 'Falta a campanha.' }, { status: 400 });

  const dados: Record<string, unknown> = {};
  if (typeof b.nome === 'string' && b.nome.trim()) dados.nome = b.nome.trim();
  if (typeof b.encontradas === 'number') dados.encontradas = b.encontradas;
  if (typeof b.comWhatsapp === 'number') dados.com_whatsapp = b.comWhatsapp;
  // Número de envio (Fase 3B.1): fixo num canal ou rodízio entre canais.
  if (b.modoEnvio === 'fixo' || b.modoEnvio === 'rodizio') dados.modo_envio_numero = b.modoEnvio;
  if (Array.isArray(b.canalIds)) {
    dados.canal_ids = b.canalIds.filter((n: unknown) => Number.isInteger(n)) as number[];
  }

  // "Criar campanha a partir desta lista" — upgrade em vez de duplicar linha.
  if (b.tipo === 'lista' || b.tipo === 'campanha') dados.tipo = b.tipo;

  // Estado/agendamento (Entrega 12). Ver migration 020 pros valores válidos —
  // a constraint do banco é a fonte final da verdade, isto é só validação
  // antecipada pra dar erro claro em vez de 500 genérico.
  const STATUS_VALIDOS = ['rascunho', 'agendada', 'em_execucao', 'pausada', 'concluida', 'cancelada'];
  if (typeof b.status === 'string' && STATUS_VALIDOS.includes(b.status)) dados.status = b.status;
  if (b.agendadoPara === null) dados.agendado_para = null;
  else if (typeof b.agendadoPara === 'string' && !Number.isNaN(Date.parse(b.agendadoPara))) {
    dados.agendado_para = b.agendadoPara;
  }
  if (typeof b.agendadoTimezone === 'string' && b.agendadoTimezone.trim()) {
    dados.agendado_timezone = b.agendadoTimezone.trim();
  }

  // Estratégia de mensagem — null = usar configuração padrão da conta.
  const MENSAGEM_MODOS = ['padrao', 'fixa', 'rodizio', 'ia'];
  if (b.mensagemModo === null) dados.mensagem_modo = null;
  else if (typeof b.mensagemModo === 'string' && MENSAGEM_MODOS.includes(b.mensagemModo)) {
    dados.mensagem_modo = b.mensagemModo;
  }
  if (Array.isArray(b.mensagens)) {
    const limpo = b.mensagens.filter((m: unknown) => typeof m === 'string' && m.trim()).slice(0, 5);
    if (limpo.length > 5 || (limpo.length > 0 && limpo.length < 2 && b.mensagemModo === 'rodizio')) {
      return NextResponse.json({ erro: 'Rodízio precisa de 2 a 5 mensagens.' }, { status: 400 });
    }
    dados.mensagens = limpo;
  }
  if (typeof b.contextoIa === 'string') dados.contexto_ia = b.contextoIa.trim() || null;

  // Cadência.
  const CADENCIA_MODOS = ['padrao', 'rapida', 'moderada', 'conservadora', 'personalizada'];
  if (typeof b.cadenciaModo === 'string' && CADENCIA_MODOS.includes(b.cadenciaModo)) {
    dados.cadencia_modo = b.cadenciaModo;
    if (b.cadenciaModo === 'personalizada') {
      const min = Number(b.cadenciaMin);
      const max = Number(b.cadenciaMax);
      if (!(min > 0) || !(max > min)) {
        return NextResponse.json({ erro: 'Cadência personalizada: mínimo precisa ser > 0 e menor que o máximo.' }, { status: 400 });
      }
      dados.cadencia_min = min;
      dados.cadencia_max = max;
    }
  }

  if (!Object.keys(dados).length) return NextResponse.json({ ok: true });

  const { error } = await supabaseAdmin()
    .from('prospecta_campanhas').update(dados).eq('id', b.id).eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Apaga a campanha — nunca os leads dela. Só desvincula (campanha_id=null),
 *  porque o lead já pode ter recebido mensagem e tem histórico que vale
 *  manter mesmo sem a campanha original existir mais. */
export async function DELETE(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não exclui campanhas.' }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}) as any);
  if (!id) return NextResponse.json({ erro: 'Falta a campanha.' }, { status: 400 });

  const admin = supabaseAdmin();
  await admin.from('prospecta_leads').update({ campanha_id: null }).eq('campanha_id', id).eq('conta_id', perfil.conta_id);
  const { error } = await admin.from('prospecta_campanhas').delete().eq('id', id).eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
