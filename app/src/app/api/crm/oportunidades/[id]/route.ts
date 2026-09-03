import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { crmBackend } from '@/lib/twenty';
import { perfilTemModulo } from '@/lib/autorizacao';
import { estagioValido, probabilidadeEstagio } from '@/lib/crmStages';

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
  if (!(await perfilTemModulo(supabaseAdmin(), perfil, 'crm'))) {
    return NextResponse.json({ erro: 'CRM não habilitado para esta conta.' }, { status: 403 });
  }

  const { id } = await params;
  const opId = Number(id);
  if (!opId) return NextResponse.json({ erro: 'Oportunidade inválida.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const patch: Record<string, unknown> = {};
  if (b.empresa !== undefined) patch.empresa = String(b.empresa).trim();
  if (b.contato !== undefined) patch.contato = String(b.contato).trim();
  if (b.telefone !== undefined) patch.telefone = b.telefone ? String(b.telefone).trim() : null;
  if (b.email !== undefined) patch.email = b.email ? String(b.email).trim() : null;
  if (b.estagio !== undefined) {
    if (!estagioValido(String(b.estagio))) {
      return NextResponse.json({ erro: 'Estágio inválido.' }, { status: 400 });
    }
    patch.estagio = b.estagio;
    if (b.probabilidade === undefined) patch.probabilidade = probabilidadeEstagio(String(b.estagio));
  }
  if (b.owner_id !== undefined) {
    if (b.owner_id) {
      const { data: ownerDaConta } = await supabaseAdmin()
        .from('perfis')
        .select('id')
        .eq('conta_id', perfil.conta_id)
        .eq('id', b.owner_id)
        .maybeSingle();
      if (!ownerDaConta) {
        return NextResponse.json({ erro: 'Responsável não pertence a esta conta.' }, { status: 400 });
      }
    }
    patch.owner_id = b.owner_id ?? null;
  }
  if (b.valor !== undefined) patch.valor = Number(b.valor) || 0;
  if (b.proxima_acao !== undefined) patch.proxima_acao = b.proxima_acao ?? null;
  if (b.observacoes !== undefined) patch.observacoes = b.observacoes ?? null;
  if (b.previsao_fechamento !== undefined) patch.previsao_fechamento = b.previsao_fechamento ?? null;
  if (b.probabilidade !== undefined) {
    const probabilidade = Number(b.probabilidade);
    if (!Number.isFinite(probabilidade) || probabilidade < 0 || probabilidade > 100) {
      return NextResponse.json({ erro: 'Probabilidade deve estar entre 0 e 100.' }, { status: 400 });
    }
    patch.probabilidade = probabilidade;
  }
  if (b.tags !== undefined) {
    patch.tags = Array.isArray(b.tags)
      ? b.tags.map((v: unknown) => String(v).trim()).filter(Boolean).slice(0, 20)
      : [];
  }
  if (b.motivo_perda !== undefined) patch.motivo_perda = b.motivo_perda ? String(b.motivo_perda).trim() : null;
  if (b.campanha_id !== undefined) {
    if (b.campanha_id) {
      const { data: campanha } = await supabaseAdmin().from('prospecta_campanhas').select('id')
        .eq('id', Number(b.campanha_id)).eq('conta_id', perfil.conta_id).maybeSingle();
      if (!campanha) return NextResponse.json({ erro: 'Campanha não pertence a esta conta.' }, { status: 400 });
    }
    patch.campanha_id = b.campanha_id ? Number(b.campanha_id) : null;
  }

  try {
    const backend = await crmBackend(perfil.conta_id);
    const op = await backend.atualizar(perfil.conta_id, opId, patch);
    if (!op) return NextResponse.json({ erro: 'Oportunidade não encontrada.' }, { status: 404 });
    return NextResponse.json({ oportunidade: op });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? 'Não consegui atualizar.' }, { status: 400 });
  }
}
