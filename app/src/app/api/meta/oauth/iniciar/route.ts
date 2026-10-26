import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
import {oauthConfigurado,urlAutorizacaoMeta,type PlataformaMeta} from '@/lib/crmMetaOAuth';

export async function POST(req:Request){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return NextResponse.json({erro:'Autentique-se.'},{status:401});
 if(!isAdmin(perfil.papel))return NextResponse.json({erro:'Somente administradores.'},{status:403});
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403});
 const b=await req.json().catch(()=>null);
 if(typeof b?.fonte_id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.fonte_id))
  return NextResponse.json({erro:'Selecione uma fonte no funil.'},{status:400});
 const {data:fonte,error}=await admin.from('crm_fontes_funil')
  .select('id,conta_id,funil_id,tipo,status').eq('id',b.fonte_id)
  .eq('conta_id',perfil.conta_id).maybeSingle();
 if(error||!fonte)return NextResponse.json({erro:'Fonte não encontrada.'},{status:404});
 if(fonte.tipo!=='instagram_dm'&&fonte.tipo!=='facebook_messenger')
  return NextResponse.json({erro:'Use o conector específico desta fonte.'},{status:400});
 if(fonte.status==='pausado')return NextResponse.json({erro:'Reative a fonte antes de autorizar.'},{status:409});
 const tipo=fonte.tipo as PlataformaMeta;
 if(!oauthConfigurado(tipo))
  return NextResponse.json({erro:'O aplicativo Meta de mensagens e seu cofre ainda não estão configurados neste Harvest. Nenhuma credencial será improvisada.'},{status:503});
 const {data:estado,error:errEstado}=await admin.from('crm_meta_oauth_estados')
  .insert({conta_id:perfil.conta_id,funil_id:fonte.funil_id,
   fonte_id:fonte.id,perfil_id:perfil.id,plataforma:tipo})
  .select('id').single();
 if(errEstado||!estado)return NextResponse.json({erro:'Não foi possível iniciar OAuth.'},{status:503});
 return NextResponse.json({url:urlAutorizacaoMeta(tipo,estado.id)},
  {headers:{'Cache-Control':'no-store'}});
}
