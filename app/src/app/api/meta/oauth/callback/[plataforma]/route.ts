import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {isAdmin} from '@/lib/crmControleAcesso';
import {cifrarMeta,type PlataformaMeta} from '@/lib/crmMetaOAuth';
import {trocarCodigoMeta,contaInstagram,paginasFacebook} from '@/lib/crmMetaGraph';

type Ctx={params:Promise<{plataforma:string}>};
function destino(resultado:'ok'|'erro'|'selecionar',state?:string){
 const url=new URL('https://harvest.figueiramarketing.com.br/meta/oauth/'+
   (resultado==='selecionar'?'selecionar':'concluido'));
 if(resultado!=='selecionar')url.searchParams.set('resultado',resultado);
 if(state)url.searchParams.set('state',state);
 return NextResponse.redirect(url);
}
export async function GET(req:Request,{params}:Ctx){
 const slug=(await params).plataforma;
 const tipo:PlataformaMeta=slug==='instagram'?'instagram_dm':'facebook_messenger';
 if(slug!=='instagram'&&slug!=='facebook')return destino('erro');
 const url=new URL(req.url);
 const state=url.searchParams.get('state'),code=url.searchParams.get('code');
 if(!state||!/^[0-9a-f-]{36}$/i.test(state)||!code||code.length>1000)
  return destino('erro');
 const perfil=await perfilAtual();
 if(!perfil?.conta_id||!isAdmin(perfil.papel))return destino('erro');
 const admin=supabaseAdmin();
 const {data:estado,error}=await admin.from('crm_meta_oauth_estados').select('*')
  .eq('id',state).eq('perfil_id',perfil.id).eq('conta_id',perfil.conta_id)
  .eq('plataforma',tipo).eq('estado','iniciado')
  .is('consumido_em',null).gt('expira_em',new Date().toISOString()).maybeSingle();
 if(error||!estado)return destino('erro');
 try{
  const token=await trocarCodigoMeta(tipo,code);
  if(tipo==='instagram_dm'){
   const conta=await contaInstagram(token.token);
   const {data:fonte,error:erroFonte}=await admin.from('crm_fontes_funil').update({
    identificador_externo:conta.id,nome:'Instagram · @'+conta.nome,
    meta_token_cifrado:cifrarMeta(token.token),
    meta_expira_em:token.expiraEm,meta_escopos:token.escopos,
    status:'aguardando_autorizacao',atualizado_em:new Date().toISOString(),
   }).eq('id',estado.fonte_id).eq('conta_id',perfil.conta_id)
    .eq('funil_id',estado.funil_id).eq('tipo',tipo).neq('status','pausado')
    .select('id').maybeSingle();
   if(erroFonte||!fonte)return destino('erro');
   await admin.from('crm_meta_oauth_estados').update({
    estado:'concluido',consumido_em:new Date().toISOString(),
   }).eq('id',state).eq('perfil_id',perfil.id).eq('estado','iniciado');
   return destino('ok');
  }
  const paginas=await paginasFacebook(token.token);
  if(!paginas.length)return destino('erro');
  const {error:erroOpcoes}=await admin.from('crm_meta_oauth_estados')
   .update({estado:'escolher_pagina',opcoes_cifradas:cifrarMeta(JSON.stringify(paginas))})
   .eq('id',state).eq('conta_id',perfil.conta_id).eq('perfil_id',perfil.id)
   .eq('estado','iniciado').is('consumido_em',null);
  if(erroOpcoes)return destino('erro');
  return destino('selecionar',state);
 }catch{
  // Não registrar nem retornar códigos ou tokens em logs.
  return destino('erro');
 }
}
