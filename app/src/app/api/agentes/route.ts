import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { tipoAgenteValido, validarConfiguracaoAgente, CATALOGO_AGENTES, TIPOS_AGENTE } from '@/lib/agentes';

async function contexto() {
  const perfil = await perfilAtual();
  if (!perfil) return { erro: 'Sessão expirada.', status: 401 } as const;
  if (!perfil.conta_id) return { erro: 'Selecione uma workspace.', status: 400 } as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'agentes'))) {
    return { erro: 'Módulo de agentes não habilitado nesta workspace.', status: 403 } as const;
  }
  return { perfil, admin } as const;
}

export async function GET() {
  const c = await contexto();
  if ('erro' in c) return NextResponse.json({ erro: c.erro }, { status: c.status });
  const { data, error } = await c.admin.from('agentes_workspace')
    .select('id,conta_id,tipo,nome,instrucao,ativo,atualizado_em')
    .eq('conta_id', c.perfil.conta_id!).order('id');
  if (error) return NextResponse.json({ erro: 'O catálogo dos agentes ainda não está disponível no banco.' }, { status: 503 });
  const agentes = TIPOS_AGENTE.map(tipo =>
    data?.find(a => a.tipo === tipo) ?? {
      id: null, conta_id: c.perfil.conta_id, tipo, ...CATALOGO_AGENTES[tipo], ativo: false, atualizado_em: null,
    }
  );
  return NextResponse.json({ agentes });
}

export async function PATCH(req: Request) {
  const c = await contexto();
  if ('erro' in c) return NextResponse.json({ erro: c.erro }, { status: c.status });
  if (c.perfil.papel === 'operador') return NextResponse.json({ erro: 'Somente administradores podem configurar agentes.' }, { status: 403 });

  const b = await req.json().catch(() => null);
  if (!b || !tipoAgenteValido(b.tipo)) return NextResponse.json({ erro: 'Tipo de agente inválido.' }, { status: 400 });
  const falha = validarConfiguracaoAgente(b.nome, b.instrucao);
  if (falha) return NextResponse.json({ erro: falha }, { status: 400 });
  if (typeof b.ativo !== 'boolean') return NextResponse.json({ erro: 'Estado do agente inválido.' }, { status: 400 });

  const { data, error } = await c.admin.from('agentes_workspace').upsert({
    conta_id: c.perfil.conta_id,
    tipo: b.tipo,
    nome: b.nome.trim(),
    instrucao: b.instrucao.trim(),
    ativo: b.ativo,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'conta_id,tipo' }).select('id,conta_id,tipo,nome,instrucao,ativo,atualizado_em').single();
  if (error) return NextResponse.json({ erro: 'Não foi possível salvar o agente.' }, { status: 500 });
  return NextResponse.json({ agente: data });
}
