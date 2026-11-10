import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { listarInboxes } from '@/lib/chatwoot';
import {provisionarChatwoot,provisionamentoChatwootDisponivel} from '@/lib/chatwootProvisionamento';
import {perfilTemRecursos,auditarServico} from '@/lib/servicosWorkspace';
import {tipoCanalRecurso} from '@/lib/recursosRotas';

/**
 * GET /api/canais/chatwoot — lista inboxes do Chatwoot vinculados a esta conta.
 * POST — vincula/desvincula inboxes Chatwoot nesta conta.
 *
 * Não inventa suporte: consulta a API real do Chatwoot e mostra apenas
 * os canais que a instalação self-hosted efetivamente tem.
 *
 * Suporta múltiplos inboxes por conta (WhatsApp + Instagram + Messenger + Telegram + outros).
 */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });

  const admin = supabaseAdmin();
  if(perfil.papel==='operador'||!(await perfilTemRecursos(admin,perfil,['integracoes.chatwoot'])))return NextResponse.json({erro:'Integração restrita ao administrador autorizado.'},{status:403});

  // Buscar account_id Chatwoot da conta (de crm_vinculos ou do primeiro chatwoot_inbox)
  const { data: vinculo } = await admin
    .from('crm_vinculos')
    .select('chatwoot_account_id')
    .eq('conta_id', perfil.conta_id)
    .maybeSingle();

  const chatwootAccountId = vinculo?.chatwoot_account_id;

  // Buscar inboxes vinculados nesta conta
  const { data: inboxesVinculados } = await admin
    .from('chatwoot_inboxes')
    .select('*')
    .eq('conta_id', perfil.conta_id)
    .order('tipo_canal');

  // Se tem account_id, consultar inboxes disponíveis no Chatwoot
  let inboxesDisponiveis: Array<{ id: number; name: string; channel_type?: string }> = [];
  if (chatwootAccountId) {
    try {
      inboxesDisponiveis = await listarInboxes(chatwootAccountId);
    } catch (e) {
      return NextResponse.json({
        ok: false,
        configurado: true,
        chatwootAccountId,
        inboxes: inboxesVinculados ?? [],
        erro: e instanceof Error ? e.message : 'Erro ao consultar Chatwoot',
      }, { status: 502 });
    }
  }

  return NextResponse.json({
    ok: true,
    provisionamento_disponivel:provisionamentoChatwootDisponivel(),
    configurado: !!chatwootAccountId,
    chatwootAccountId,
    inboxes: inboxesVinculados ?? [],
    // Inboxes disponíveis no Chatwoot que ainda não estão vinculados
    disponiveis: chatwootAccountId
      ? inboxesDisponiveis
          .filter((i) => !(inboxesVinculados ?? []).some((v) => v.ativo&&v.chatwoot_inbox_id === i.id))
          .map((i) => ({
            id: i.id,
            nome: i.name,
            tipo: i.channel_type ?? 'desconhecido',
          }))
      : [],
  });
}

