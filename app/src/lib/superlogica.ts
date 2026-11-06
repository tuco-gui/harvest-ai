import type { SupabaseClient } from '@supabase/supabase-js';
import { CODIGO_ALEA } from './bdrPolitica.ts';

export type CapturaLead = { chave: string; nome: string; telefone: string | null; email: string | null;
  origem: Record<string,string>; leadId?: number | null };
const FONTES = ['source_channel','utm_source','utm_medium','utm_campaign','gclid','fbclid','anuncio','referral'];
export function origemImutavel(input: Record<string, unknown>): Record<string,string> {
  return Object.fromEntries(FONTES.filter(k=>typeof input[k]==='string')
    .map(k=>[k,String(input[k]).slice(0,500)]));
}
export async function capturarLeadSuperlogica(admin: SupabaseClient, contaId: string, lead: CapturaLead) {
  const {data,error} = await admin.rpc('superlogica_capturar', {p_conta:contaId,p_chave:lead.chave,
    p_nome:lead.nome,p_telefone:lead.telefone,p_email:lead.email?.toLowerCase()??null,
    p_origem:origemImutavel(lead.origem),p_lead:lead.leadId??null});
  if (error) throw Error('captura_crm_falhou');
  return data as string | null;
}
export type ResultadoCRM = { status: 'cadastrado' | 'retry' | 'reconciliar'; id?: string; erro?: string };
/** O bridge n8n deve confirmar entrega ao CRM, não apenas recebimento pelo webhook.
 * timeout/5xx/JSON inválido: consultar LEADS, nunca repetir /cliente às cegas. */
export async function chamarBridgeSuperlogica(payload: Record<string,unknown>): Promise<ResultadoCRM> {
  const url = process.env.REALIZE_SUPERLOGICA_N8N_URL;
  const token = process.env.REALIZE_SUPERLOGICA_N8N_TOKEN;
  if (!url || !token) return {status:'retry',erro:'bridge_nao_configurado'};
  try {
    const r = await fetch(url, {method:'POST',redirect:'error',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({...payload,codigo_anuncio:CODIGO_ALEA}),signal:AbortSignal.timeout(20_000)});
    if (!r.ok) return {status:'reconciliar',erro:'resposta_bridge_ambigua'};
    const d = await r.json();
    if (d.status==='cadastrado' && d.confirmado_crm===true)
      return {status:'cadastrado',id:typeof d.id_superlogica==='string'?d.id_superlogica.slice(0,200):undefined};
    // Somente a garantia explícita de que o POST não ocorreu permite retentar.
    if (d.status==='nao_enviado' && d.post_executado===false) return {status:'retry',erro:'crm_nao_enviado'};
    return {status:'reconciliar',erro:'confirmacao_crm_pendente'};
  } catch { return {status:'reconciliar',erro:'resultado_crm_incerto'}; }
}
export async function sincronizarSuperlogica(admin: SupabaseClient, contaId: string) {
  // O bridge usa a credencial Realize. Nunca pode atender outro tenant por fallback.
  if (!(process.env.REALIZE_SUPERLOGICA_WORKSPACES??'').split(',').map(x=>x.trim()).includes(contaId)) return;
  const {data:cfg,error:errCfg} = await admin.from('bdr_config').select('crm_habilitado,responsavel_crm_confirmado')
    .eq('conta_id',contaId).maybeSingle();
  if (errCfg || !cfg?.crm_habilitado || !cfg.responsavel_crm_confirmado) return;
  // Crash após POST: registros processando são somente reconciliados.
  await admin.from('superlogica_registros').update({status_sincronizacao:'reconciliar',erro_tecnico:'execucao_interrompida'})
    .eq('conta_id',contaId).eq('status_sincronizacao','processando')
    .lt('atualizado_em',new Date(Date.now()-180_000).toISOString());
  const {data:registros,error} = await admin.from('superlogica_registros').select('*').eq('conta_id',contaId)
    .in('status_sincronizacao',['pendente','retry','reconciliar']).lte('proxima_tentativa',new Date().toISOString()).limit(3);
  if (error) throw Error('fila_crm_indisponivel');
  for (const reg of registros??[]) {
    const agora = new Date().toISOString();
    const {data:reserva,error:erroReserva} = await admin.from('superlogica_registros')
      .update({status_sincronizacao:'processando',tentativas:reg.tentativas+1,atualizado_em:agora})
      .eq('conta_id',contaId).eq('id',reg.id).eq('status_sincronizacao',reg.status_sincronizacao)
      .eq('tentativas',reg.tentativas).select('id').maybeSingle();
    if (erroReserva || !reserva) continue;
    const resultado = await chamarBridgeSuperlogica({acao:reg.status_sincronizacao==='reconciliar'?'consultar':'cadastrar',
      tenant_id:contaId,idempotency_key:reg.id,lead_id_harvest:reg.lead_id_harvest,
      cliente:reg.nome,telefone:reg.telefone,email:reg.email,midia:reg.origem.source_channel,
      comentarioLead:JSON.stringify({origem:reg.origem,pre_atendimento:true})});
    // Depois de uma consulta ambígua, continua consulta; nunca retorna ao POST.
    const status = reg.status_sincronizacao==='reconciliar' && resultado.status==='retry'?'reconciliar':resultado.status;
    await admin.from('superlogica_registros').update({status_sincronizacao:status,
      id_superlogica:resultado.id??reg.id_superlogica,erro_tecnico:resultado.erro??null,
      proxima_tentativa:new Date(Date.now()+Math.min(86_400_000,60_000*2**Math.min(reg.tentativas,10))).toISOString(),
      atualizado_em:new Date().toISOString()}).eq('conta_id',contaId).eq('id',reg.id).eq('tentativas',reg.tentativas+1);
  }
}
