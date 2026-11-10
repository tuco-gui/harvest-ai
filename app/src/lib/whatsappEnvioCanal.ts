import type { SupabaseClient } from '@supabase/supabase-js';
import {recursoDaWorkspace} from './servicosWorkspace';
import { sessaoWahaDoCanal, type CanalWhatsApp } from './whatsappCanais';
import { getStatus, sendText } from './waha';

/** Transporte compartilhado: uma sessão explícita, nunca fallback entre clientes. */
export async function enviarTextoCanal(admin: SupabaseClient, contaId: string,
  canal: CanalWhatsApp, telefone: string, texto: string): Promise<boolean> {
  if (canal.conta_id!==contaId || !canal.ativo) throw Error('canal_invalido');
  if(!(await recursoDaWorkspace(admin,contaId,['inbox.whatsapp','inbox.envio'],'enviar')))throw Error('recurso_nao_liberado');
  if (canal.provider==='waha') {
    const sessao = sessaoWahaDoCanal(canal);
    if ((await getStatus(sessao))?.status!=='WORKING') throw Error('canal_desconectado');
    return sendText(sessao,telefone,texto);
  }
  const {data:cred,error} = await admin.from('conta_credenciais')
    .select('evolution_url,evolution_instancia,evolution_key').eq('conta_id',contaId).maybeSingle();
  if (error || !cred?.evolution_url || !cred.evolution_instancia || !cred.evolution_key ||
      canal.identificador_externo!==cred.evolution_instancia) throw Error('instancia_evolution_nao_verificada');
  const r = await fetch(`${String(cred.evolution_url).replace(/\/+$/,'')}/message/sendText/${encodeURIComponent(cred.evolution_instancia)}`,{
    method:'POST',headers:{'Content-Type':'application/json',apikey:cred.evolution_key},
    body:JSON.stringify({number:telefone,text:texto}),signal:AbortSignal.timeout(30_000),redirect:'error'});
  return r.ok;
}
