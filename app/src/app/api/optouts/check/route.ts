import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { podeSobrescreverOptOut, registrarOverride, estaEmOptOut } from '@/lib/optout';
import { normalizarTelefone } from '@/lib/telefone';

/**
 * POST /api/optouts/check — verifica opt-out e permissão de override
 *
 * Usado pelo frontend antes de enviar mensagem.
 * Retorna: { bloqueado: boolean, optOut?: {...}, podeSobrescrever?: boolean, motivo?: string }
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const b = await req.json().catch(() => ({}) as any);
  const telefone = String(b.telefone ?? '').trim();
  if (!telefone) return NextResponse.json({ erro: 'Informe o telefone.' }, { status: 400 });

  const admin = supabaseAdmin();
  const optOut = await estaEmOptOut(admin, perfil.conta_id, telefone);

  if (!optOut) {
    return NextResponse.json({ bloqueado: false });
  }

  // Contato tem opt-out ativo — verificar se pode sobrescrever
  const permissao = await podeSobrescreverOptOut(admin, perfil.conta_id, perfil.id, perfil.papel);

  return NextResponse.json({
    bloqueado: true,
    optOut: {
      id: optOut.id,
      data: optOut.criado_em,
      motivo: optOut.motivo,
      mensagem: optOut.mensagem_geradora,
    },
    podeSobrescrever: permissao.permitido,
    motivo: permissao.motivo,
    politica: await (await import('@/lib/optout')).buscarPolitica(admin, perfil.conta_id),
  });
}

/**
 * PUT /api/optouts/check — registrar override + enviar
 *
 * Body: { optOutId, telefone, motivo, campanhaId?, oportunidadeId?, canalId?, canalNome? }
 */
export async function PUT(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const b = await req.json().catch(() => ({}) as any);
  const {
    optOutId, telefone, motivo,
    campanhaId = null, oportunidadeId = null, canalId = null, canalNome = null,
  } = b;

  if (!optOutId || !telefone || !motivo?.trim()) {
    return NextResponse.json({ erro: 'Dados incompletos para override.' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Verificar permissão
  const permissao = await podeSobrescreverOptOut(admin, perfil.conta_id, perfil.id, perfil.papel);
  if (!permissao.permitido) {
    return NextResponse.json({ erro: permissao.motivo, bloqueado: true }, { status: 403 });
  }

  // Registrar auditoria
  const resultado = await registrarOverride(admin, {
    contaId: perfil.conta_id,
    optOutId: Number(optOutId),
    telefone: normalizarTelefone(telefone) ?? telefone,
    autorizadoPor: perfil.id,
    autorizadoPorTipo: perfil.papel === 'super_admin' ? 'super_admin' : 'admin',
    motivo,
    campanhaId: campanhaId ? Number(campanhaId) : null,
    oportunidadeId: oportunidadeId ? Number(oportunidadeId) : null,
    canalId: canalId ? Number(canalId) : null,
    canalNome: canalNome ?? null,
  });

  if (!resultado.ok) return NextResponse.json({ erro: resultado.erro }, { status: 500 });
  return NextResponse.json({ ok: true, overrideId: resultado.ok });
}
