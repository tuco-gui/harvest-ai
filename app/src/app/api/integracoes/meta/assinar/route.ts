import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
import {decifrarMeta} from '@/lib/crmMetaOAuth';
import {assinarMensagensMessenger} from '@/lib/crmMetaAssinaturas';

/** Repetir assinatura da Page sem revogar nem reiniciar OAuth do cliente. */
export async function POST(req:Request){
 const origem=req.headers.get('origin');
 if(origem&&new URL(origem).origin!=='https://harvest.figueiramarketing.com.br')
  return NextResponse.json({erro:'Origem não autorizada.'},{status:403});
 const perfil=await perfilAtual();
 if(!perfil?.conta_id||!isAdmin(perfil.papel))
  return NextResponse.json({erro:'Apenas administradores da workspace.'},{status:403});
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403});
 const body=await req.json().catch(()=>null);
 if(typeof body?.fonte_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.fonte_id))
  return NextResponse.json({erro:'Fonte inválida.'},{status:400});
 const {data:fonte,error}=await admin.from('crm_fontes_funil')
  .select('id,tipo,status,identificador_externo,meta_token_cifrado,meta_expira_em')
  .eq('id',body.fonte_id).eq('conta_id',perfil.conta_id)
  .eq('tipo','facebook_messenger').maybeSingle();
 if(error||!fonte)return NextResponse.json({erro:'Messenger não localizado nesta workspace.'},{status:404});
 if(fonte.status==='pausado'||!fonte.meta_token_cifrado||!fonte.identificador_externo)
  return NextResponse.json({erro:'Autorize a página antes de assinar mensagens.'},{status:409});
 if(fonte.meta_expira_em&&Date.parse(fonte.meta_expira_em)<=Date.now())
  return NextResponse.json({erro:'Credencial expirada; reautorize a conta.'},{status:409});
 let novo:'inscrita'|'falha'='falha';
 try{
  await assinarMensagensMessenger(fonte.identificador_externo,decifrarMeta(fonte.meta_token_cifrado));
  novo='inscrita';
 }catch{/* Apenas resultado genérico; não expor detalhes de credenciais. */}
 const {error:erroAtualizar}=await admin.from('crm_fontes_funil').update({
  meta_assinatura_status:novo,
  meta_assinatura_em:novo==='inscrita'?new Date().toISOString():null,
  atualizado_em:new Date().toISOString(),
 }).eq('id',fonte.id).eq('conta_id',perfil.conta_id);
 if(erroAtualizar)return NextResponse.json({erro:'Falha ao registrar inscrição.'},{status:503});
 if(novo==='falha')return NextResponse.json({
  erro:'A Meta não confirmou a inscrição. Confira pages_manage_metadata, permissão de mensagens e callback no painel do aplicativo.',
 },{status:409});
 return NextResponse.json({ok:true,assinatura:'inscrita'});
}
