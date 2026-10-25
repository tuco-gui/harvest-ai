import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { validarNovaTarefa } from '@/lib/crmTarefas';

async function sessaoCrmAvancado() {
  const perfil = await perfilAtual();
  if (!perfil) return { resposta: NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 }) } as const;
  if (!perfil.conta_id) return { resposta: NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 }) } as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) {
    return { resposta: NextResponse.json({ erro: 'CRM avançado não habilitado nesta workspace.' }, { status: 403 }) } as const;
  }
  return { perfil, admin } as const;
}

export async function GET() {
  const ctx = await sessaoCrmAvancado();
  if ('resposta' in ctx) return ctx.resposta;
  const { perfil, admin } = ctx;
  let query = admin.from('oportunidades')
    .select('id,empresa,contato,owner_id,estagio')
    .eq('conta_id', perfil.conta_id)
    .order('atualizado_em', { ascending: false }).limit(500);
  if (!isAdmin(perfil.papel)) query = query.eq('owner_id', perfil.id);
  const { data: oportunidades, error: erroOps } = await query;
  if (erroOps) return NextResponse.json({ erro: 'Não foi possível carregar as oportunidades.' }, { status: 503 });
  const ids = (oportunidades ?? []).map(o => o.id);
  if (!ids.length) return NextResponse.json({ tarefas: [], oportunidades: [], limite: 500 });
  const { data: tarefas, error } = await admin.from('crm_atividades')
    .select('id,oportunidade_id,titulo,descricao,concluida,vence_em,criado_em')
    .eq('conta_id', perfil.conta_id)
    .eq('tipo', 'tarefa')
    .in('oportunidade_id', ids)
    .order('criado_em', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ erro: 'Não foi possível carregar as tarefas.' }, { status: 503 });
  const porId = new Map((oportunidades ?? []).map(o => [o.id, o]));
  const visiveis = (tarefas ?? []).flatMap(t => {
    const op = porId.get(t.oportunidade_id);
    if (!op) return [];
    return [{ ...t, empresa: op.empresa || 'Sem empresa', contato: op.contato || '',
      owner_id: op.owner_id ?? null }];
  });
  return NextResponse.json({ tarefas: visiveis, oportunidades: oportunidades ?? [], limite: 500 });
}

export async function POST(req: Request) {
  const ctx = await sessaoCrmAvancado();
  if ('resposta' in ctx) return ctx.resposta;
  const { perfil, admin } = ctx;
  const b = await req.json().catch(() => null);
  const oportunidadeId = Number(b?.oportunidade_id);
  if (!Number.isSafeInteger(oportunidadeId) || oportunidadeId < 1) {
    return NextResponse.json({ erro: 'Selecione uma oportunidade válida.' }, { status: 400 });
  }
  const falha = validarNovaTarefa(b?.titulo, b?.vence_em, b?.descricao);
  if (falha) return NextResponse.json({ erro: falha }, { status: 400 });
  let opQuery = admin.from('oportunidades').select('id,owner_id').eq('conta_id', perfil.conta_id).eq('id', oportunidadeId);
  if (!isAdmin(perfil.papel)) opQuery = opQuery.eq('owner_id', perfil.id);
  const { data: op } = await opQuery.maybeSingle();
  if (!op) return NextResponse.json({ erro: 'Oportunidade inexistente ou sem acesso.' }, { status: 403 });
  const { data, error } = await admin.from('crm_atividades').insert({
    conta_id: perfil.conta_id,
    oportunidade_id: op.id,
    autor_id: perfil.id,
    tipo: 'tarefa',
    titulo: b.titulo.trim(),
    descricao: typeof b.descricao === 'string' ? b.descricao.trim() || null : null,
    vence_em: b.vence_em ? new Date(b.vence_em).toISOString() : null,
    concluida: false,
  }).select('id,oportunidade_id,titulo,descricao,concluida,vence_em,criado_em').single();
  if (error) return NextResponse.json({ erro: 'Não foi possível criar a tarefa.' }, { status: 500 });
  return NextResponse.json({ tarefa: data }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await sessaoCrmAvancado();
  if ('resposta' in ctx) return ctx.resposta;
  const { perfil, admin } = ctx;
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!Number.isSafeInteger(id) || id < 1 || typeof b?.concluida !== 'boolean') {
    return NextResponse.json({ erro: 'Dados de conclusão inválidos.' }, { status: 400 });
  }
  const { data: tarefa } = await admin.from('crm_atividades')
    .select('id,oportunidade_id')
    .eq('conta_id', perfil.conta_id).eq('tipo', 'tarefa').eq('id', id).maybeSingle();
  if (!tarefa) return NextResponse.json({ erro: 'Tarefa não encontrada.' }, { status: 404 });
  let opQuery = admin.from('oportunidades').select('id').eq('conta_id', perfil.conta_id)
    .eq('id', tarefa.oportunidade_id);
  if (!isAdmin(perfil.papel)) opQuery = opQuery.eq('owner_id', perfil.id);
  const { data: op } = await opQuery.maybeSingle();
  if (!op) return NextResponse.json({ erro: 'Sem acesso à oportunidade vinculada.' }, { status: 403 });
  const { data, error } = await admin.from('crm_atividades')
    .update({ concluida: b.concluida }).eq('conta_id', perfil.conta_id)
    .eq('id', tarefa.id).eq('oportunidade_id', op.id).eq('tipo', 'tarefa')
    .select('id,concluida').maybeSingle();
  if (error || !data) return NextResponse.json({ erro: 'Não foi possível atualizar a tarefa.' }, { status: 500 });
  return NextResponse.json({ tarefa: data });
}
