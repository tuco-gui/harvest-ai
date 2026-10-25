import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { prazoTriagem } from '@/lib/crmEtiquetas';
import { montarConversasPorCanal, operadorPodeVerConversa, responsaveisDaWorkspace,
  telefoneAtendimento, validarAlteracaoAtendimento, validarCanalAtendimento } from '@/lib/crmAtendimentos';

async function contexto() {
  const perfil = await perfilAtual();
  if (!perfil) return { erro: NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 }) } as const;
  if (!perfil.conta_id) return { erro: NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 }) } as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) {
    return { erro: NextResponse.json({ erro: 'Inbox CRM não habilitada nesta workspace.' }, { status: 403 }) } as const;
  }
  return { perfil, admin } as const;
}

export async function GET() {
  const c = await contexto();
  if ('erro' in c) return c.erro;
  const { perfil, admin } = c;
  // Nenhuma mensagem é copiada. Dados da Inbox são consultados na origem.
  const [eventos, meta, metaCanal] = await Promise.all([
    admin.from('inbound_eventos')
      .select('telefone,nome_contato,mensagem,recebido_em,lead_id,canal_id,funil_id')
      .eq('conta_id', perfil.conta_id).order('recebido_em', { ascending: false }).limit(500),
    admin.from('crm_atendimentos')
      .select('telefone,status,responsavel_id,etiquetas,atualizado_em,prioridade,prazo_triagem_em,resolvido_em')
      .eq('conta_id', perfil.conta_id).limit(500),
    admin.from('crm_atendimentos_canais')
      .select('telefone,canal_id,status,responsavel_id,etiquetas,atualizado_em,prioridade,prazo_triagem_em,resolvido_em')
      .eq('conta_id',perfil.conta_id).limit(1000),
  ]);
  if (eventos.error || meta.error || metaCanal.error) {
    return NextResponse.json({ erro: 'Central de atendimento indisponível. Verifique a migração 036.' }, { status: 503 });
  }
  const legados=(meta.data??[]).map(m=>({...m,canal_id:null}));
  const conversas=montarConversasPorCanal(eventos.data??[],[...legados,...(metaCanal.data??[])],perfil);
  try {
    const responsaveis = isAdmin(perfil.papel)
      ? await responsaveisDaWorkspace(admin, perfil) : [];
    return NextResponse.json({
      conversas, responsaveis, podeAtribuir: isAdmin(perfil.papel),
      aviso: 'Lista limitada às 500 mensagens recebidas mais recentes desta workspace.',
    });
  } catch {
    return NextResponse.json({ erro: 'Falha ao carregar os responsáveis.' }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const c = await contexto();
  if ('erro' in c) return c.erro;
  const { perfil, admin } = c;
  const body = await req.json().catch(() => null);
  const telefone = telefoneAtendimento(body?.telefone);
  if (!telefone) return NextResponse.json({ erro: 'Telefone inválido.' }, { status: 400 });
  const canalId=validarCanalAtendimento(body?.canal_id);
  if(canalId===undefined)return NextResponse.json({erro:'Canal inválido.'},{status:400});
  const tabela=canalId===null?'crm_atendimentos':'crm_atendimentos_canais';
  const valido = validarAlteracaoAtendimento(body, isAdmin(perfil.papel));
  if ('erro' in valido) return NextResponse.json({ erro: valido.erro }, { status: 400 });

  let origem=admin.from('inbound_eventos').select('id').eq('conta_id',perfil.conta_id)
    .eq('telefone',telefone);
  origem=canalId===null?origem.is('canal_id',null):origem.eq('canal_id',canalId);
  const {data:existe,error:erroOrigem}=await origem.limit(1).maybeSingle();
  if (erroOrigem) return NextResponse.json({ erro: 'Falha ao verificar a conversa.' }, { status: 503 });
  if (!existe) return NextResponse.json({ erro: 'Esta conversa não existe na Inbox desta workspace.' }, { status: 404 });

  let buscaAtual=admin.from(tabela).select('responsavel_id')
    .eq('conta_id',perfil.conta_id).eq('telefone',telefone);
  if(canalId!==null)buscaAtual=buscaAtual.eq('canal_id',canalId);
  const {data:atual,error:erroMeta}=await buscaAtual.maybeSingle();
  if (erroMeta) return NextResponse.json({ erro: 'Falha ao verificar o responsável.' }, { status: 503 });
  if (!operadorPodeVerConversa(perfil, atual)) {
    return NextResponse.json({ erro: 'Você não está atribuído a este atendimento.' }, { status: 403 });
  }
  // Exigir etiquetas do catalogo da workspace, sem nomes inventados
  // nem aceitar cores enviadas pelo navegador.
  if (valido.etiquetas.length) {
    const { data: catalogo, error: erroTags } = await admin.from('crm_etiquetas')
      .select('nome').eq('conta_id', perfil.conta_id).in('nome', valido.etiquetas);
    if (erroTags) return NextResponse.json({ erro: 'Falha ao validar etiquetas.' }, { status: 503 });
    if ((catalogo ?? []).length !== valido.etiquetas.length) {
      return NextResponse.json({ erro: 'Selecione etiquetas existentes no catálogo.' }, { status: 400 });
    }
  }
  let responsavelId = atual?.responsavel_id ?? null;
  if (isAdmin(perfil.papel)) {
    responsavelId = valido.responsavel_id;
    if (responsavelId) {
      const membros = await responsaveisDaWorkspace(admin, perfil).catch(() => null);
      if (!membros) return NextResponse.json({ erro: 'Não foi possível validar a equipe.' }, { status: 503 });
      if (!membros.some(x => x.id === responsavelId)) {
        return NextResponse.json({ erro: 'O responsável não pertence à workspace ativa.' }, { status: 403 });
      }
    }
  }
  let buscaRecente=admin.from('inbound_eventos').select('recebido_em')
    .eq('conta_id',perfil.conta_id).eq('telefone',telefone);
  buscaRecente=canalId===null?buscaRecente.is('canal_id',null):buscaRecente.eq('canal_id',canalId);
  const {data:recente,error:errRecente}=await buscaRecente.order('recebido_em',{ascending:false}).limit(1).maybeSingle();
  if (errRecente || !recente) return NextResponse.json({ erro: 'Não foi possível calcular o prazo.' }, { status: 503 });
  const prazo = prazoTriagem(recente.recebido_em, valido.prioridade);
  const { data, error } = await admin.from(tabela).upsert({
    conta_id: perfil.conta_id, telefone, ...(canalId===null?{}:{canal_id:canalId}),
    status: valido.status,
    etiquetas: valido.etiquetas, prioridade: valido.prioridade,
    prazo_triagem_em: prazo,
    resolvido_em: valido.status === 'resolvido' ? new Date().toISOString() : null,
    responsavel_id: responsavelId,
    atualizado_por: perfil.id, atualizado_em: new Date().toISOString(),
  }, { onConflict: canalId===null?'conta_id,telefone':'conta_id,telefone,canal_id' })
    .select('telefone,status,etiquetas,responsavel_id,atualizado_em,prioridade,prazo_triagem_em,resolvido_em').single();
  if (error || !data) return NextResponse.json({ erro: 'Não foi possível salvar o atendimento.' }, { status: 500 });
  return NextResponse.json({ atendimento: {...data,canal_id:canalId}, envioRealizado: false });
}