/**
 * POST /api/canais/chatwoot
 *
 * Ações:
 *   vincular   — vincula um inbox Chatwoot a esta conta
 *   desvincular — remove o vínculo de um inbox
 *   configurar  — define o chatwoot_account_id da conta
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}) as any);
  const admin = supabaseAdmin();
  const acao = String(b.acao ?? 'configurar');
  if(!(await perfilTemRecursos(admin,perfil,['integracoes.chatwoot'],'configurar')))return NextResponse.json({erro:'Chatwoot não liberado.'},{status:403});
  if(acao==='provisionar'){
    try{return NextResponse.json({ok:true,chatwootAccountId:await provisionarChatwoot(admin,perfil.conta_id,perfil.id)});}
    catch(e){return NextResponse.json({erro:e instanceof Error&&e.message==='chatwoot_platform_nao_configurada'?
      'A Figueira precisa provisionar a credencial Platform App e o usuário técnico autorizado do Chatwoot. Não é necessário criar a conta manualmente fora do Harvest.':
      'Provisionamento pendente de reconciliação pela Figueira. Nenhuma nova criação será repetida automaticamente.'},{status:409});}
  }
  // IDs remotos são a fronteira entre tenants e usam um token institucional.
  // Só o administrador da instalação pode criar/remover esses vínculos.
  if (acao==='configurar'&&perfil.papel!=='super_admin') {
    return NextResponse.json({erro:'Vínculos de infraestrutura Chatwoot exigem administrador da instalação.'},{status:403});
  }

  // --- Configurar account_id ---
  if (acao === 'configurar') {
    const chatwootAccountId = Number(b.chatwootAccountId);
    if (!Number.isSafeInteger(chatwootAccountId) || chatwootAccountId<1) {
      return NextResponse.json({ erro: 'chatwootAccountId inválido.' }, { status: 400 });
    }
    const {data:existente,error:ee}=await admin.from('crm_vinculos').select('chatwoot_account_id').eq('conta_id',perfil.conta_id).maybeSingle();
    if(ee||existente?.chatwoot_account_id&&existente.chatwoot_account_id!==chatwootAccountId)return NextResponse.json({erro:'A conta já tem vínculo. Migração exige revisão para preservar canais/histórico.'},{status:409});
    try{await listarInboxes(chatwootAccountId);}catch{return NextResponse.json({erro:'Conta remota não confirmada com a credencial autorizada.'},{status:409});}

    const { error } = await admin
      .from('crm_vinculos')
      .upsert({
        conta_id: perfil.conta_id,
        chatwoot_account_id: chatwootAccountId,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'conta_id' });

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    await auditarServico(admin,perfil.conta_id,perfil.id,'chatwoot_vinculo_configurado',{account_id:chatwootAccountId});
    return NextResponse.json({ ok: true, chatwootAccountId });
  }

  // --- Vincular inbox ---
  if (acao === 'vincular') {
    const inboxId = Number(b.chatwootInboxId);
    const tipoCanal = String(b.tipoCanal ?? 'outro').trim().toLowerCase();
    const nome = String(b.nome ?? '').trim();

    if (!Number.isSafeInteger(inboxId) || inboxId<1) {
      return NextResponse.json({ erro: 'chatwootInboxId inválido.' }, { status: 400 });
    }
    const tiposValidos = ['whatsapp', 'instagram', 'facebook', 'telegram', 'sms', 'email', 'widget', 'api', 'line', 'outro'];
    if (!tiposValidos.includes(tipoCanal)) {
      return NextResponse.json({ erro: `tipoCanal inválido. Use: ${tiposValidos.join(', ')}` }, { status: 400 });
    }

    // Buscar account_id do vínculo existente
    const { data: vinculo } = await admin
      .from('crm_vinculos')
      .select('chatwoot_account_id')
      .eq('conta_id', perfil.conta_id)
      .maybeSingle();

    if (!vinculo?.chatwoot_account_id) {
      return NextResponse.json({ erro: 'Configure o Chatwoot Account ID primeiro.' }, { status: 400 });
    }

    const disponiveis = await listarInboxes(vinculo.chatwoot_account_id).catch(()=>null);
    if (!disponiveis?.some(i=>i.id===inboxId))
      return NextResponse.json({erro:'Inbox não confirmada na conta Chatwoot vinculada.'},{status:409});
    const remoto=disponiveis.find(i=>i.id===inboxId)!;
    const tipos:Record<string,string>={'Channel::Instagram':'instagram','Channel::Facebook':'facebook','Channel::Whatsapp':'whatsapp','Channel::WebWidget':'widget','Channel::Api':'api'};
    const tipoReal=tipos[remoto.channel_type??'']??'outro';
    const recurso=tipoReal==='api'?'integracoes.chatwoot':tipoCanalRecurso(tipoReal==='widget'?'webchat':tipoReal);
    if(!(await perfilTemRecursos(admin,perfil,[recurso],'configurar')))return NextResponse.json({erro:'Canal não contratado.'},{status:403});
    const whatsappCanalId=b.whatsappCanalId??null;
    if (whatsappCanalId!==null) {
      if(!(await perfilTemRecursos(admin,perfil,['inbox.whatsapp'],'configurar')))return NextResponse.json({erro:'WhatsApp não contratado.'},{status:403});
      if (!Number.isSafeInteger(whatsappCanalId)||whatsappCanalId<1)
        return NextResponse.json({erro:'Canal WhatsApp inválido.'},{status:400});
      const {data:canal,error:errCanal}=await admin.from('whatsapp_canais').select('id')
        .eq('conta_id',perfil.conta_id).eq('id',whatsappCanalId).eq('ativo',true).maybeSingle();
      if(errCanal||!canal)return NextResponse.json({erro:'Canal não pertence à workspace.'},{status:403});
    }

    const { data: inbox, error } = await admin
      .from('chatwoot_inboxes')
      .upsert({
        conta_id: perfil.conta_id,
        chatwoot_account_id: vinculo.chatwoot_account_id,
        chatwoot_inbox_id: inboxId,
        whatsapp_canal_id:whatsappCanalId,
        tipo_canal: tipoReal,
        nome: remoto.name || nome || `Inbox ${inboxId}`,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'conta_id, chatwoot_inbox_id' })
      .select('*')
      .maybeSingle();

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    await auditarServico(admin,perfil.conta_id,perfil.id,'chatwoot_inbox_vinculada',{inbox_id:inboxId});
    return NextResponse.json({ ok: true, inbox });
  }

  // --- Desvincular inbox ---
  if (acao === 'desvincular') {
    const inboxId = Number(b.chatwootInboxId);
    if (!Number.isInteger(inboxId)) {
      return NextResponse.json({ erro: 'chatwootInboxId inválido.' }, { status: 400 });
    }

    const { error } = await admin
      .from('chatwoot_inboxes')
      .update({ativo:false,atualizado_em:new Date().toISOString()})
      .eq('conta_id', perfil.conta_id)
      .eq('chatwoot_inbox_id', inboxId);

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    await auditarServico(admin,perfil.conta_id,perfil.id,'chatwoot_inbox_desvinculada',{inbox_id:inboxId});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: `Ação desconhecida: ${acao}` }, { status: 400 });
}
