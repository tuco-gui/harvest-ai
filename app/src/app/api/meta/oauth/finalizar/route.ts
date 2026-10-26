import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {decifrarMeta,cifrarMeta} from '@/lib/crmMetaOAuth';
import {isAdmin} from '@/lib/crmControleAcesso';

function ir(resultado:'ok'|'erro'){return NextResponse.redirect(
 'https://harvest.figueiramarketing.com.br/meta/oauth/concluido?resultado='+resultado,303);}
export async function POST(req:Request){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id||!isAdmin(perfil.papel))return ir('erro');
 const form=await req.formData().catch(()=>null);
 const state=form?.get('state'),paginaId=form?.get('pagina_id');
 if(typeof state!=='string'||!/^[0-9a-f-]{36}$/i.test(state)||
   typeof paginaId!=='string'||!/^\d{8,30}$/.test(paginaId))return ir('erro');
 const admin=supabaseAdmin();
 const {data:oauth}=await admin.from('crm_meta_oauth_estados').select('*')
  .eq('id',state).eq('perfil_id',perfil.id).eq('conta_id',perfil.conta_id)
  .eq('plataforma','facebook_messenger').eq('estado','escolher_pagina')
  .is('consumido_em',null).gt('expira_em',new Date().toISOString()).maybeSingle();
 if(!oauth?.opcoes_cifradas)return ir('erro');
 try{
  const opcoes=JSON.parse(decifrarMeta(oauth.opcoes_cifradas)) as Array<
    {id:string;nome:string;token:string}>;
  const pagina=opcoes.find(p=>p.id===paginaId);
  if(!pagina?.token)return ir('erro');
  const {data:fonte,error}=await admin.from('crm_fontes_funil').update({
   identificador_externo:pagina.id,nome:'Messenger · '+pagina.nome,
   meta_token_cifrado:cifrarMeta(pagina.token),
   meta_escopos:['pages_messaging','pages_manage_metadata'],
   meta_expira_em:null,status:'aguardando_autorizacao',
   atualizado_em:new Date().toISOString(),
  }).eq('id',oauth.fonte_id).eq('conta_id',perfil.conta_id)
   .eq('funil_id',oauth.funil_id).eq('tipo','facebook_messenger')
   .neq('status','pausado').select('id').maybeSingle();
  if(error||!fonte)return ir('erro');
  await admin.from('crm_meta_oauth_estados').update({
   estado:'concluido',opcoes_cifradas:null,consumido_em:new Date().toISOString(),
  }).eq('id',state).eq('perfil_id',perfil.id).eq('estado','escolher_pagina')
   .is('consumido_em',null);
  return ir('ok');
 }catch{return ir('erro');}
}
