import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { removerOptOut } from '@/lib/optout';

/** DELETE /api/optouts/[id] — remover opt-out */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel !== 'admin' && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Apenas administradores podem remover opt-outs.' }, { status: 403 });
  }

  const b = await _req.json().catch(() => ({}) as any);
  const motivo = String(b.motivo ?? '').trim();
  if (!motivo) return NextResponse.json({ erro: 'Informe o motivo da remoção.' }, { status: 400 });

  const admin = supabaseAdmin();
  const resultado = await removerOptOut(admin, {
    optOutId: Number(id),
    contaId: perfil.conta_id,
    removidoPor: perfil.id,
    motivoRemocao: motivo,
  });

  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  return NextResponse.json({ ok: true });
}
