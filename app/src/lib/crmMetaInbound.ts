import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {PlataformaMeta} from './crmMetaOAuth';

export type MensagemMetaEntrada={
 plataforma:PlataformaMeta;contaExternaId:string;remetenteId:string;
 mensagemId:string;texto:string;enviadaPelaConta:boolean;
};
export function extrairMensagensMeta(payload:unknown):MensagemMetaEntrada[]{
 if(!payload||typeof payload!=='object')return [];
 const p=payload as Record<string,unknown>;
 const plataforma:PlataformaMeta|null=p.object==='instagram'?'instagram_dm':
  p.object==='page'?'facebook_messenger':null;
 if(!plataforma||!Array.isArray(p.entry))return [];
 const eventos:MensagemMetaEntrada[]=[];
 for(const e of p.entry.slice(0,100)){
  if(!e||typeof e!=='object')continue;
  const ent=e as Record<string,any>;
  const contaExternaId=String(ent.id??'');
  if(!/^\d{8,30}$/.test(contaExternaId)||!Array.isArray(ent.messaging))continue;
  for(const item of ent.messaging.slice(0,100)){
   const mid=typeof item?.message?.mid==='string'?item.message.mid:'';
   const texto=typeof item?.message?.text==='string'?item.message.text.trim():'';
   const remetenteId=String(item?.sender?.id??'');
   const recipientId=String(item?.recipient?.id??'');
   if(!mid||mid.length>255||!texto||texto.length>4000||
     !/^\d{8,30}$/.test(remetenteId)||recipientId!==contaExternaId)continue;
   eventos.push({plataforma,contaExternaId,remetenteId,
    mensagemId:mid,texto,enviadaPelaConta:Boolean(item?.message?.is_echo)||
       remetenteId===contaExternaId});
  }
 }
 return eventos;
}
export async function gravarMensagemMeta(admin:SupabaseClient,m:MensagemMetaEntrada):
 Promise<'gravada'|'duplicada'|'ignorada'>{
 if(m.enviadaPelaConta)return 'ignorada';
 const {data:fontes,error}=await admin.from('crm_fontes_funil')
  .select('id,conta_id,meta_token_cifrado,status').eq('tipo',m.plataforma)
  .eq('identificador_externo',m.contaExternaId)
  .in('status',['aguardando_autorizacao','pronto']).limit(2);
 if(error)throw Error('Falha ao verificar fonte Meta.');
 if(!fontes?.length)return 'ignorada';
 // Não distribuir o mesmo evento entre duas workspaces ou fontes ambíguas.
 if(fontes.length!==1)return 'ignorada';
 const fonte=fontes[0];
 if(!fonte.meta_token_cifrado)return 'ignorada';
 let {data:conversa,error:erroConversa}=await admin.from('crm_conversas_externas')
  .select('id').eq('conta_id',fonte.conta_id).eq('fonte_id',fonte.id)
  .eq('visitante_id',m.remetenteId).maybeSingle();
 if(erroConversa)throw Error('Falha na busca da conversa Meta.');
 if(!conversa){
  const segredoHash=createHash('sha256').update(
   'meta:'+fonte.id+':'+m.remetenteId).digest('hex');
  const criada=await admin.from('crm_conversas_externas')
   .insert({conta_id:fonte.conta_id,fonte_id:fonte.id,
    visitante_id:m.remetenteId,segredo_hash:segredoHash})
   .select('id').maybeSingle();
  if(criada.error?.code==='23505'){
   const existe=await admin.from('crm_conversas_externas').select('id')
    .eq('conta_id',fonte.conta_id).eq('fonte_id',fonte.id)
    .eq('visitante_id',m.remetenteId).maybeSingle();
   conversa=existe.data;
  }else if(criada.error)throw Error('Falha ao criar conversa Meta.');
  else conversa=criada.data;
 }
 if(!conversa)throw Error('Conversa Meta indisponível.');
 const {error:errInsert}=await admin.from('crm_mensagens_externas').insert({
  conta_id:fonte.conta_id,conversa_id:conversa.id,direcao:'entrada',
  texto:m.texto,mensagem_externa_id:m.mensagemId,
 });
 if(errInsert?.code==='23505')return 'duplicada';
 if(errInsert)throw Error('Falha ao registrar mensagem Meta.');
 const now=new Date().toISOString();
 const [{error:errConversa},{error:errFonte}]=await Promise.all([
  admin.from('crm_conversas_externas').update({atualizado_em:now})
   .eq('conta_id',fonte.conta_id).eq('id',conversa.id),
  admin.from('crm_fontes_funil').update({status:'pronto',atualizado_em:now})
   .eq('conta_id',fonte.conta_id).eq('id',fonte.id)
   .eq('status','aguardando_autorizacao'),
 ]);
 if(errConversa||errFonte)throw Error('Falha ao finalizar estado de webhook Meta.');
 return 'gravada';
}
