import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/funis/[id] → detalhe do funil com seus estágios */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const admin = supabaseAdmin();
  const [{ data: funil }, { data: estagios }] = await Promise.all([
    admin.from('funis').select('id, nome, ativo, criado_em')
      .eq('id', id).eq('conta_id', perfil.conta_id).maybeSingle(),
    admin.from('funil_estagios').select('*')
      .eq('funil_id', id).order('ordem'),
  ]);

  if (!funil) return NextResponse.json({ erro: 'Funil não encontrado.' }, { status: 404 });
  return NextResponse.json({ funil, estagios: estagios ?? [] });
}

/** PATCH /api/funis/[id] → renomeia ou ativa/desativa */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const dados: Record<string, unknown> = {};
  if (typeof b.nome === 'string' && b.nome.trim()) dados.nome = b.nome.trim();
  if (typeof b.ativo === 'boolean') dados.ativo = b.ativo;
  dados.atualizado_em = new Date().toISOString();

  if (!Object.keys(dados).length) return NextResponse.json({ ok: true });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('funis').update(dados)
    .eq('id', id).eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/funis/[id] → soft-delete (ativo=false) */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();

  // Não pode deletar se há campanhas ativas usando este funil
  const { count } = await admin
    .from('prospecta_campanhas')
    .select('id', { count: 'exact', head: true })
    .eq('funil_id', id)
    .in('status', ['rascunho', 'agendada', 'em_execucao', 'pausada']);

  if (count && count > 0) {
    return NextResponse.json({
      erro: `Este funil está em uso por ${count} campanha(s) ativa(s). Desative-o em vez de excluir.`,
    }, { status: 400 });
  }

  const { error } = await admin
    .from('funis').update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id).eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
