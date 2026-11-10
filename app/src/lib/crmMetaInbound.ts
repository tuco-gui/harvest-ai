import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {recursoDaWorkspace} from './servicosWorkspace.ts';
import {tipoCanalRecurso} from './recursosRotas.ts';
import type {PlataformaMeta} from './crmMetaOAuth';
import {capturarLeadSuperlogica} from './superlogica.ts';

export type TipoMetaEntrada=PlataformaMeta|'whatsapp_cloud_api';

export type MensagemMetaEntrada={
 plataforma:TipoMetaEntrada;contaExternaId:string;remetenteId:string;
 mensagemId:string;texto:string;enviadaPelaConta:boolean;nomeContato?:string|null;
};
/**
 * WhatsApp Cloud API entrega em `entry[].changes[].value`, com
 * `metadata.phone_number_id` como identidade da fonte. Status de entrega
 * (`value.statuses`) não são mensagens e são ignorados.
 */
function extrairMensagensWhatsApp(p:Record<string,unknown>):MensagemMetaEntrada[]{
 if(!Array.isArray(p.entry))return [];
 const eventos:MensagemMetaEntrada[]=[];
 for(const e of p.entry.slice(0,100)){
  if(!e||typeof e!=='object')continue;
  const changes=(e as Record<string,any>).changes;
  if(!Array.isArray(changes))continue;
  for(const c of changes.slice(0,100)){
   const v=c?.value;
   if(c?.field!=='messages'||!v||v.messaging_product!=='whatsapp')continue;
   const contaExternaId=String(v.metadata?.phone_number_id??'');
   if(!/^\d{8,30}$/.test(contaExternaId))continue;
   const nomes=new Map<string,string>();
   for(const ct of (Array.isArray(v.contacts)?v.contacts:[]).slice(0,100)){
    const wa=String(ct?.wa_id??'');
    const nome=String(ct?.profile?.name??'').trim();
    if(/^\d{8,30}$/.test(wa)&&nome)nomes.set(wa,nome.slice(0,160));
   }
   for(const msg of (Array.isArray(v.messages)?v.messages:[]).slice(0,100)){
    const mid=typeof msg?.id==='string'?msg.id:'';
    const remetenteId=String(msg?.from??'');
    if(!mid||mid.length>255||!/^\d{8,30}$/.test(remetenteId))continue;
    const texto=msg?.type==='text'?msg.text?.body:
      msg?.type==='button'?msg.button?.text:
      msg?.type==='interactive'?(msg.interactive?.button_reply?.title??msg.interactive?.list_reply?.title):'';
    const limpo=String(texto??'').trim();
    if(!limpo||limpo.length>4000)continue;
    eventos.push({plataforma:'whatsapp_cloud_api',contaExternaId,remetenteId,
      mensagemId:mid,texto:limpo,enviadaPelaConta:false,nomeContato:nomes.get(remetenteId)??null});
   }
  }
 }
 return eventos;
}
export function extrairMensagensMeta(payload:unknown):MensagemMetaEntrada[]{
 if(!payload||typeof payload!=='object')return [];
 const p=payload as Record<string,unknown>;
 if(p.object==='whatsapp_business_account')return extrairMensagensWhatsApp(p);
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
/** Chave estável de captura por número receptor e remetente.
 * A unicidade de pessoas no banco continua por conta + telefone; os IDs de
 * mensagem permanecem no ledger crm_mensagens_externas para auditoria/retry.
 * Não usar o message_id como chave comercial: uma pessoa pode enviar N mensagens.
 */
export function chaveCapturaWhatsAppMeta(m: Pick<MensagemMetaEntrada,'contaExternaId'|'remetenteId'>): string {
 const phoneId=String(m.contaExternaId).trim();
 const contato=String(m.remetenteId).replace(/\D/g,'');
 if(!/^\d{8,30}$/.test(phoneId)||!/^\d{10,15}$/.test(contato))
  throw Error('identidade_whatsapp_invalida');
 return `meta-wa:${phoneId}:${contato}`;
}
/**
 * Inbound WhatsApp oficial também alimenta a captura Superlógica da workspace,
 * reutilizando o mesmo outbox/bridge da Realize. Só captura contatos nomeados
 * do funil configurado; não envia resposta e não distribui responsável.
 */
async function capturarWhatsAppSuperlogica(
 admin:SupabaseClient,
 fonte:{id:string;conta_id:string;funil_id:number},
 m:MensagemMetaEntrada,
){
 const nome=String(m.nomeContato??'').trim();
 if(nome.length<2)return;
 if(!(await recursoDaWorkspace(admin,fonte.conta_id,['integracoes.superlogica'],'configurar')))return;
 const {data:cfg,error}=await admin.from('bdr_config')
  .select('funil_id').eq('conta_id',fonte.conta_id).eq('funil_id',fonte.funil_id).maybeSingle();
 if(error||!cfg)return;
 await capturarLeadSuperlogica(admin,fonte.conta_id,{
  chave:chaveCapturaWhatsAppMeta(m),nome,telefone:m.remetenteId,email:null,
  origem:{source_channel:'meta',utm_source:'whatsapp'},
 });
}
export async function gravarMensagemMeta(admin:SupabaseClient,m:MensagemMetaEntrada):
 Promise<'gravada'|'duplicada'|'ignorada'>{
 if(m.enviadaPelaConta)return 'ignorada';
 const {data:fontes,error}=await admin.from('crm_fontes_funil')
  .select('id,conta_id,funil_id,meta_token_cifrado,status').eq('tipo',m.plataforma)
  .eq('identificador_externo',m.contaExternaId)
  .in('status',['aguardando_autorizacao','pronto']).limit(2);
 if(error)throw Error('Falha ao verificar fonte Meta.');
 if(!fontes?.length)return 'ignorada';
 // Não distribuir o mesmo evento entre duas workspaces ou fontes ambíguas.
 if(fontes.length!==1)return 'ignorada';
 const fonte=fontes[0];
  if(!fonte.meta_token_cifrado)return 'ignorada';
  if(!(await recursoDaWorkspace(admin,fonte.conta_id,[tipoCanalRecurso(m.plataforma)])))return 'ignorada';
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
  if(errInsert&&errInsert.code!=='23505')throw Error('Falha ao registrar mensagem Meta.');
   const negocio=await recursoDaWorkspace(admin,fonte.conta_id,['crm.oportunidades'])?await admin.rpc('crm_criar_negocio_primeira_conversa_social',{
    p_conta:fonte.conta_id,p_fonte:fonte.id,p_conversa:conversa.id,
   }):{error:null};
  if(negocio.error)throw Error('Falha ao vincular contato e negócio Meta.');
  // Captura idempotente por número receptor + contato. Mensagens permanecem
  // auditáveis por message_id e retries reconciliam sem novo lead comercial.
  if(m.plataforma==='whatsapp_cloud_api')await capturarWhatsAppSuperlogica(admin,fonte,m);
  if(errInsert?.code==='23505')return 'duplicada';
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
