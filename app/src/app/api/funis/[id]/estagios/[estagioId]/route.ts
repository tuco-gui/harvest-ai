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
  // Segurança: validar o funil na workspace ativa antes de consultar
  // ou modificar qualquer etapa por ID (inclusive super_admin).
  const {data:funil}=await admin.from('funis').select('id')
    .eq('id',id).eq('conta_id',perfil.conta_id??'').maybeSingle();
  if(!funil)return NextResponse.json({erro:'Funil não encontrado nesta workspace.'},{status:404});

  // Verificar que o estágio pertence ao funil da conta
  const { data: estagio } = await admin
    .from('funil_estagios').select('id, funil_id, grupo')
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
  if (typeof b.cor === 'string' && b.cor.match(/^#[0-9a-fA-F]{6}$/)) dados.cor = b.cor;

  if (!Object.keys(dados).length) return NextResponse.json({ ok: true });

  const { error } = await admin
    .from('funil_estagios').update(dados)
    .eq('id', estagioId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Se a ordem mudou, reordenar os outros
  if (typeof b.ordem === 'number') {
    const { data: todos } = await admin
      .from('funil_estagios').select('id, ordem')
      .eq('funil_id', id).eq('grupo',b.grupo==='encerrado'?'encerrado':b.grupo==='pipeline'?'pipeline':estagio.grupo).order('ordem');

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
  // Segurança: validar o funil na workspace ativa antes de consultar
  // ou modificar qualquer etapa por ID (inclusive super_admin).
  const {data:funil}=await admin.from('funis').select('id')
    .eq('id',id).eq('conta_id',perfil.conta_id??'').maybeSingle();
  if(!funil)return NextResponse.json({erro:'Funil não encontrado nesta workspace.'},{status:404});

  // Verificar que o estágio pertence ao funil da conta
  const { data: estagio } = await admin
    .from('funil_estagios').select('id, funil_id, grupo')
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

  // Nunca eliminar uma etapa com negócios associados por engano ao editar
  // o pipeline em lote. A transferência deve ser explícita antes da exclusão.
  const {count:emUso,error:erroUso}=await admin.from('oportunidades')
    .select('id',{count:'exact',head:true})
    .eq('conta_id',perfil.conta_id??'')
    .eq('funil_id',id).eq('funil_estagio_id',estagioId);
  if(erroUso)return NextResponse.json({erro:'Falha ao validar uso do estágio.'},{status:503});
  if((emUso??0)>0)return NextResponse.json({
    erro:'Esta etapa possui '+emUso+' negócio(s). Mova-os antes de excluir.',
  },{status:409});

  const { error } = await admin
    .from('funil_estagios').delete()
    .eq('id', estagioId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Reordenar restantes
  const { data: todos } = await admin
    .from('funil_estagios').select('id,grupo')
    .eq('funil_id', id).order('ordem');
  if (todos) {
    for (const grupo of ['pipeline','encerrado']) {
      const etapas=todos.filter(t=>t.grupo===grupo);
      for(let i=0;i<etapas.length;i++){
        const {error:erroOrdem}=await admin.from('funil_estagios')
          .update({ordem:i+1}).eq('id',etapas[i].id).eq('funil_id',id);
        if(erroOrdem)return NextResponse.json({erro:'Falha ao reordenar estágios.'},{status:500});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
