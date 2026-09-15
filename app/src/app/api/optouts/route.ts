import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { listarOptOuts, removerOptOut, buscarPolitica, atualizarPolitica, type OverridePolicy } from '@/lib/optout';

/** GET /api/optouts — listar opt-outs + política */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const [optOuts, politica] = await Promise.all([
    listarOptOuts(admin, perfil.conta_id),
    buscarPolitica(admin, perfil.conta_id),
  ]);

  return NextResponse.json({ optOuts: optOuts.dados, total: optOuts.total, politica });
}

/** POST /api/optouts — registrar opt-out manual (admin) */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel !== 'admin' && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Apenas administradores podem registrar opt-out manual.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const telefone = String(b.telefone ?? '').trim();
  const motivo = String(b.motivo ?? 'manual');
  const observacao = String(b.observacao ?? '').trim();

  if (!telefone) return NextResponse.json({ erro: 'Informe o telefone.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { registrarOptOut } = await import('@/lib/optout');
  const resultado = await registrarOptOut(admin, {
    contaId: perfil.conta_id,
    telefone,
    motivo: motivo as any,
    criadoPor: perfil.id,
    criadoPorTipo: perfil.papel === 'super_admin' ? 'admin' : 'admin',
    origem: 'manual',
  });

  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 500 });
  return NextResponse.json({ ok: true, optOutId: resultado.optOutId });
}

/** PATCH /api/optouts — atualizar política da workspace */
export async function PATCH(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel !== 'admin' && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Apenas administradores podem alterar a política.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const nova = String(b.politica ?? '') as OverridePolicy;

  if (!['nenhum', 'admin', 'admin_operadores', 'qualquer'].includes(nova)) {
    return NextResponse.json({ erro: 'Política inválida.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const resultado = await atualizarPolitica(admin, perfil.conta_id, nova);
  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 500 });
  return NextResponse.json({ ok: true });
}
