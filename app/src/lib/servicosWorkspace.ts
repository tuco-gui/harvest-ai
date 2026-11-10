import type {SupabaseClient} from '@supabase/supabase-js';
import {RECURSOS,modulosCompativeis,efeitoPermitido,recursoLiberado,type ContextoRecursos,type Efeito} from './recursos.ts';
export const COOKIE_DELEGACAO='harvest_delegacao';
export type Delegacao={id:string;modo:string;motivo:string;expira_em:string};
const ausente=(e:{code?:string}|null)=>!!e&&['42P01','PGRST205','42703','PGRST204'].includes(e.code??'');
export async function carregarRecursos(db:SupabaseClient,contaId:string):Promise<ContextoRecursos&{migrada:boolean}>{
 let conta=await db.from('contas').select('modulos_habilitados,slug,ativo,recursos_versao').eq('id',contaId).maybeSingle();
 if(ausente(conta.error))conta=await db.from('contas').select('modulos_habilitados,slug,ativo').eq('id',contaId).maybeSingle();
 if(conta.error||!conta.data||conta.data.ativo===false)throw Error('workspace_indisponivel');
 const r=await db.from('conta_recursos').select('recurso,liberado,expira_em').eq('conta_id',contaId);
 if(r.error&&!ausente(r.error))throw Error('servicos_indisponiveis');
 return {modulos:conta.data.modulos_habilitados,slug:conta.data.slug,versao:Number(conta.data.recursos_versao??0),
  concessoes:r.data??[],migrada:!r.error};
}
export async function carregarDelegacao(db:SupabaseClient,ator:{id:string;papel:string;conta_id:string|null},id:string|undefined):Promise<Delegacao|null>{
 if(!id||ator.papel!=='super_admin'||!ator.conta_id||!/^[0-9a-f-]{36}$/i.test(id))return null;
 const {data,error}=await db.from('workspace_delegacoes').select('id,modo,motivo,expira_em').eq('id',id)
  .eq('ator_id',ator.id).eq('conta_id',ator.conta_id).is('encerrado_em',null).gt('expira_em',new Date().toISOString()).maybeSingle();
 if(error&&!ausente(error))throw Error('delegacao_indisponivel');
 return data??null;
}
export async function auditarServico(db:SupabaseClient,contaId:string,atorId:string,evento:string,detalhes:Record<string,unknown>){
 const {error}=await db.from('servicos_auditoria').insert({workspace_id:contaId,ator_id:atorId,evento,detalhes});
 if(error)throw Error('auditoria_indisponivel');
}
export async function encerrarDelegacao(db:SupabaseClient,id:string,atorId:string){
 const {error}=await db.rpc('servicos_encerrar_delegacao',{p_id:id,p_ator:atorId});if(error)throw Error('delegacao_nao_encerrada');
}
export async function recursoDaWorkspace(db:SupabaseClient,contaId:string,recursos:string[],efeito:Efeito='ler'){
 try{return efeitoPermitido(await carregarRecursos(db,contaId),recursos,efeito);}catch{return false;}
}
export async function perfilTemRecursos(db:SupabaseClient,p:{conta_id:string|null;delegacao?:Delegacao|null},ks:string[],efeito:Efeito='ler'){
 if(!p.conta_id)return false;
 return efeitoPermitido(await carregarRecursos(db,p.conta_id),ks,efeito,!!p.delegacao);
}
export async function recursosVisiveis(db:SupabaseClient,p:{conta_id:string|null;delegacao?:Delegacao|null}){
 if(!p.conta_id)return [];
 const c=await carregarRecursos(db,p.conta_id);
 return Object.keys(RECURSOS).filter(k=>p.delegacao||recursoLiberado(c,k));
}
/** Chamado por workers/webhooks APÓS autenticar e resolver o tenant. Sem bypass de super admin. */
export async function exigirRecursoDaWorkspace(db:SupabaseClient,contaId:string,recursos:string[],efeito:Efeito='ler'){
 if(!(await recursoDaWorkspace(db,contaId,recursos,efeito)))throw Error('recurso_nao_liberado');
}
export async function modulosComServicos(db:SupabaseClient,perfil:{conta_id:string|null;delegacao?:Delegacao|null}){
 if(!perfil.conta_id)return null;
 const c=await carregarRecursos(db,perfil.conta_id);
 if(perfil.delegacao)return ['whatsapp','ia','usuarios','chamados','status','enriquecimento','crm','agentes','crm_avancado'];
 return modulosCompativeis(c);
}
export {recursoLiberado};
