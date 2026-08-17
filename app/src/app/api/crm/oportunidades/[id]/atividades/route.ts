import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';

const TIPOS = new Set(['nota', 'tarefa', 'ligacao', 'reuniao', 'email', 'whatsapp']);

async function contexto(id: number) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return { erro: NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 }) };
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm'))) {
    return { erro: NextResponse.json({ erro: 'CRM não habilitado para esta conta.' }, { status: 403 }) };
  }
  const { data: oportunidade } = await admin.from('oportunidades').select('id')
    .eq('id', id).eq('conta_id', perfil.conta_id).maybeSingle();
  if (!oportunidade) return { erro: NextResponse.json({ erro: 'Oportunidade não encontrada.' }, { status: 404 }) };
  return { perfil, admin };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opId = Number(id);
  const ctx = await contexto(opId);
  if ('erro' in ctx) return ctx.erro;
  const { data, error } = await ctx.admin.from('crm_atividades')
    .select('id, tipo, titulo, descricao, concluida, vence_em, criado_em, perfis(nome, email)')
    .eq('conta_id', ctx.perfil.conta_id).eq('oportunidade_id', opId)
    .order('criado_em', { ascending: false });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ atividades: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opId = Number(id);
  const ctx = await contexto(opId);
  if ('erro' in ctx) return ctx.erro;
  const b = await req.json().catch(() => ({}) as any);
  const tipo = TIPOS.has(b.tipo) ? b.tipo : 'nota';
  const titulo = String(b.titulo ?? '').trim();
  if (!titulo) return NextResponse.json({ erro: 'Informe o título da atividade.' }, { status: 400 });
  const { data, error } = await ctx.admin.from('crm_atividades').insert({
    conta_id: ctx.perfil.conta_id,
    oportunidade_id: opId,
    autor_id: ctx.perfil.id,
    tipo,
    titulo,
    descricao: b.descricao ? String(b.descricao).trim() : null,
    vence_em: b.vence_em || null,
  }).select('*').single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ atividade: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opId = Number(id);
  const ctx = await contexto(opId);
  if ('erro' in ctx) return ctx.erro;
  const b = await req.json().catch(() => ({}) as any);
  const atividadeId = Number(b.atividade_id);
  if (!atividadeId) return NextResponse.json({ erro: 'Atividade inválida.' }, { status: 400 });
  const { data, error } = await ctx.admin.from('crm_atividades')
    .update({ concluida: b.concluida === true })
    .eq('id', atividadeId).eq('oportunidade_id', opId).eq('conta_id', ctx.perfil.conta_id)
    .select('*').maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: 'Atividade não encontrada.' }, { status: 404 });
  return NextResponse.json({ atividade: data });
}
