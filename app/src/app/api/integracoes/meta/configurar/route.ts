import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
import {configuracaoMeta,redirectUriMeta,tokenVerificacaoMeta,ORIGEM_HARVEST} from '@/lib/crmMetaOAuth';

/** Config do webhook para a pessoa ADMIN que configura o mesmo Meta App.
 * Não devolve App Secret nem tokens de sessão do cliente.
 */
export async function GET(){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id||!isAdmin(perfil.papel))
  return NextResponse.json({erro:'Acesso reservado ao administrador.'},{status:403});
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403});
 const app=configuracaoMeta('facebook_messenger');
 const token=tokenVerificacaoMeta();
 if(!app||!token)return NextResponse.json({
  erro:'App ID ou App Secret ainda não habilitados no Harvest.',
 },{status:503});
 return NextResponse.json({
  app_id:app.id,
  webhook_url:ORIGEM_HARVEST+'/api/webhook/meta-mensagens',
  verify_token:token,
  oauth_facebook:redirectUriMeta('facebook_messenger'),
  oauth_instagram:redirectUriMeta('instagram_dm'),
 },{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
