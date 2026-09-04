import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/funis/[id]/estagios → lista estágios do funil */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const admin = supabaseAdmin();

  // Verificar que o funil pertence à conta
  const { data: funil } = await admin
    .from('funis').select('id')
    .eq('id', id).eq('conta_id', perfil.conta_id ?? '').maybeSingle();

  // Super admin pode acessar qualquer funil
  if (!funil && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Funil não encontrado.' }, { status: 404 });
  }

  const { data: estagios, error } = await admin
    .from('funil_estagios').select('*')
    .eq('funil_id', id).order('ordem');

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ estagios: estagios ?? [] });
}

/** POST /api/funis/[id]/estagios → adiciona um estágio */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();

  // Verificar permissão
  const { data: funil } = await admin
    .from('funis').select('id')
    .eq('id', id).eq('conta_id', perfil.conta_id ?? '').maybeSingle();
  if (!funil && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Funil não encontrado.' }, { status: 404 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const nome = String(b.nome ?? '').trim();
  if (!nome) return NextResponse.json({ erro: 'Falta o nome do estágio.' }, { status: 400 });

  // Próxima ordem
  const { data: ultimo } = await admin
    .from('funil_estagios').select('ordem')
    .eq('funil_id', id).order('ordem', { ascending: false }).limit(1).maybeSingle();
  const proximaOrdem = (ultimo?.ordem ?? 0) + 1;

  const { data: estagio, error } = await admin
    .from('funil_estagios')
    .insert({
      funil_id: id,
      nome,
      ordem: Number(b.ordem) || proximaOrdem,
      grupo: b.grupo === 'encerrado' ? 'encerrado' : 'pipeline',
      probabilidade: Number(b.probabilidade) || 0,
    })
    .select('*').single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ estagio });
}
