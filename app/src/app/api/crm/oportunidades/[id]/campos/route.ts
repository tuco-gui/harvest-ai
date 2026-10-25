import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
import {validarValoresPersonalizados,type CampoDef} from '@/lib/crmCadastros';

async function sessao(idRaw:string){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return {resposta:NextResponse.json({erro:'Sem workspace.'},{status:401})} as const;
 const opId=Number(idRaw);
 if(!Number.isSafeInteger(opId)||opId<1)
  return {resposta:NextResponse.json({erro:'Negócio inválido.'},{status:400})} as const;
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm'))||
    !(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return {resposta:NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403})} as const;
 let query=admin.from('oportunidades')
  .select('id,owner_id,empresa_id,contato_id,campos_extras')
  .eq('conta_id',perfil.conta_id).eq('id',opId);
 if(!isAdmin(perfil.papel))query=query.eq('owner_id',perfil.id);
 const {data:op,error}=await query.maybeSingle();
 if(error||!op)return {resposta:NextResponse.json({erro:'Negócio não encontrado ou sem acesso.'},{status:404})} as const;
 return {perfil,admin,op} as const;
}
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const s=await sessao((await params).id);if('resposta' in s)return s.resposta;
 const [campos,empresas,contatos]=await Promise.all([
  s.admin.from('crm_campos_personalizados')
    .select('id,entidade,chave,rotulo,tipo,opcoes,obrigatorio,ativo,grupo')
    .eq('conta_id',s.perfil.conta_id).eq('entidade','oportunidade').order('id').limit(100),
  s.admin.from('crm_empresas').select('id,nome')
    .eq('conta_id',s.perfil.conta_id).order('nome').limit(250),
  s.admin.from('crm_contatos').select('id,nome,empresa_id')
    .eq('conta_id',s.perfil.conta_id).order('nome').limit(250),
 ]);
 if(campos.error||empresas.error||contatos.error)
  return NextResponse.json({erro:'Falha ao carregar campos comerciais.'},{status:503});
 return NextResponse.json({campos:campos.data??[],empresas:empresas.data??[],
   contatos:contatos.data??[],valores:s.op.campos_extras??{},
   empresa_id:s.op.empresa_id,contato_id:s.op.contato_id});
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const s=await sessao((await params).id);if('resposta' in s)return s.resposta;
 const b=await req.json().catch(()=>null);
 if(!b||typeof b!=='object'||Array.isArray(b))
  return NextResponse.json({erro:'Dados inválidos.'},{status:400});
 const {data:campos,error}=await s.admin.from('crm_campos_personalizados')
  .select('id,entidade,chave,rotulo,tipo,opcoes,obrigatorio,ativo,grupo')
  .eq('conta_id',s.perfil.conta_id).eq('entidade','oportunidade');
 if(error)return NextResponse.json({erro:'Falha ao validar definições.'},{status:503});
 const v=validarValoresPersonalizados(b.campos_extras??{},(campos??[]) as CampoDef[]);
 if(!v.ok)return NextResponse.json({erro:v.erro},{status:400});
 for(const tipo of ['empresa','contato'] as const){
  const campo=tipo+'_id';
  const id=b[campo];
  if(id!==null&&id!==undefined&&(!Number.isSafeInteger(id)||id<1))
   return NextResponse.json({erro:'Vínculo inválido: '+campo},{status:400});
  if(id){
   const {data:registro,error:erroRegistro}=await s.admin.from(tipo==='empresa'?'crm_empresas':'crm_contatos')
     .select('id').eq('conta_id',s.perfil.conta_id).eq('id',id).maybeSingle();
   if(erroRegistro||!registro)
    return NextResponse.json({erro:'Registro vinculado não existe nesta workspace.'},{status:400});
  }
 }
 const {data, error:falha}=await s.admin.from('oportunidades').update({
  campos_extras:v.valores,
  empresa_id:b.empresa_id??null,
  contato_id:b.contato_id??null,
  atualizado_em:new Date().toISOString(),
 }).eq('conta_id',s.perfil.conta_id).eq('id',s.op.id)
   .select('id,campos_extras,empresa_id,contato_id').maybeSingle();
 if(falha||!data)return NextResponse.json({erro:'Não foi possível atualizar o negócio.'},{status:500});
 return NextResponse.json({oportunidade:data});
}
