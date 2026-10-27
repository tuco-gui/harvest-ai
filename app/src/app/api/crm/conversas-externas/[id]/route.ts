import {NextResponse} from 'next/server';
import {contexto,isAdmin} from '@/lib/contextoConversasExternas';
import {enviarRespostaMeta} from '@/lib/crmMetaEnvio';
import {zernio} from '@/lib/crmZernio';
type Ctx={params:Promise<{id:string}>};
async function carregar(id:string){
 const c=await contexto();if('erro'in c)return {erro:c.erro!};
 if(!/^[0-9a-f-]{36}$/i.test(id))return {erro:NextResponse.json({erro:'Conversa inválida.'},{status:400})} as const;
 const {admin,perfil}=c;
 const {data:conversa,error}=await admin.from('crm_conversas_externas')
   .select('id,fonte_id,nome,visitante_id,status,responsavel_id,criado_em,atualizado_em,zernio_conversation_id,contato_id')
  .eq('id',id).eq('conta_id',perfil.conta_id).maybeSingle();
 if(error)return {erro:NextResponse.json({erro:'Falha ao consultar conversa.'},{status:503})} as const;
 if(!conversa)return {erro:NextResponse.json({erro:'Conversa não encontrada.'},{status:404})} as const;
 if(!isAdmin(perfil.papel)&&conversa.responsavel_id!==perfil.id)
  return {erro:NextResponse.json({erro:'Sem permissão para esta conversa.'},{status:403})} as const;
 const {data:fonte}=await admin.from('crm_fontes_funil')
  .select('id,nome,tipo,status,funil_id,zernio_account_id').eq('id',conversa.fonte_id)
  .eq('conta_id',perfil.conta_id).maybeSingle();
 if(!fonte)return {erro:NextResponse.json({erro:'Fonte não encontrada.'},{status:404})} as const;
 return {perfil,admin,conversa,fonte} as const;
}
export async function GET(_req:Request,{params}:Ctx):Promise<Response>{
 const c=await carregar((await params).id);if('erro'in c)return c.erro!;
 const {data:mensagens,error}=await c.admin.from('crm_mensagens_externas')
  .select('id,texto,direcao,criado_em,status_envio')
  .eq('conta_id',c.perfil.conta_id).eq('conversa_id',c.conversa.id)
   .order('criado_em',{ascending:false}).limit(200);
  if(error)return NextResponse.json({erro:'Falha ao ler histórico.'},{status:503});
  const {data:vinculo,error:erroVinculo}=await c.admin.from('crm_vinculos_conversa_negocio')
   .select('oportunidade_id').eq('conta_id',c.perfil.conta_id).eq('conversa_id',c.conversa.id).maybeSingle();
  if(erroVinculo)return NextResponse.json({erro:'Falha ao consultar vínculo do CRM.'},{status:503});
  let oportunidade=null;
  if(vinculo){
   let q=c.admin.from('oportunidades').select('id,empresa,contato,estagio,contato_id,funil_id')
    .eq('conta_id',c.perfil.conta_id).eq('id',vinculo.oportunidade_id);
   if(!isAdmin(c.perfil.papel))q=q.eq('owner_id',c.perfil.id);
   const result=await q.maybeSingle();
   if(result.error)return NextResponse.json({erro:'Falha ao ler negócio vinculado.'},{status:503});
   oportunidade=result.data;
  }
  return NextResponse.json({conversa:c.conversa,fonte:c.fonte,oportunidade,mensagens:(mensagens??[]).reverse()});
}
export async function PATCH(req:Request,{params}:Ctx){
 const c=await carregar((await params).id);if('erro'in c)return c.erro;
 const b=await req.json().catch(()=>null);
 const dados:Record<string,unknown>={};
 if(b?.status!==undefined){
  if(!['aberto','pendente','resolvido'].includes(b.status))
   return NextResponse.json({erro:'Status inválido.'},{status:400});
  dados.status=b.status;
 }
 if(b?.responsavel_id!==undefined){
  if(!isAdmin(c.perfil.papel))return NextResponse.json({erro:'Sem permissão para transferir.'},{status:403});
  if(b.responsavel_id!==null && typeof b.responsavel_id!=='string')
   return NextResponse.json({erro:'Responsável inválido.'},{status:400});
  if(b.responsavel_id){
   const {data:atendente}=await c.admin.from('perfis').select('id')
    .eq('id',b.responsavel_id).eq('conta_id',c.perfil.conta_id).maybeSingle();
   if(!atendente)return NextResponse.json({erro:'Responsável não pertence à workspace.'},{status:403});
  }
  dados.responsavel_id=b.responsavel_id;
 }
 if(!Object.keys(dados).length)return NextResponse.json({erro:'Nenhuma alteração.'},{status:400});
 dados.atualizado_em=new Date().toISOString();
 const {data,error}=await c.admin.from('crm_conversas_externas').update(dados)
  .eq('conta_id',c.perfil.conta_id).eq('id',c.conversa.id)
  .select('id,status,responsavel_id,atualizado_em').single();
 if(error)return NextResponse.json({erro:'Falha ao atualizar atendimento.'},{status:503});
 return NextResponse.json({conversa:data});
}
export async function POST(req:Request,{params}:Ctx){
 const c=await carregar((await params).id);if('erro'in c)return c.erro;
 const meta=c.fonte.tipo==='instagram_dm'||c.fonte.tipo==='facebook_messenger';
 if(c.fonte.status!=='pronto'||(!meta&&c.fonte.tipo!=='webchat'))
  return NextResponse.json({erro:'Fonte ainda não habilitada para enviar respostas.'},{status:409});
 const b=await req.json().catch(()=>null);
 if(typeof b?.texto!=='string'||b.texto.trim().length<1||b.texto.trim().length>2000)
  return NextResponse.json({erro:'Mensagem entre 1 e 2000 caracteres.'},{status:400});
 if(!meta){
  const {data,error}=await c.admin.from('crm_mensagens_externas').insert({
   conta_id:c.perfil.conta_id,conversa_id:c.conversa.id,
   direcao:'saida',texto:b.texto.trim(),
  }).select('id,texto,direcao,criado_em,status_envio').single();
  if(error)return NextResponse.json({erro:'Não foi possível responder.'},{status:503});
  await c.admin.from('crm_conversas_externas').update({atualizado_em:new Date().toISOString()})
   .eq('id',c.conversa.id).eq('conta_id',c.perfil.conta_id);
  return NextResponse.json({mensagem:data},{status:201});
 }
 // Meta: somente resposta MANUAL e dentro da janela de 24h após mensagem do
 // próprio consumidor. Não enviar campanhas, templates ou mensagens ativas.
 const chave=b?.idempotencia;
 if(typeof chave!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(chave))
  return NextResponse.json({erro:'Chave de envio inválida.'},{status:400});
 const {data:entrada,error:errEntrada}=await c.admin.from('crm_mensagens_externas')
  .select('id,criado_em').eq('conta_id',c.perfil.conta_id)
  .eq('conversa_id',c.conversa.id).eq('direcao','entrada')
  .order('criado_em',{ascending:false}).limit(1).maybeSingle();
  if(errEntrada||!entrada||!Number.isFinite(Date.parse(entrada.criado_em))||Date.now()-Date.parse(entrada.criado_em)>24*3600*1000)
  return NextResponse.json({erro:'Fora da janela de 24h. Aguarde nova mensagem do contato.'},{status:409});
 if(c.fonte.zernio_account_id){
  if(!c.conversa.zernio_conversation_id)
   return NextResponse.json({erro:'Conversa da Zernio não identificada.'},{status:409});
  const localId='local:'+chave;
  const existente=await c.admin.from('crm_mensagens_externas').select('id')
   .eq('conta_id',c.perfil.conta_id).eq('conversa_id',c.conversa.id)
   .eq('mensagem_externa_id',localId).maybeSingle();
  if(existente.data)return NextResponse.json({erro:'Tentativa já registrada.'},{status:409});
  const reserva=await c.admin.from('crm_mensagens_externas').insert({
   conta_id:c.perfil.conta_id,conversa_id:c.conversa.id,direcao:'saida',
   texto:b.texto.trim(),mensagem_externa_id:localId,status_envio:'pendente'
  }).select('id,texto,direcao,criado_em,status_envio').single();
  if(reserva.error)return NextResponse.json({erro:'Tentativa já registrada ou indisponível.'},{status:409});
  try{
   const result=await zernio('inbox/conversations/'+encodeURIComponent(c.conversa.zernio_conversation_id)+'/messages',{
    method:'POST',body:{accountId:c.fonte.zernio_account_id,message:b.texto.trim()}
   });
   const mid=result?.data?.messageId;
   if(typeof mid!=='string'||!mid)throw Error('Sem confirmação de envio.');
   const {data:msg,error}=await c.admin.from('crm_mensagens_externas')
    .update({status_envio:'enviado',meta_mensagem_id:mid})
    .eq('id',reserva.data.id).eq('conta_id',c.perfil.conta_id)
    .select('id,texto,direcao,criado_em,status_envio').single();
   if(error)return NextResponse.json({erro:'Zernio confirmou, mas o registro local falhou. Não reenvie.'},{status:503});
   return NextResponse.json({mensagem:msg},{status:201});
  }catch{
   await c.admin.from('crm_mensagens_externas').update({status_envio:'falhou'})
    .eq('id',reserva.data.id).eq('conta_id',c.perfil.conta_id);
   return NextResponse.json({erro:'Zernio não confirmou o envio. Verifique a conversa antes de repetir.'},{status:502});
  }
 }
 const {data:fonte,error:erroFonte}=await c.admin.from('crm_fontes_funil')
  .select('id,tipo,identificador_externo,meta_token_cifrado,meta_expira_em')
  .eq('id',c.fonte.id).eq('conta_id',c.perfil.conta_id)
  .eq('status','pronto').maybeSingle();
 if(erroFonte||!fonte?.meta_token_cifrado||!fonte.identificador_externo)
  return NextResponse.json({erro:'Credencial Meta não autorizada nesta workspace.'},{status:409});
 if(fonte.meta_expira_em&&Date.parse(fonte.meta_expira_em)<Date.now())
  return NextResponse.json({erro:'Credencial Meta expirada. Reautorize a fonte.'},{status:409});
 const localId='local:'+chave;
 const existente=await c.admin.from('crm_mensagens_externas')
  .select('id,status_envio').eq('conta_id',c.perfil.conta_id)
  .eq('conversa_id',c.conversa.id).eq('mensagem_externa_id',localId).maybeSingle();
 if(existente.data)return NextResponse.json({
  erro:'Esta tentativa de envio já foi processada. Confira o histórico antes de reenviar.',
  status:existente.data.status_envio,
 },{status:409});
 const reserva=await c.admin.from('crm_mensagens_externas').insert({
  conta_id:c.perfil.conta_id,conversa_id:c.conversa.id,direcao:'saida',
  texto:b.texto.trim(),mensagem_externa_id:localId,status_envio:'pendente',
 }).select('id,texto,direcao,criado_em,status_envio').single();
 if(reserva.error)return NextResponse.json({
  erro:reserva.error.code==='23505'?'Tentativa já registrada.':'Falha ao reservar envio.',
 },{status:409});
 try{
  const mid=await enviarRespostaMeta({
   tipo:c.fonte.tipo as 'instagram_dm'|'facebook_messenger',
   tokenCifrado:fonte.meta_token_cifrado,contaExternaId:fonte.identificador_externo,
   destinatarioId:c.conversa.visitante_id,texto:b.texto.trim(),
  });
  const {data:mensagem,error:erroGravar}=await c.admin.from('crm_mensagens_externas')
   .update({status_envio:'enviado',meta_mensagem_id:mid})
   .eq('id',reserva.data.id).eq('conta_id',c.perfil.conta_id)
   .select('id,texto,direcao,criado_em,status_envio').single();
  await c.admin.from('crm_conversas_externas').update({atualizado_em:new Date().toISOString()})
   .eq('id',c.conversa.id).eq('conta_id',c.perfil.conta_id);
  if(erroGravar)return NextResponse.json({
   erro:'A Meta aceitou a mensagem, mas a confirmação local falhou. Não reenvie automaticamente.',
  },{status:503});
  return NextResponse.json({mensagem},{status:201});
 }catch{
  await c.admin.from('crm_mensagens_externas').update({status_envio:'falhou'})
   .eq('id',reserva.data.id).eq('conta_id',c.perfil.conta_id);
  return NextResponse.json({
   erro:'Resposta Meta não confirmada. Consulte a conversa oficial antes de tentar novamente.',
  },{status:502});
 }
}
