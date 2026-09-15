import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/funis/[id]/automacoes — lista automações do funil
 * POST /api/funis/[id]/automacoes — cria uma automação
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const admin = supabaseAdmin();

  // Verificar que o funil pertence à conta
  const { data: funil } = await admin
    .from('funis').select('id')
    .eq('id', id).eq('conta_id', perfil.conta_id ?? '').maybeSingle();
  if (!funil && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Funil não encontrado.' }, { status: 404 });
  }

  const { data: automacoes, error } = await admin
    .from('funil_automacoes')
    .select('*, estagio:funil_estagios(id, nome, ordem)')
    .eq('funil_id', id)
    .order('id');

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ automacoes: automacoes ?? [] });
}

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
    .from('funis').select('id, conta_id')
    .eq('id', id).eq('conta_id', perfil.conta_id ?? '').maybeSingle();
  if (!funil && perfil.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Funil não encontrado.' }, { status: 404 });
  }

  const b = await req.json().catch(() => ({}) as any);

  // Validação
  const nome = String(b.nome ?? '').trim();
  if (!nome) return NextResponse.json({ erro: 'Falta o nome da automação.' }, { status: 400 });

  const gatilhosValidos = [
    'mensagem_recebida', 'resposta_positiva', 'resposta_negativa',
    'opt_out', 'oportunidade_entrando_estagio', 'oportunidade_saindo_estagio',
  ];
  const gatilho = String(b.gatilho ?? '');
  if (!gatilhosValidos.includes(gatilho)) {
    return NextResponse.json({ erro: `Gatilho inválido. Use: ${gatilhosValidos.join(', ')}` }, { status: 400 });
  }

  const acoesValidas = [
    'mover_estagio', 'atribuir_responsavel', 'atribuir_equipe',
    'adicionar_etiqueta', 'registrar_atividade', 'notificar_usuario',
    'iniciar_bot', 'encerrar_oportunidade',
  ];
  const acao = String(b.acao ?? '');
  if (!acoesValidas.includes(acao)) {
    return NextResponse.json({ erro: `Ação inválida. Use: ${acoesValidas.join(', ')}` }, { status: 400 });
  }

  // estagio_id obrigatório
  const estagioId = Number(b.estagio_id);
  if (!Number.isInteger(estagioId)) {
    return NextResponse.json({ erro: 'Falta o estagio_id (estágio onde a automação atua).' }, { status: 400 });
  }

  // Verificar que o estágio pertence ao funil
  const { data: estagio } = await admin
    .from('funil_estagios').select('id')
    .eq('id', estagioId).eq('funil_id', id).maybeSingle();
  if (!estagio) {
    return NextResponse.json({ erro: 'Estágio não encontrado neste funil.' }, { status: 400 });
  }

  // Se ação é mover_estagio, exigir estagio_destino_id
  if (acao === 'mover_estagio') {
    const destinoId = b.acao_parametros?.estagio_destino_id;
    if (!Number.isInteger(Number(destinoId))) {
      return NextResponse.json({ erro: 'Ação "mover_estagio" requer acao_parametros.estagio_destino_id.' }, { status: 400 });
    }
  }

  const contaId = funil?.conta_id ?? perfil.conta_id;

  const { data: automacao, error } = await admin
    .from('funil_automacoes')
    .insert({
      conta_id: contaId,
      funil_id: Number(id),
      estagio_id: estagioId,
      nome,
      gatilho,
      acao,
      condicao: b.condicao ?? {},
      acao_parametros: b.acao_parametros ?? {},
      ativo: b.ativo !== false,
    })
    .select('*, estagio:funil_estagios(id, nome, ordem)')
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ automacao });
}
