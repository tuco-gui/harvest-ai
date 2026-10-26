import { NextResponse } from 'next/server';
import { perfilAtual,supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { CANAIS_HARVEST } from '@/lib/canaisUnificados';

type Ctx={params:Promise<{id:string}>};
const TIPOS=new Set<string>(CANAIS_HARVEST
 .filter(c=>c.id!=='google_business_messages' && !c.id.startsWith('whatsapp_waha')
 && !c.id.startsWith('whatsapp_evolution')).map(c=>c.id));
function nomePadrao(tipo:string):string{
 return CANAIS_HARVEST.find(c=>c.id===tipo)?.nome??'Fonte de lead';
}
function dominioValido(valor:unknown):string|null|undefined {
 if(valor===null||valor===undefined||valor==='')return null;
 if(typeof valor!=='string'||valor.length>253)return undefined;
 try{
  const url=new URL(valor.includes('://')?valor:'https://'+valor);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||
    url.search||url.hash||url.port||!url.hostname.includes('.')||url.hostname==='localhost')
    return undefined;
  return url.hostname.toLowerCase();
 }catch{return undefined;}
}
async function contexto(id:string){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return {erro:NextResponse.json({erro:'Autentique-se e selecione a workspace.'},{status:401})} as const;
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm'))||
   !(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return {erro:NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403})} as const;
 const {data:funil,error}=await admin.from('funis').select('id')
  .eq('id',id).eq('conta_id',perfil.conta_id).maybeSingle();
 if(error||!funil)return {erro:NextResponse.json({erro:'Funil não localizado.'},{status:404})} as const;
 return {perfil,admin,funil} as const;
}
export async function GET(_req:Request,{params}:Ctx){
 const c=await contexto((await params).id);if('erro'in c)return c.erro;
 const {data,error}=await c.admin.from('crm_fontes_funil')
  .select('id,funil_id,tipo,nome,identificador_externo,dominio,status,token_publico,meta_token_cifrado,zernio_account_id,criar_lead_automatico,meta_assinatura_status,criado_em')
  .eq('conta_id',c.perfil.conta_id).eq('funil_id',c.funil.id)
  .order('criado_em',{ascending:true}).limit(100);
 if(error)return NextResponse.json({erro:'Falha ao listar fontes.'},{status:503});
 // Token é público para incorporação, mas só o administrador recebe a lista completa.
 const fontes=(data??[]).map(({meta_token_cifrado,token_publico,...r})=>({
  ...r,meta_autorizado:Boolean(meta_token_cifrado||r.zernio_account_id),
  ...(isAdmin(c.perfil.papel)?{token_publico}:{}),
 }));
 return NextResponse.json({fontes,podeGerenciar:isAdmin(c.perfil.papel)});
}
export async function POST(req:Request,{params}:Ctx){
 const c=await contexto((await params).id);if('erro'in c)return c.erro;
 if(!isAdmin(c.perfil.papel))return NextResponse.json({erro:'Apenas administradores.'},{status:403});
 const b=await req.json().catch(()=>null);
 if(!b||typeof b.tipo!=='string'||!TIPOS.has(b.tipo))
  return NextResponse.json({erro:'Tipo de fonte inválido ou descontinuado.'},{status:400});
 const nome=typeof b.nome==='string'&&b.nome.trim()?b.nome.trim():nomePadrao(b.tipo);
 if(nome.length<2||nome.length>100)return NextResponse.json({erro:'Nome entre 2 e 100 caracteres.'},{status:400});
 const dominio=dominioValido(b.dominio);
 if(dominio===undefined)return NextResponse.json({erro:'Informe um domínio HTTPS válido, sem caminhos.'},{status:400});
 // Canais Meta precisam de OAuth e autorização específica do ativo na workspace.
 // Cadastros sem autorização ficam explicitamente pendentes, NUNCA prontos.
 const status=b.tipo==='webchat'?'pronto':'aguardando_autorizacao';
 const {data,error}=await c.admin.from('crm_fontes_funil').insert({
  conta_id:c.perfil.conta_id,funil_id:c.funil.id,tipo:b.tipo,nome,
  dominio:b.tipo==='webchat'?dominio:null,status,
 }).select('id,funil_id,tipo,nome,dominio,status,token_publico').single();
 if(error||!data)return NextResponse.json({erro:'Não foi possível cadastrar a fonte.'},{status:503});
 return NextResponse.json({fonte:data},{status:201});
}
export async function PATCH(req:Request,{params}:Ctx){
 const c=await contexto((await params).id);if('erro'in c)return c.erro;
 if(!isAdmin(c.perfil.papel))return NextResponse.json({erro:'Apenas administradores.'},{status:403});
 const b=await req.json().catch(()=>null);
 if(typeof b?.id!=='string')return NextResponse.json({erro:'Fonte inválida.'},{status:400});
 const {data:atual}=await c.admin.from('crm_fontes_funil').select('id,tipo,status')
  .eq('id',b.id).eq('conta_id',c.perfil.conta_id).eq('funil_id',c.funil.id).maybeSingle();
 if(!atual)return NextResponse.json({erro:'Fonte não encontrada.'},{status:404});
 const dados:Record<string,unknown>={};
 if(b.status==='pausado')dados.status='pausado';
 else if(b.status==='pronto'&&atual.tipo==='webchat')dados.status='pronto';
 else if(b.status==='reativar'&&atual.status==='pausado')dados.status='aguardando_autorizacao';
 else if(b.status!==undefined)return NextResponse.json({erro:'A ativação Meta requer autorização verificada.'},{status:403});
 if(b.criar_lead_automatico!==undefined){
  if(typeof b.criar_lead_automatico!=='boolean'||!['instagram_dm','facebook_messenger'].includes(atual.tipo))
   return NextResponse.json({erro:'Configuração de leads inválida.'},{status:400});
  dados.criar_lead_automatico=b.criar_lead_automatico;
 }
 if(b.nome!==undefined){
  if(typeof b.nome!=='string'||b.nome.trim().length<2||b.nome.trim().length>100)
   return NextResponse.json({erro:'Nome inválido.'},{status:400});
  dados.nome=b.nome.trim();
 }
 if(b.dominio!==undefined){
  if(atual.tipo!=='webchat')return NextResponse.json({erro:'Domínio só se aplica ao webchat.'},{status:400});
  const dominio=dominioValido(b.dominio);
  if(dominio===undefined)return NextResponse.json({erro:'Domínio inválido.'},{status:400});
  dados.dominio=dominio;
 }
 if(!Object.keys(dados).length)return NextResponse.json({erro:'Nenhuma alteração.'},{status:400});
 dados.atualizado_em=new Date().toISOString();
 const {data,error}=await c.admin.from('crm_fontes_funil').update(dados)
  .eq('id',atual.id).eq('conta_id',c.perfil.conta_id).eq('funil_id',c.funil.id)
  .select('id,funil_id,tipo,nome,status,dominio,token_publico').single();
 if(error)return NextResponse.json({erro:'Não foi possível salvar a fonte.'},{status:503});
 return NextResponse.json({fonte:data});
}
