import type { SupabaseClient } from '@supabase/supabase-js';
import { chaveEstagio } from './crmStages.ts';
import type { TipoMensagemInbound } from './inboundTipos.ts';

export function podeCriarNegocioAutomatico(entrada:{
 canalId:number|null;funilId:number|null;
 classificacao:'resposta'|'negativa'|'optout';tipoMensagem:TipoMensagemInbound;
}):boolean {
 return entrada.canalId!==null && entrada.funilId!==null &&
   entrada.classificacao==='resposta' && entrada.tipoMensagem==='texto';
}

/** Executa somente depois do evento gravado, sem disparar mensagens.
 * Toda concorrência/idempotência é conferida outra vez pelo PostgreSQL.
 */
export async function criarNegocioDoPrimeiroInbound(
 admin:SupabaseClient,entrada:{
  contaId:string;canalId:number;funilId:number;telefone:string;
  nomeContato:string|null;
 }):Promise<number|null> {
 const {data:funil,error:erroFunil}=await admin.from('funis')
   .select('id,auto_criar_negocio_inbound').eq('id',entrada.funilId)
   .eq('conta_id',entrada.contaId).eq('ativo',true).maybeSingle();
 if(erroFunil)throw Error('Não foi possível verificar a automação do funil.');
 if(funil?.auto_criar_negocio_inbound!==true)return null;
 const {data:stages,error:erroStages}=await admin.from('funil_estagios')
   .select('id,nome,probabilidade').eq('funil_id',entrada.funilId)
   .eq('grupo','pipeline').order('ordem',{ascending:true}).limit(1);
 if(erroStages || !stages?.[0])throw Error('Funil sem etapa de entrada.');
 const stage=stages[0];
 const {data,error}=await admin.rpc('crm_criar_negocio_primeiro_inbound',{
   p_conta:entrada.contaId,
   p_canal:entrada.canalId,
   p_funil:entrada.funilId,
   p_telefone:entrada.telefone,
   p_nome:entrada.nomeContato??'',
   p_estagio_id:stage.id,
   p_estagio_slug:chaveEstagio(stage.nome),
   p_probabilidade:stage.probabilidade,
 });
 if(error)throw Error('Falha ao verificar/criar negócio automaticamente.');
 return typeof data==='number'&&Number.isSafeInteger(data)&&data>0?data:null;
}
