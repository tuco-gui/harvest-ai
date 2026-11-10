import type { SupabaseClient } from '@supabase/supabase-js';
import { CODIGO_ALEA } from './bdrPolitica.ts';
import {recursoDaWorkspace} from './servicosWorkspace.ts';

export type CapturaLead = { chave: string; nome: string; telefone: string | null; email: string | null;
  origem: Record<string,string>; leadId?: number | null };
const FONTES = ['source_channel','utm_source','utm_medium','utm_campaign','utm_term','utm_content','renda_familiar','protocolo','gclid','fbclid','anuncio','referral'];
export function origemImutavel(input: Record<string, unknown>): Record<string,string> {
  return Object.fromEntries(FONTES.filter(k=>typeof input[k]==='string')
    .map(k=>[k,String(input[k]).slice(0,500)]));
}
export async function capturarLeadSuperlogica(admin: SupabaseClient, contaId: string, lead: CapturaLead) {
  if(!(await recursoDaWorkspace(admin,contaId,['integracoes.superlogica'],'configurar')))throw Error('recurso_nao_liberado');
  const {data,error} = await admin.rpc('superlogica_capturar', {p_conta:contaId,p_chave:lead.chave,
    p_nome:lead.nome,p_telefone:lead.telefone,p_email:lead.email?.toLowerCase()??null,
    p_origem:origemImutavel(lead.origem),p_lead:lead.leadId??null});
  if (error) throw Error('captura_crm_falhou');
  return data as string | null;
}
export type ResultadoCRM = { status: 'cadastrado' | 'retry' | 'reconciliar'; id?: string; erro?: string };
/** Evidência operativa da regra oficial de time, não parâmetro não documentado da API ZAPIER. */
export function distribuicaoRealizeValidada(v:any):boolean{
  return !!v&&v.nome==='SYLVIO GUILHERME FRANÇA JUNIOR'&&typeof v.usuario_id==='string'&&!!v.usuario_id.trim()&&
    typeof v.time_id==='string'&&!!v.time_id.trim()&&v.ativo===true&&v.recebe_leads===true&&v.elegivel===true&&
    v.regra==='fixo'&&v.codigo_anuncio===CODIGO_ALEA&&typeof v.evidencia==='string'&&v.evidencia.length>=20&&
    typeof v.verificado_em==='string'&&Number.isFinite(Date.parse(v.verificado_em));
}
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
    if (d.status==='cadastrado' && d.confirmado_crm===true && d.origem_confirmacao==='api_leads' &&
      d.codigo_anuncio===CODIGO_ALEA && d.tenant_id===payload.tenant_id && d.idempotency_key===payload.idempotency_key &&
      typeof d.id_superlogica==='string' && d.id_superlogica.trim())
      return {status:'cadastrado',id:d.id_superlogica.slice(0,200)};
    // Somente a garantia explícita de que o POST não ocorreu permite retentar.
    if (d.status==='nao_enviado' && d.post_executado===false) return {status:'retry',erro:'crm_nao_enviado'};
    return {status:'reconciliar',erro:'confirmacao_crm_pendente'};
  } catch { return {status:'reconciliar',erro:'resultado_crm_incerto'}; }
}
export async function sincronizarSuperlogica(admin: SupabaseClient, contaId: string) {
  // O bridge usa a credencial Realize. Nunca pode atender outro tenant por fallback.
  if (!(process.env.REALIZE_SUPERLOGICA_WORKSPACES??'').split(',').map(x=>x.trim()).includes(contaId)) return;
  if(!(await recursoDaWorkspace(admin,contaId,['integracoes.superlogica'],'configurar')))return;
  const {data:cfg,error:errCfg} = await admin.from('bdr_config').select('*')
    .eq('conta_id',contaId).maybeSingle();
  if (errCfg || !cfg?.crm_habilitado || !cfg.responsavel_crm_confirmado) return;
  // Crash após POST: registros processando são somente reconciliados.
  await admin.from('superlogica_registros').update({status_sincronizacao:'reconciliar',erro_tecnico:'execucao_interrompida'})
    .eq('conta_id',contaId).eq('status_sincronizacao','processando')
    .lt('atualizado_em',new Date(Date.now()-180_000).toISOString());
  const distribuicaoValidada=distribuicaoRealizeValidada(cfg.distribuicao_crm_validada);
  if(!distribuicaoValidada)await admin.from('superlogica_registros').update({erro_tecnico:'distribuicao_inicial_sylvio_nao_homologada'})
    .eq('conta_id',contaId).in('status_sincronizacao',['pendente','retry']);
  const {data:registros,error} = await admin.from('superlogica_registros').select('*').eq('conta_id',contaId)
    .in('status_sincronizacao',distribuicaoValidada?['pendente','retry','reconciliar']:['reconciliar']).lte('proxima_tentativa',new Date().toISOString()).limit(3);
  if (error) throw Error('fila_crm_indisponivel');
  for (const reg of registros??[]) {
    if(reg.status_sincronizacao!=='reconciliar'&&!distribuicaoRealizeValidada(cfg.distribuicao_crm_validada)){
      await admin.from('superlogica_registros').update({erro_tecnico:'distribuicao_inicial_sylvio_nao_homologada'})
        .eq('conta_id',contaId).eq('id',reg.id).eq('status_sincronizacao',reg.status_sincronizacao);
      continue; // Preserva captura e protocolos. Nenhum cadastro com responsável padrão incorreto.
    }
    const agora = new Date().toISOString();
    const {data:reserva,error:erroReserva} = await admin.from('superlogica_registros')
      .update({status_sincronizacao:'processando',tentativas:reg.tentativas+1,atualizado_em:agora})
      .eq('conta_id',contaId).eq('id',reg.id).eq('status_sincronizacao',reg.status_sincronizacao)
      .eq('tentativas',reg.tentativas).select('id').maybeSingle();
    if (erroReserva || !reserva) continue;
    const resultado = await chamarBridgeSuperlogica({acao:reg.status_sincronizacao==='reconciliar'?'consultar':'cadastrar',
      tenant_id:contaId,idempotency_key:reg.id,lead_id_harvest:reg.lead_id_harvest,
      cliente:reg.nome,telefone:reg.telefone,email:reg.email,midia:reg.origem.source_channel,
      origem:reg.origem,comentarioLead:[
        'Alea Botucatu · CA0653_MMOL',
        'Protocolo: '+(reg.origem.protocolo||reg.id),
        'Referência Harvest: '+reg.id,
        'Renda familiar: '+(reg.origem.renda_familiar||'não informada'),
        'Origem: '+(reg.origem.source_channel||'não informada'),
        ...['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'].map(k=>k+': '+(reg.origem[k]||'não informado')),
      ].join(' | ')});
    // Depois de uma consulta ambígua, continua consulta; nunca retorna ao POST.
    const status = reg.status_sincronizacao==='reconciliar' && resultado.status==='retry'?'reconciliar':resultado.status;
    await admin.from('superlogica_registros').update({status_sincronizacao:status,
      id_superlogica:resultado.id??reg.id_superlogica,erro_tecnico:resultado.erro??null,
      proxima_tentativa:new Date(Date.now()+Math.min(86_400_000,60_000*2**Math.min(reg.tentativas,10))).toISOString(),
      atualizado_em:new Date().toISOString()}).eq('conta_id',contaId).eq('id',reg.id).eq('tentativas',reg.tentativas+1);
  }
}
