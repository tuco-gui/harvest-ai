import { NextResponse } from 'next/server';
import { perfilAtual } from '@/lib/supabase/server';
import { crmBackend } from '@/lib/twenty';

/**
 * PATCH /api/crm/oportunidades/[id]
 * Atualiza estágio, owner, valor, próxima ação ou observações.
 * O isolamento por tenant é garantido pela RLS (conta_id = minha_conta()).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não edita o CRM.' }, { status: 403 });
  }
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const { id } = await params;
  const opId = Number(id);
  if (!opId) return NextResponse.json({ erro: 'Oportunidade inválida.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const patch: Record<string, unknown> = {};
  if (b.estagio !== undefined) patch.estagio = b.estagio;
  if (b.owner_id !== undefined) patch.owner_id = b.owner_id ?? null;
  if (b.valor !== undefined) patch.valor = Number(b.valor) || 0;
  if (b.proxima_acao !== undefined) patch.proxima_acao = b.proxima_acao ?? null;
  if (b.observacoes !== undefined) patch.observacoes = b.observacoes ?? null;
  if (b.previsao_fechamento !== undefined) patch.previsao_fechamento = b.previsao_fechamento ?? null;

  try {
    const op = await crmBackend().atualizar(opId, patch);
    if (!op) return NextResponse.json({ erro: 'Oportunidade não encontrada.' }, { status: 404 });
    return NextResponse.json({ oportunidade: op });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? 'Não consegui atualizar.' }, { status: 400 });
  }
}
