import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string; estagioId: string }> };

/** PATCH /api/funis/[id]/estagios/[estagioId] → edita um estágio */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, estagioId } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();

  // Verificar que o estágio pertence ao funil da conta
  const { data: estagio } = await admin
    .from('funil_estagios').select('id, funil_id')
    .eq('id', estagioId).eq('funil_id', id).maybeSingle();
  if (!estagio) return NextResponse.json({ erro: 'Estágio não encontrado.' }, { status: 404 });

  const b = await req.json().catch(() => ({}) as any);
  const dados: Record<string, unknown> = {};
  if (typeof b.nome === 'string' && b.nome.trim()) dados.nome = b.nome.trim();
  if (typeof b.ordem === 'number' && b.ordem > 0) dados.ordem = b.ordem;
  if (b.grupo === 'pipeline' || b.grupo === 'encerrado') dados.grupo = b.grupo;
  if (typeof b.probabilidade === 'number') {
    dados.probabilidade = Math.min(100, Math.max(0, b.probabilidade));
  }

  if (!Object.keys(dados).length) return NextResponse.json({ ok: true });

  const { error } = await admin
    .from('funil_estagios').update(dados)
    .eq('id', estagioId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Se a ordem mudou, reordenar os outros
  if (typeof b.ordem === 'number') {
    const { data: todos } = await admin
      .from('funil_estagios').select('id, ordem')
      .eq('funil_id', id).order('ordem');

    if (todos) {
      const reordenados = todos
        .filter((e) => e.id !== estagioId)
        .sort((a, b) => a.ordem - b.ordem);
      // Inserir na posição correta
      reordenados.splice(b.ordem - 1, 0, { id: estagioId, ordem: b.ordem });
      for (let i = 0; i < reordenados.length; i++) {
        const novaOrdem = i + 1;
        if (reordenados[i].ordem !== novaOrdem) {
          await admin.from('funil_estagios').update({ ordem: novaOrdem }).eq('id', reordenados[i].id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/funis/[id]/estagios/[estagioId] → remove um estágio */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, estagioId } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();

  // Verificar que o estágio pertence ao funil da conta
  const { data: estagio } = await admin
    .from('funil_estagios').select('id, funil_id')
    .eq('id', estagioId).eq('funil_id', id).maybeSingle();
  if (!estagio) return NextResponse.json({ erro: 'Estágio não encontrado.' }, { status: 404 });

  // Não pode deletar o último estágio pipeline
  const { count } = await admin
    .from('funil_estagios')
    .select('id', { count: 'exact', head: true })
    .eq('funil_id', id).eq('grupo', 'pipeline');

  if (count && count <= 1) {
    return NextResponse.json({ erro: 'Não é possível remover o último estágio do pipeline.' }, { status: 400 });
  }

  const { error } = await admin
    .from('funil_estagios').delete()
    .eq('id', estagioId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Reordenar restantes
  const { data: todos } = await admin
    .from('funil_estagios').select('id')
    .eq('funil_id', id).order('ordem');
  if (todos) {
    for (let i = 0; i < todos.length; i++) {
      await admin.from('funil_estagios').update({ ordem: i + 1 }).eq('id', todos[i].id);
    }
  }

  return NextResponse.json({ ok: true });
}
