import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { entidadeCampoValida, validarDefCampo } from '@/lib/crmCadastros';

async function sessao() {
  const perfil=await perfilAtual();
  if(!perfil?.conta_id)return { resposta:NextResponse.json({erro:'Sessão expirada.'},{status:401}) } as const;
  const admin=supabaseAdmin();
  if(!(await perfilTemModulo(admin,perfil,'crm'))||
     !(await perfilTemModulo(admin,perfil,'crm_avancado')))
    return { resposta:NextResponse.json({erro:'CRM avançado indisponível.'},{status:403}) } as const;
  return {perfil,admin} as const;
}
export async function GET(req:Request){
  const s=await sessao(); if('resposta' in s)return s.resposta;
  const entidade=new URL(req.url).searchParams.get('entidade');
  if(!entidadeCampoValida(entidade))return NextResponse.json({erro:'Entidade inválida.'},{status:400});
  const {data,error}=await s.admin.from('crm_campos_personalizados')
    .select('id,entidade,chave,rotulo,tipo,opcoes,obrigatorio,ativo')
    .eq('conta_id',s.perfil.conta_id).eq('entidade',entidade).order('id').limit(100);
  if(error)return NextResponse.json({erro:'Falha ao ler campos.'},{status:503});
  return NextResponse.json({campos:data??[],podeGerenciar:isAdmin(s.perfil.papel)});
}
export async function POST(req:Request){
  const s=await sessao();if('resposta' in s)return s.resposta;
  if(!isAdmin(s.perfil.papel))return NextResponse.json({erro:'Somente administrador cria campos.'},{status:403});
  const b=await req.json().catch(()=>null);
  const erro=validarDefCampo(b);
  if(erro)return NextResponse.json({erro},{status:400});
  const {data,error}=await s.admin.from('crm_campos_personalizados').insert({
    conta_id:s.perfil.conta_id,entidade:b.entidade,chave:b.chave,rotulo:b.rotulo.trim(),
    tipo:b.tipo,opcoes:b.tipo==='selecao'?b.opcoes:[],
    obrigatorio:b.obrigatorio,ativo:true,
  }).select('id,entidade,chave,rotulo,tipo,opcoes,obrigatorio,ativo').single();
  if(error)return NextResponse.json({erro:'Falha ao criar campo. Chave já existente?'},{status:500});
  return NextResponse.json({campo:data},{status:201});
}
export async function PATCH(req:Request){
  const s=await sessao();if('resposta' in s)return s.resposta;
  if(!isAdmin(s.perfil.papel))return NextResponse.json({erro:'Somente administrador altera campos.'},{status:403});
  const b=await req.json().catch(()=>null);
  if(!Number.isSafeInteger(b?.id)||!entidadeCampoValida(b?.entidade)||
      typeof b?.ativo!=='boolean')
    return NextResponse.json({erro:'Dados inválidos.'},{status:400});
  // Não alterar a chave, o tipo ou apagar os valores existentes, evitando
  // corrupção silenciosa de campos utilizados em contatos/negócios.
  const {data,error}=await s.admin.from('crm_campos_personalizados')
    .update({ativo:b.ativo}).eq('id',b.id).eq('conta_id',s.perfil.conta_id)
    .eq('entidade',b.entidade).select('id,entidade,chave,rotulo,tipo,opcoes,obrigatorio,ativo').maybeSingle();
  if(error||!data)return NextResponse.json({erro:'Não foi possível alterar o campo.'},{status:500});
  return NextResponse.json({campo:data});
}
