import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { processarEventoInbound } from '@/lib/inbound';
import { normalizarTelefone } from '@/lib/telefone';
import { normalizarWebhookChatwoot } from '@/lib/inboundChatwoot';
import {recursoDaWorkspace} from '@/lib/servicosWorkspace';

export async function POST(req: Request) {
  const token = process.env.CHATWOOT_WEBHOOK_TOKEN;
  const recebido = Buffer.from(req.headers.get('x-webhook-token')??'');
  const esperado = Buffer.from(token??'');
  if (!token || recebido.length!==esperado.length || !timingSafeEqual(recebido,esperado))
    return NextResponse.json({erro:'Token inválido.'},{status:401});
  const body = await req.json().catch(()=>null);
  if (!body) return NextResponse.json({erro:'Payload inválido.'},{status:400});
  if (!['message_created','conversation_updated'].includes(body.event)) return NextResponse.json({ok:true,ignorado:true});
  const e = normalizarWebhookChatwoot(body);
  if (!e || e.privada || (!e.incoming&&!e.humano)) return NextResponse.json({ok:true,ignorado:true});
  const admin = supabaseAdmin();
  // Exatamente um tenant/inbox, sem ID institucional fixo e sem lookup por telefone.
  const {data:inboxes,error} = await admin.from('chatwoot_inboxes')
    .select('conta_id,whatsapp_canal_id').eq('chatwoot_account_id',e.accountId)
    .eq('chatwoot_inbox_id',e.inboxId).eq('ativo',true).limit(2);
  if (error) return NextResponse.json({erro:'Vínculo indisponível.'},{status:503});
  if (inboxes?.length!==1) return NextResponse.json({ok:true,ignorado:true,motivo:'vinculo_ausente_ou_ambiguo'});
  const vinculo = inboxes[0];
  if(!(await recursoDaWorkspace(admin,vinculo.conta_id,['integracoes.chatwoot','inbox.atendimento'])))return NextResponse.json({ok:true,ignorado:true,motivo:'integracao_nao_liberada'});
  const {data:crm,error:errCrm} = await admin.from('crm_vinculos').select('ativo')
    .eq('conta_id',vinculo.conta_id).eq('chatwoot_account_id',e.accountId).eq('ativo',true).maybeSingle();
  if (errCrm || !crm) return NextResponse.json({ok:true,ignorado:true});
  let canalId: number|null = null; let funilId: number|null = null;
  if (vinculo.whatsapp_canal_id) {
    const {data:canal,error:errCanal} = await admin.from('whatsapp_canais').select('id')
      .eq('conta_id',vinculo.conta_id).eq('id',vinculo.whatsapp_canal_id).eq('ativo',true).maybeSingle();
    if (errCanal || !canal) return NextResponse.json({erro:'Canal inválido.'},{status:409});
    canalId = canal.id;
    const {data:funis,error:errFunis} = await admin.from('funis').select('id')
      .eq('conta_id',vinculo.conta_id).eq('canal_padrao_id',canalId).eq('ativo',true).limit(2);
    if (errFunis) return NextResponse.json({erro:'Funil indisponível.'},{status:503});
    if (funis?.length===1) funilId=funis[0].id;
  }
  const telefone = normalizarTelefone(e.telefone);
  if (!telefone) return NextResponse.json({ok:true,ignorado:true});
  if (e.humano || e.atribuidaHumano) {
    if (canalId) {
      const {assumirBDR} = await import('@/lib/bdr');
      try { await assumirBDR(admin,vinculo.conta_id,canalId,telefone,null); }
      catch { return NextResponse.json({erro:'Falha ao pausar IA.'},{status:503}); }
    }
    if(!e.incoming)return NextResponse.json({ok:true,humano:true});
  }
  const resultado = await processarEventoInbound(admin,{provider:'chatwoot',telefone,
    mensagem:e.conteudo,messageIdExterno:String(e.id),mensagemFisicaId:e.sourceId,
    timestamp:e.timestamp,nomeContato:e.nome,tipoMensagem:e.conteudo?'texto':'midia',
    fromMe:false,payloadBruto:body},vinculo.conta_id,canalId,funilId);
  return NextResponse.json(resultado,{status:resultado.ok?200:503});
}
