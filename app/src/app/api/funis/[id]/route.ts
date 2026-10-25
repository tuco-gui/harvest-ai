import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/funis/[id] → detalhe do funil com seus estágios */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const admin = supabaseAdmin();
  const [{ data: funil }, { data: estagios }] = await Promise.all([
    admin.from('funis').select('id, nome, ativo, criado_em, canal_padrao_id, auto_criar_negocio_inbound')
      .eq('id', id).eq('conta_id', perfil.conta_id).maybeSingle(),
    admin.from('funil_estagios').select('*')
      .eq('funil_id', id).order('ordem'),
  ]);

  if (!funil) return NextResponse.json({ erro: 'Funil não encontrado.' }, { status: 404 });
  return NextResponse.json({ funil, estagios: estagios ?? [] });
}

/** PATCH /api/funis/[id] → renomeia ou ativa/desativa */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const dados: Record<string, unknown> = {};
  if (typeof b.nome === 'string' && b.nome.trim()) dados.nome = b.nome.trim();
  if (typeof b.ativo === 'boolean') dados.ativo = b.ativo;
  if (Object.prototype.hasOwnProperty.call(b,'canal_padrao_id')) {
    if (b.canal_padrao_id === null) dados.canal_padrao_id = null;
    else {
      const idCanal = Number(b.canal_padrao_id);
      if (!Number.isSafeInteger(idCanal) || idCanal <= 0)
        return NextResponse.json({erro:'Identificador de canal inválido.'},{status:400});
      const adminCanal = supabaseAdmin();
      const {data:valido,error:erroCanal} = await adminCanal.from('whatsapp_canais')
        .select('id,status').eq('id',idCanal)
        .eq('conta_id',perfil.conta_id).eq('ativo',true).maybeSingle();
      if (erroCanal || !valido)
        return NextResponse.json({erro:'Canal não pertence à workspace ou está inativo.'},{status:400});
      dados.canal_padrao_id = valido.id;
    }
  }
  if (!perfil.conta_id) return NextResponse.json({erro:'Selecione uma workspace.'},{status:400});
  if(Object.prototype.hasOwnProperty.call(b,'auto_criar_negocio_inbound')) {
    if(typeof b.auto_criar_negocio_inbound!=='boolean')
      return NextResponse.json({erro:'Ativação inválida.'},{status:400});
    const adminAtivacao=supabaseAdmin();
    if(!(await perfilTemModulo(adminAtivacao,perfil,'crm_avancado')))
      return NextResponse.json({erro:'Recurso disponível apenas no CRM avançado.'},{status:403});
    if(b.auto_criar_negocio_inbound===true) {
      const {data:funilAtual}=await adminAtivacao.from('funis')
        .select('id,ativo,canal_padrao_id').eq('conta_id',perfil.conta_id).eq('id',id).maybeSingle();
      if(!funilAtual?.ativo)
        return NextResponse.json({erro:'Não é possível ativar automação em funil inativo.'},{status:400});
      const canalId=(dados.canal_padrao_id??funilAtual.canal_padrao_id) as number|null;
      if(!canalId)
        return NextResponse.json({erro:'Vincule um canal WhatsApp ao funil antes de ativar.'},{status:400});
      const {data:canal}=await adminAtivacao.from('whatsapp_canais')
        .select('id,status').eq('id',canalId).eq('conta_id',perfil.conta_id)
        .eq('ativo',true).maybeSingle();
      if(canal?.status!=='conectado')
        return NextResponse.json({erro:'O canal deve estar conectado.'},{status:400});
      const {data:compartilhados}=await adminAtivacao.from('funis').select('id')
        .eq('conta_id',perfil.conta_id).eq('ativo',true)
        .eq('canal_padrao_id',canalId).limit(3);
      if((compartilhados??[]).some(f=>f.id!==Number(id)))
        return NextResponse.json({erro:'Esse canal é compartilhado com outro funil; escolha um número exclusivo.'},{status:409});
    }
    dados.auto_criar_negocio_inbound=b.auto_criar_negocio_inbound;
  }
  dados.atualizado_em = new Date().toISOString();

  if (!Object.keys(dados).length) return NextResponse.json({ ok: true });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('funis').update(dados)
    .eq('id', id).eq('conta_id', perfil.conta_id)
    .select('id,canal_padrao_id,auto_criar_negocio_inbound').maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if(!data) return NextResponse.json({erro:'Funil não pertence à workspace.'},{status:404});
  return NextResponse.json({ ok: true, funil:data });
}

/** DELETE /api/funis/[id] → soft-delete (ativo=false) */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const admin = supabaseAdmin();

  // Não pode deletar se há campanhas ativas usando este funil
  const { count } = await admin
    .from('prospecta_campanhas')
    .select('id', { count: 'exact', head: true })
    .eq('funil_id', id)
    .in('status', ['rascunho', 'agendada', 'em_execucao', 'pausada']);

  if (count && count > 0) {
    return NextResponse.json({
      erro: `Este funil está em uso por ${count} campanha(s) ativa(s). Desative-o em vez de excluir.`,
    }, { status: 400 });
  }

  const { error } = await admin
    .from('funis').update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id).eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
