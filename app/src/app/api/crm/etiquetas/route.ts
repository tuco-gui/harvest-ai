import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { nomeEtiqueta, corEtiqueta } from '@/lib/crmEtiquetas';

async function sessao() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return { erro: NextResponse.json({ erro: 'Selecione a workspace ou faça login.' }, { status: 401 }) } as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) {
    return { erro: NextResponse.json({ erro: 'CRM avançado indisponível.' }, { status: 403 }) } as const;
  }
  return { perfil, admin } as const;
}
export async function GET() {
  const c = await sessao(); if ('erro' in c) return c.erro;
  const { data, error } = await c.admin.from('crm_etiquetas')
    .select('nome,cor').eq('conta_id', c.perfil.conta_id).order('nome').limit(200);
  if (error) return NextResponse.json({ erro: 'Não foi possível carregar as etiquetas.' }, { status: 503 });
  return NextResponse.json({ etiquetas: data ?? [], podeGerenciar: isAdmin(c.perfil.papel) });
}
export async function POST(req: Request) {
  const c = await sessao(); if ('erro' in c) return c.erro;
  if (!isAdmin(c.perfil.papel)) return NextResponse.json({ erro: 'Somente administrador cria etiquetas.' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const nome = nomeEtiqueta(b?.nome), cor = corEtiqueta(b?.cor ?? null);
  if (!nome || cor === undefined) return NextResponse.json({ erro: 'Nome ou cor inválidos.' }, { status: 400 });
  const { data, error } = await c.admin.from('crm_etiquetas').insert({
    conta_id: c.perfil.conta_id, nome, cor,
  }).select('nome,cor').single();
  if (error) return NextResponse.json({ erro: error.code === '23505' ? 'Etiqueta já existe.' : 'Não foi possível criar a etiqueta.' }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ etiqueta: data }, { status: 201 });
}
export async function PATCH(req: Request) {
  const c = await sessao(); if ('erro' in c) return c.erro;
  if (!isAdmin(c.perfil.papel)) return NextResponse.json({ erro: 'Somente administrador altera cores.' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const nome = nomeEtiqueta(b?.nome), cor = corEtiqueta(b?.cor);
  if (!nome || cor === undefined) return NextResponse.json({ erro: 'Etiqueta ou cor inválida.' }, { status: 400 });
  const { data,error } = await c.admin.from('crm_etiquetas').update({cor})
    .eq('conta_id',c.perfil.conta_id).eq('nome',nome).select('nome,cor').maybeSingle();
  if (error || !data) return NextResponse.json({ erro: 'Etiqueta não encontrada.' }, { status: 404 });
  return NextResponse.json({ etiqueta: data });
}
export async function DELETE(req: Request) {
  const c = await sessao(); if ('erro' in c) return c.erro;
  if (!isAdmin(c.perfil.papel)) return NextResponse.json({ erro: 'Somente administrador exclui etiquetas.' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const nome = nomeEtiqueta(b?.nome);
  if (!nome || b.confirmar !== nome) return NextResponse.json({ erro: 'Confirme exatamente o nome a excluir.' }, { status: 400 });
  const { data, error } = await c.admin.rpc('crm_excluir_etiqueta', {
    p_conta:c.perfil.conta_id, p_nome:nome,
  });
  if(error) return NextResponse.json({ erro:'Erro ao excluir etiqueta do catálogo.' }, { status:500 });
  if(data === -1) return NextResponse.json({ erro:'Etiqueta não encontrada.' }, { status:404 });
  return NextResponse.json({ ok:true, desvinculadaDe:Number(data) });
}
