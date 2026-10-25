import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverContaEvolution, resolverContaWaha } from './inboundConta.ts';

export type ProviderCanalInbound = 'waha'|'evolution';
export type DestinoInbound = {
  contaId:string|null;
  canalId:number|null;
  funilId:number|null;
  motivo:'canal_verificado'|'conta_legada'|'canal_ambiguo'|'nao_resolvido';
};

/**
 * A identidade é o nome de sessão/instância recebido de uma rota
 * AUTENTICADA (HMAC ou token). Nunca aceitar conta_id do corpo externo.
 * Um mesmo canal pode estar em vários funis: nesse caso não presumir destino.
 */
export async function resolverDestinoInbound(
  admin:SupabaseClient,provider:ProviderCanalInbound,identificador:string|null,
):Promise<DestinoInbound> {
  const vazio:DestinoInbound={contaId:null,canalId:null,funilId:null,motivo:'nao_resolvido'};
  if(!identificador || identificador.length>200)return vazio;
  const {data:canais,error}=await admin.from('whatsapp_canais')
    .select('id,conta_id')
    .eq('provider',provider).eq('identificador_externo',identificador).limit(2);
  if(error)return vazio;
  if((canais??[]).length>1)return {...vazio,motivo:'canal_ambiguo'};
  if(canais?.length===1){
    const canal=canais[0];
    const {data:funis,error:errFunis}=await admin.from('funis')
      .select('id').eq('conta_id',canal.conta_id)
      .eq('canal_padrao_id',canal.id).eq('ativo',true).limit(2);
    if(errFunis)return vazio;
    return {contaId:canal.conta_id,canalId:canal.id,
      funilId:funis?.length===1?funis[0].id:null,motivo:'canal_verificado'};
  }
  // Compatibilidade de webhooks antigos: identidade sem canal fica sem
  // atribuição de funil. Não identifica um número só pelo telefone do contato.
  const contaId=provider==='waha'
    ?await resolverContaWaha(admin,identificador)
    :await resolverContaEvolution(admin,identificador);
  return contaId
    ?{contaId,canalId:null,funilId:null,motivo:'conta_legada'}
    :vazio;
}
