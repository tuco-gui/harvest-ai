import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string; automacaoId: string }> };

/**
 * GET /api/funis/[id]/automacoes/[automacaoId] — busca automação
 * PATCH — atualiza automação
 * DELETE — remove automação
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id, automacaoId } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: automacao, error } = await admin
    .from('funil_automacoes')
    .select('*, estagio:funil_estagios(id, nome, ordem)')
    .eq('id', automacaoId)
    .eq('funil_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!automacao) return NextResponse.json({ erro: 'Automação não encontrada.' }, { status: 404 });

  return NextResponse.json({ automacao });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id, automacaoId } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const b = await req.json().catch(() => ({}) as any);

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (typeof b.nome === 'string') updates.nome = b.nome.trim();
  if (typeof b.ativo === 'boolean') updates.ativo = b.ativo;
  if (typeof b.gatilho === 'string') updates.gatilho = b.gatilho;
  if (typeof b.acao === 'string') updates.acao = b.acao;
  if (b.condicao && typeof b.condicao === 'object') updates.condicao = b.condicao;
  if (b.acao_parametros && typeof b.acao_parametros === 'object') updates.acao_parametros = b.acao_parametros;
  if (Number.isInteger(Number(b.estagio_id))) updates.estagio_id = Number(b.estagio_id);

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ erro: 'Nada para atualizar.' }, { status: 400 });
  }

  const { data: automacao, error } = await admin
    .from('funil_automacoes')
    .update(updates)
    .eq('id', automacaoId)
    .eq('funil_id', id)
    .select('*, estagio:funil_estagios(id, nome, ordem)')
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!automacao) return NextResponse.json({ erro: 'Automação não encontrada.' }, { status: 404 });

  return NextResponse.json({ automacao });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, automacaoId } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel !== 'super_admin' && perfil.papel !== 'admin') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();

  const { error } = await admin
    .from('funil_automacoes')
    .delete()
    .eq('id', automacaoId)
    .eq('funil_id', id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
