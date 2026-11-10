import type {SupabaseClient} from '@supabase/supabase-js';
import {listarInboxes} from './chatwoot.ts';
import {auditarServico} from './servicosWorkspace.ts';

export function provisionamentoChatwootDisponivel(){
 return !!process.env.CHATWOOT_API_URL&&!!process.env.CHATWOOT_API_TOKEN&&!!process.env.CHATWOOT_PLATFORM_APP_TOKEN&&
  Number.isSafeInteger(Number(process.env.CHATWOOT_SERVICE_USER_ID))&&Number(process.env.CHATWOOT_SERVICE_USER_ID)>0;
}
async function plataforma(path:string,body:unknown){
 const base=process.env.CHATWOOT_API_URL!;
 const r=await fetch(base.replace(/\/$/,'')+'/platform/api/v1'+path,{method:'POST',redirect:'error',
  headers:{'Content-Type':'application/json',api_access_token:process.env.CHATWOOT_PLATFORM_APP_TOKEN!},
  body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('chatwoot_platform_recusou');
 return r.json();
}
/** Uma reserva persistida antecede o POST remoto. Falha ambígua nunca repete criação. */
export async function provisionarChatwoot(db:SupabaseClient,contaId:string,atorId:string){
 if(!provisionamentoChatwootDisponivel())throw Error('chatwoot_platform_nao_configurada');
 const {data:conta,error:ec}=await db.from('contas').select('nome').eq('id',contaId).eq('ativo',true).maybeSingle();
 if(ec||!conta)throw Error('workspace_indisponivel');
 const {data:reservado,error}=await db.rpc('chatwoot_reservar_provisionamento',{p_conta:contaId,p_ator:atorId});
 if(error||reservado!==true)throw Error('chatwoot_provisionamento_exige_reconciliacao');
 try{
  const account=await plataforma('/accounts',{name:conta.nome,locale:'pt_BR',custom_attributes:{harvest_conta_id:contaId}});
  if(!Number.isSafeInteger(account?.id)||account.id<1)throw Error('chatwoot_account_ambiguo');
  const {data:salvo,error:es}=await db.from('chatwoot_provisionamentos').update({estado:'conta_criada',account_id:account.id,atualizado_em:new Date().toISOString()})
   .eq('conta_id',contaId).eq('estado','reservado').select('conta_id').maybeSingle();
  if(es||!salvo)throw Error('chatwoot_ledger_indisponivel');
  const membro=await plataforma('/accounts/'+account.id+'/account_users',{user_id:Number(process.env.CHATWOOT_SERVICE_USER_ID),role:'administrator'});
  if(membro.account_id!==account.id||membro.user_id!==Number(process.env.CHATWOOT_SERVICE_USER_ID)||membro.role!=='administrator')throw Error('chatwoot_membership_nao_confirmado');
  await listarInboxes(account.id); // Confirma acesso do token de aplicação, sem criar canal ou mensagem.
  const {error:ev}=await db.from('crm_vinculos').upsert({conta_id:contaId,chatwoot_account_id:account.id,ativo:true,atualizado_em:new Date().toISOString()},{onConflict:'conta_id'});
  if(ev)throw Error('chatwoot_vinculo_indisponivel');
  const {error:ef}=await db.from('chatwoot_provisionamentos').update({estado:'pronto',atualizado_em:new Date().toISOString()}).eq('conta_id',contaId);
  if(ef)throw Error('chatwoot_finalizacao_indisponivel');
  await auditarServico(db,contaId,atorId,'chatwoot_provisionado',{account_id:account.id});
  return account.id as number;
 }catch{
  await db.from('chatwoot_provisionamentos').update({estado:'incerto',atualizado_em:new Date().toISOString()}).eq('conta_id',contaId);
  throw Error('chatwoot_provisionamento_exige_reconciliacao');
 }
}
