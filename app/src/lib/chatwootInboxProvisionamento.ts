import type {SupabaseClient} from '@supabase/supabase-js';
import {criarInboxApiChatwoot,listarInboxes} from './chatwoot.ts';
import {auditarServico} from './servicosWorkspace.ts';

/** Uma caixa por canal ativo e conta remota autorizada. Não altera sessão,
 * não cria webhook, não envia mensagem e não ativa roteamento. */
export async function prepararInboxWhatsapp(db:SupabaseClient,contaId:string,atorId:string,canalId:number){
 if(!Number.isSafeInteger(canalId)||canalId<1)throw Error('canal_invalido');
 const [{data:canal,error:ec},{data:vinculo,error:ev}]=await Promise.all([
  db.from('whatsapp_canais').select('id,nome,provider,status,ativo').eq('conta_id',contaId).eq('id',canalId).maybeSingle(),
  db.from('crm_vinculos').select('chatwoot_account_id').eq('conta_id',contaId).eq('ativo',true).maybeSingle(),
 ]);
 const accountId=Number(vinculo?.chatwoot_account_id);
 if(ec||ev||!canal?.ativo||canal.status!=='conectado'||!['waha','evolution'].includes(canal.provider)||
   !Number.isSafeInteger(accountId)||accountId<1)throw Error('canal_ou_conta_indisponivel');
 const nome=`Harvest · WhatsApp ${canalId} · ${canal.nome}`.slice(0,120);
 const remotas=await listarInboxes(accountId);
 if(remotas.some(x=>x.name===nome))throw Error('chatwoot_inbox_exige_reconciliacao');
 const {data:reserva,error:er}=await db.rpc('chatwoot_reservar_inbox_whatsapp',{
  p_conta:contaId,p_ator:atorId,p_canal:canalId,p_account:accountId});
 if(er||reserva!==true)throw Error('chatwoot_inbox_exige_reconciliacao');
 try{
  const inbox=await criarInboxApiChatwoot(accountId,nome);
  const {data:salvo,error:es}=await db.from('chatwoot_inbox_provisionamentos').update({
   inbox_id:inbox.id,estado:'preparado',atualizado_em:new Date().toISOString(),
  }).eq('conta_id',contaId).eq('canal_id',canalId).eq('account_id',accountId).eq('estado','reservado').select('inbox_id').maybeSingle();
  if(es||!salvo)throw Error('chatwoot_ledger_indisponivel');
  await auditarServico(db,contaId,atorId,'chatwoot_inbox_preparada',{canal_id:canalId,inbox_id:inbox.id});
  return {inbox_id:inbox.id,estado:'preparado',roteamento_ativo:false};
 }catch{
  await db.from('chatwoot_inbox_provisionamentos').update({estado:'incerto',atualizado_em:new Date().toISOString()})
   .eq('conta_id',contaId).eq('canal_id',canalId).eq('estado','reservado');
  throw Error('chatwoot_inbox_exige_reconciliacao');
 }
}
