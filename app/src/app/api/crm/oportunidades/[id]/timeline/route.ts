import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { normalizarTelefone } from '@/lib/telefone';
import {
  montarTimeline, type AtividadeTimeline, type EntradaTimeline, type SaidaTimeline,
} from '@/lib/crmTimeline';

/**
 * Somente LEITURA. Junta três fontes já existentes para a ficha CRM.
 * Permissão verificada no servidor, antes de qualquer consulta de mensagens.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 });
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) {
    return NextResponse.json({ erro: 'CRM avançado indisponível nesta workspace.' }, { status: 403 });
  }
  const { id } = await params;
  const opId = Number(id);
  if (!Number.isSafeInteger(opId) || opId < 1) {
    return NextResponse.json({ erro: 'Oportunidade inválida.' }, { status: 400 });
  }

  let query = admin.from('oportunidades')
    .select('id,lead_id,telefone').eq('conta_id', perfil.conta_id).eq('id', opId);
  if (!isAdmin(perfil.papel)) query = query.eq('owner_id', perfil.id);
  const { data: op, error: errOp } = await query.maybeSingle();
  if (errOp) return NextResponse.json({ erro: 'Falha ao verificar acesso ao negócio.' }, { status: 503 });
  if (!op) return NextResponse.json({ erro: 'Oportunidade não encontrada ou sem acesso.' }, { status: 404 });

  const telefone = normalizarTelefone(op.telefone || '');
  const [atividades, entradas, saidas, autores] = await Promise.all([
    admin.from('crm_atividades')
      .select('id,tipo,titulo,descricao,concluida,vence_em,criado_em,autor_id')
      .eq('conta_id', perfil.conta_id).eq('oportunidade_id', opId)
      .order('criado_em', { ascending: false }).limit(150),
    telefone
      ? admin.from('inbound_eventos')
        .select('id,mensagem,tipo_mensagem,tipo_evento,recebido_em,nome_contato')
        .eq('conta_id', perfil.conta_id).eq('telefone', telefone)
        .order('recebido_em', { ascending: false }).limit(150)
      : Promise.resolve({ data: [], error: null }),
    op.lead_id
      ? admin.from('prospecta_mensagens')
        .select('id,conteudo,status,criado_em,enviado_em,erro')
        .eq('conta_id', perfil.conta_id).eq('lead_id', op.lead_id)
        .order('criado_em', { ascending: false }).limit(150)
      : Promise.resolve({ data: [], error: null }),
    admin.from('perfis').select('id,nome,email').eq('conta_id', perfil.conta_id).limit(250),
  ]);
  if (atividades.error || entradas.error || saidas.error || autores.error) {
    return NextResponse.json({ erro: 'Não foi possível consultar todo o histórico da oportunidade.' }, { status: 503 });
  }
  const mapaAutores = Object.fromEntries((autores.data ?? []).map(a => [a.id, a.nome || a.email || 'Equipe']));
  const eventos = montarTimeline(
    (atividades.data ?? []) as AtividadeTimeline[],
    (entradas.data ?? []) as EntradaTimeline[],
    (saidas.data ?? []) as SaidaTimeline[],
    mapaAutores,
  );
  return NextResponse.json({
    oportunidadeId: opId, eventos, atualizadoEm: new Date().toISOString(),
    totalExibido: eventos.length, limitePorFonte: 150,
    aviso: telefone
      ? 'Conversas associadas ao número de telefone deste negócio. Confira a identidade em casos de números compartilhados.'
      : 'Este negócio ainda não possui telefone; mostrando atividades e mensagens ligadas ao lead, se houver.',
  });
}
