import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { normalizarTelefone } from '@/lib/telefone';
import { estaSuprimido } from '@/lib/supressao';
import { envioPermitidoNoAmbiente } from '@/lib/ambienteEnvio';
import { carregarCanais, sessaoWahaDoCanal } from '@/lib/whatsappCanais';
import { getOrCreateSession, sendText as wahaSendText } from '@/lib/waha';
import { registrarTentativaContato } from '@/lib/historicoContato';

async function contexto(id: number) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return { erro: NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 }) };
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm'))) {
    return { erro: NextResponse.json({ erro: 'CRM não habilitado para esta conta.' }, { status: 403 }) };
  }
  const { data: oportunidade } = await admin.from('oportunidades')
    .select('id, lead_id, telefone, empresa, campanha_id, estagio')
    .eq('id', id).eq('conta_id', perfil.conta_id).maybeSingle();
  if (!oportunidade) return { erro: NextResponse.json({ erro: 'Oportunidade não encontrada.' }, { status: 404 }) };
  return { perfil, admin, oportunidade };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(Number(id));
  if ('erro' in ctx) return ctx.erro;
  const telefone = normalizarTelefone(ctx.oportunidade.telefone ?? '');

  const saidas = ctx.oportunidade.lead_id
    ? await ctx.admin.from('prospecta_mensagens')
        .select('id, conteudo, status, enviado_em, criado_em, erro')
        .eq('conta_id', ctx.perfil.conta_id).eq('lead_id', ctx.oportunidade.lead_id)
        .order('criado_em')
    : { data: [] };
  const entradas = telefone
    ? await ctx.admin.from('inbound_eventos')
        .select('id, mensagem, tipo_mensagem, tipo_evento, recebido_em, nome_contato')
        .eq('conta_id', ctx.perfil.conta_id).eq('telefone', telefone).order('recebido_em')
    : { data: [] };
  const registroCrm = ctx.oportunidade.lead_id
    ? { data: [] }
    : await ctx.admin.from('crm_atividades')
        .select('id, descricao, concluida, criado_em')
        .eq('conta_id', ctx.perfil.conta_id).eq('oportunidade_id', ctx.oportunidade.id)
        .eq('tipo', 'whatsapp').order('criado_em');

  const mensagens = [
    ...(saidas.data ?? []).map((m: any) => ({
      id: `s-${m.id}`, direcao: 'saida', texto: m.conteudo, status: m.status,
      data: m.enviado_em ?? m.criado_em, erro: m.erro ?? null,
    })),
    ...(entradas.data ?? []).map((m: any) => ({
      id: `e-${m.id}`, direcao: 'entrada', texto: m.mensagem ?? `[${m.tipo_mensagem}]`,
      status: m.tipo_evento, data: m.recebido_em, nome: m.nome_contato ?? null,
    })),
    ...(registroCrm.data ?? []).map((m: any) => ({
      id: `c-${m.id}`, direcao: 'saida', texto: m.descricao ?? '',
      status: m.concluida ? 'enviada' : 'erro', data: m.criado_em,
    })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  return NextResponse.json({ mensagens });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto(Number(id));
  if ('erro' in ctx) return ctx.erro;
  const contaId = ctx.perfil.conta_id!;
  const b = await req.json().catch(() => ({}) as any);
  const texto = String(b.texto ?? '').trim();
  const canalId = Number(b.canal_id);
  if (!texto) return NextResponse.json({ erro: 'Digite uma mensagem.' }, { status: 400 });
  if (texto.length > 4096) return NextResponse.json({ erro: 'Mensagem acima de 4.096 caracteres.' }, { status: 400 });

  const telefone = normalizarTelefone(ctx.oportunidade.telefone ?? '');
  if (!telefone) return NextResponse.json({ erro: 'Oportunidade sem telefone válido.' }, { status: 400 });
  const permissao = envioPermitidoNoAmbiente(telefone);
  if (!permissao.ok) return NextResponse.json({ erro: permissao.motivo }, { status: 403 });
  if (await estaSuprimido(ctx.admin, contaId, telefone)) {
    return NextResponse.json({ erro: 'Contato em opt-out/supressão. O envio foi bloqueado.', suprimido: true }, { status: 403 });
  }

  const canais = await carregarCanais(ctx.admin, contaId);
  const canal = canais.find((c) => c.id === canalId && c.ativo && c.status === 'conectado');
  if (!canal) return NextResponse.json({ erro: 'Escolha um canal conectado desta conta.' }, { status: 400 });

  let entregue = false;
  let falha: string | null = null;
  if (canal.provider === 'waha') {
    const sessao = sessaoWahaDoCanal(canal);
    try {
      const status = await getOrCreateSession(sessao);
      if (status.status !== 'WORKING') falha = 'O canal WAHA não está conectado.';
      else entregue = await wahaSendText(sessao, telefone, texto);
      if (!entregue && !falha) falha = 'O WAHA não confirmou o envio.';
    } catch {
      falha = 'Não consegui falar com o WAHA.';
    }
  } else {
    const { data: cred } = await ctx.admin.from('conta_credenciais').select('evolution_url, evolution_instancia, evolution_key')
      .eq('conta_id', contaId).maybeSingle();
    if (!cred?.evolution_url || !cred?.evolution_instancia || !cred?.evolution_key) {
      falha = 'Evolution não configurada para esta conta.';
    } else {
      try {
        const resposta = await fetch(`${String(cred.evolution_url).replace(/\/+$/, '')}/message/sendText/${cred.evolution_instancia}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cred.evolution_key },
          body: JSON.stringify({ number: telefone, text: texto }), signal: AbortSignal.timeout(30_000),
        });
        entregue = resposta.ok;
        if (!entregue) falha = `Evolution respondeu ${resposta.status}.`;
      } catch {
        falha = 'Não consegui falar com a Evolution.';
      }
    }
  }

  let mensagemId: number | null = null;
  if (ctx.oportunidade.lead_id) {
    const { data: mensagem } = await ctx.admin.from('prospecta_mensagens').insert({
      conta_id: contaId, lead_id: ctx.oportunidade.lead_id, parte: 1,
      direcao: 'saida', conteudo: texto, status: entregue ? 'enviada' : 'erro',
      enviado_em: entregue ? new Date().toISOString() : null, erro: falha,
    }).select('id').maybeSingle();
    mensagemId = mensagem?.id ?? null;
  }
  await registrarTentativaContato(ctx.admin, {
    contaId, leadId: ctx.oportunidade.lead_id,
    campanhaId: ctx.oportunidade.campanha_id, mensagemId, telefone,
    provider: canal.provider, canalId: canal.id, status: entregue ? 'enviado' : 'erro', origem: 'crm',
  });
  // Registro próprio da oportunidade: mantém o histórico mesmo quando ela
  // foi criada manualmente e ainda não possui lead_id no módulo de prospecção.
  await ctx.admin.from('crm_atividades').insert({
    conta_id: contaId, oportunidade_id: ctx.oportunidade.id,
    autor_id: ctx.perfil.id, tipo: 'whatsapp', titulo: entregue ? 'Mensagem enviada' : 'Falha no envio',
    descricao: texto, concluida: entregue,
  });
  if (!entregue) return NextResponse.json({ erro: falha ?? 'Envio não confirmado.' }, { status: 502 });

  if (ctx.oportunidade.estagio === 'novo') {
    await ctx.admin.from('oportunidades').update({ estagio: 'contatado', probabilidade: 10, atualizado_em: new Date().toISOString() })
      .eq('id', ctx.oportunidade.id).eq('conta_id', contaId);
  }
  return NextResponse.json({ ok: true, canal: { id: canal.id, nome: canal.nome } });
}
