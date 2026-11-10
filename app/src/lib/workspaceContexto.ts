import type {SupabaseClient} from '@supabase/supabase-js';
/** A mesma resolução para middleware e handlers. Cookie escolhe, nunca autoriza. */
export async function resolverWorkspace(db:SupabaseClient,p:{id:string;papel:string;conta_id:string|null},selecionada?:string){
 if(p.papel==='super_admin'){
  if(!selecionada)return {contaId:null,papel:'super_admin' as const,contaPropria:null};
  const {data,error}=await db.from('contas').select('id').eq('id',selecionada).eq('ativo',true).maybeSingle();
  if(error)throw Error('workspace_indisponivel');
  return {contaId:data?.id??null,papel:'super_admin' as const,contaPropria:null};
 }
 const {data,error}=await db.from('conta_usuarios').select('conta_id,papel').eq('user_id',p.id).eq('ativo',true);
 if(error&&!['42P01','PGRST205'].includes(error.code))throw Error('membership_indisponivel');
 if(error)return {contaId:p.conta_id,papel:p.papel==='admin'?'admin' as const:'operador' as const,contaPropria:p.conta_id};
 const membro=selecionada?data?.find(x=>x.conta_id===selecionada):data?.length===1?data[0]:null;
 if(membro){const c=await db.from('contas').select('id').eq('id',membro.conta_id).eq('ativo',true).maybeSingle();if(c.error)throw Error('workspace_indisponivel');if(!c.data)return {contaId:null,papel:'operador' as const,contaPropria:data?.[0]?.conta_id??null};}
 return {contaId:membro?.conta_id??null,papel:membro?.papel==='admin'?'admin' as const:'operador' as const,contaPropria:data?.[0]?.conta_id??null};
}
