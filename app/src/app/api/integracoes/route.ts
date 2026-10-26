import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { oauthConfigurado } from '@/lib/crmMetaOAuth';

export const dynamic='force-dynamic';
const TIPOS=['instagram_dm','facebook_messenger','whatsapp_cloud_api','webchat'] as const;
type Tipo=typeof TIPOS[number];
async function contexto(){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return {erro:NextResponse.json({erro:'Entre na workspace para acessar integrações.'},{status:401})} as const;
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return {erro:NextResponse.json({erro:'Integrações disponíveis no CRM avançado.'},{status:403})} as const;
 return {perfil,admin} as const;
}
/** O cadastro do conector pertence à workspace. O funil é selecionado
 * antes de iniciar o OAuth, e a fonte jamais é copiada para outro tenant.
 */
export async function GET(){
 const c=await contexto();if('erro'in c)return c.erro;
 const {admin,perfil}=c;
 const [funis,fontes,numeros]=await Promise.all([
  admin.from('funis').select('id,nome,ativo,canal_padrao_id').eq('conta_id',perfil.conta_id)
   .order('nome').limit(200),
  admin.from('crm_fontes_funil').select('id,funil_id,tipo,nome,status,dominio,identificador_externo,meta_token_cifrado,meta_assinatura_status,meta_assinatura_em,token_publico,criado_em')
   .eq('conta_id',perfil.conta_id).order('criado_em',{ascending:false}).limit(200),
  admin.from('whatsapp_canais').select('id,nome,provider,numero,status,ativo')
   .eq('conta_id',perfil.conta_id).order('id').limit(200),
 ]);
 if(funis.error||fontes.error||numeros.error)
  return NextResponse.json({erro:'Não foi possível carregar as integrações desta workspace.'},{status:503});
 const podeGerenciar=isAdmin(perfil.papel);
 const lista=(fontes.data??[]).map(({meta_token_cifrado,token_publico,...f})=>({
  ...f,autorizado:Boolean(meta_token_cifrado),
  ...(podeGerenciar&&f.tipo==='webchat'?{token_publico}:{}),
 }));
 return NextResponse.json({funis:funis.data??[],fontes:lista,numeros:numeros.data??[],
  podeGerenciar,appMeta:{
   instagram:oauthConfigurado('instagram_dm'),
   messenger:oauthConfigurado('facebook_messenger'),
  }},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:Request){
 const c=await contexto();if('erro'in c)return c.erro;
 if(!isAdmin(c.perfil.papel))
  return NextResponse.json({erro:'Somente administradores podem conectar canais.'},{status:403});
 const b=await req.json().catch(()=>null);
 const tipo:Tipo|undefined=TIPOS.find(t=>t===b?.tipo);
 const funilId=Number(b?.funil_id);
 if(!tipo||!Number.isSafeInteger(funilId)||funilId<=0)
  return NextResponse.json({erro:'Escolha um canal e um funil válido.'},{status:400});
 const {data:funil}=await c.admin.from('funis').select('id').eq('id',funilId)
  .eq('conta_id',c.perfil.conta_id).eq('ativo',true).maybeSingle();
 if(!funil)return NextResponse.json({erro:'Funil indisponível nesta workspace.'},{status:404});
 if(tipo==='whatsapp_cloud_api')
  return NextResponse.json({erro:'WhatsApp oficial ainda requer conexão específica na Meta. Não será marcado como ativo.'},{status:409});
 // Reutilizar a fonte no mesmo funil evita criar uma nova conexão a cada clique.
 const {data:existentes,error:errExiste}=await c.admin.from('crm_fontes_funil')
  .select('id,tipo,funil_id,status').eq('conta_id',c.perfil.conta_id)
  .eq('funil_id',funilId).eq('tipo',tipo).neq('status','pausado')
  .order('criado_em',{ascending:false}).limit(1);
 if(errExiste)return NextResponse.json({erro:'Não foi possível verificar as fontes existentes.'},{status:503});
 if(existentes?.[0])return NextResponse.json({fonte:existentes[0],existente:true});
 const nome=tipo==='instagram_dm'?'Instagram Direct':
  tipo==='facebook_messenger'?'Facebook Messenger':'Webchat do site';
 const {data,error}=await c.admin.from('crm_fontes_funil').insert({
   conta_id:c.perfil.conta_id,funil_id:funilId,tipo,nome,
   status:tipo==='webchat'?'pronto':'aguardando_autorizacao',
 }).select('id,tipo,funil_id,status').single();
 if(error)return NextResponse.json({erro:'Falha ao criar a fonte nesta workspace.'},{status:503});
 return NextResponse.json({fonte:data,existente:false},{status:201});
}
