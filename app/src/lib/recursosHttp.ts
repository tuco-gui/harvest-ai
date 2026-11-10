import type {SupabaseClient} from '@supabase/supabase-js';
import {carregarRecursos,carregarDelegacao,auditarServico} from './servicosWorkspace.ts';
import {efeitoPermitido} from './recursos.ts';
import {politicaDaRota,rotaSemContrato,tipoCanalRecurso} from './recursosRotas.ts';
export async function autorizarRequisicao(db:SupabaseClient,perfil:{id:string;papel:string;conta_id:string|null},path:string,method:string,body:Record<string,unknown>,delegacaoId?:string){
 const politica=politicaDaRota(path,method,body);
 if(!politica){if(path.startsWith('/api/')&&!rotaSemContrato(path)&&!path.startsWith('/api/webhook/')&&!path.startsWith('/api/publico/'))return {ok:false,status:403,erro:'Rota sem política de serviços.'};return {ok:true};}
 if(!perfil.conta_id)return path.startsWith('/api/')?{ok:false,status:400,erro:'Selecione uma workspace.'}:{ok:true};
 const c=await carregarRecursos(db,perfil.conta_id);
 if(typeof body.fonte_id==='string'&&/^\/api\/(?:zernio|meta|integracoes)/.test(path)){
  const {data:fonte,error}=await db.from('crm_fontes_funil').select('tipo').eq('id',body.fonte_id).eq('conta_id',perfil.conta_id).maybeSingle();
  if(error)throw Error('fonte_indisponivel');
  if(!fonte)return {ok:false,status:404,erro:'Fonte não encontrada nesta workspace.'};
  politica.recursos.push(tipoCanalRecurso(fonte.tipo));
 }
 const delegacao=await carregarDelegacao(db,perfil,delegacaoId);
 if(perfil.papel==='super_admin'&&delegacaoId&&!delegacao){
  if(c.migrada)await auditarServico(db,perfil.conta_id,perfil.id,'delegacao_invalida',{path,method});
  return {ok:false,status:403,erro:'Acesso delegado expirado ou inválido. Encerre-o em Clientes antes de continuar.'};
 }
 const allowed=politica.qualquer?politica.recursos.some(k=>efeitoPermitido(c,[k],politica.efeito,!!delegacao)):
  efeitoPermitido(c,politica.recursos,politica.efeito,!!delegacao);
 if(delegacao||(perfil.papel==='super_admin'&&c.migrada)||(!allowed&&c.migrada))await auditarServico(db,perfil.conta_id,perfil.id,allowed?(delegacao?'acesso_delegado':'super_admin_global'):'recurso_negado',{
  path,method,recursos:politica.recursos,efeito:politica.efeito,delegacao_id:delegacao?.id??null});
 return allowed?{ok:true}:{ok:false,status:403,erro:delegacao&&['enviar','ativar'].includes(politica.efeito)?
  'Acesso delegado e homologação não autorizam envios ou ativações.':'Recurso não liberado para esta workspace.'};
}
