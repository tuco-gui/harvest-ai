import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { cadastroValido, validarCadastro, validarValoresPersonalizados,
  type EntidadeCadastro, type CampoDef } from '@/lib/crmCadastros';

const TABELAS:Record<EntidadeCadastro,string> = {
  empresas:'crm_empresas', contatos:'crm_contatos', produtos:'crm_produtos',
};
const CAMPOS:Record<EntidadeCadastro,string[]> = {
  empresas:['nome','cnpj','telefone','email','site','setor','campos_extras'],
  contatos:['nome','telefone','email','cargo','empresa_id','campos_extras'],
  produtos:['nome','sku','descricao','preco','moeda','ativo'],
};
const NOMES:{[K in EntidadeCadastro]: 'empresa'|'contato'|null} = {
  empresas:'empresa',contatos:'contato',produtos:null,
};
async function contexto(entidade:string) {
  const perfil=await perfilAtual();
  if(!perfil?.conta_id) return { resposta:NextResponse.json({erro:'Sessão expirada ou workspace ausente.'},{status:401}) } as const;
  if(!cadastroValido(entidade)) return { resposta:NextResponse.json({erro:'Cadastro inválido.'},{status:404}) } as const;
  const admin=supabaseAdmin();
  if(!(await perfilTemModulo(admin,perfil,'crm'))||
     !(await perfilTemModulo(admin,perfil,'crm_avancado')))
    return { resposta:NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403}) } as const;
  if(!isAdmin(perfil.papel))
    return { resposta:NextResponse.json({erro:'Cadastro restrito à administração.'},{status:403}) } as const;
  return {perfil,admin,entidade} as const;
}
async function validarESanitizar(admin:ReturnType<typeof supabaseAdmin>,contaId:string,entidade:EntidadeCadastro,b:any) {
  const falha=validarCadastro(entidade,b);
  if(falha) return { erro:falha } as const;
  const novo:Record<string,unknown>={};
  for(const chave of CAMPOS[entidade]){
    if(Object.prototype.hasOwnProperty.call(b,chave)){
      novo[chave]=typeof b[chave]==='string'?b[chave].trim():b[chave];
    }
  }
  novo.nome=b.nome.trim();
  if(entidade==='empresas'&&typeof novo.cnpj==='string')novo.cnpj=(novo.cnpj as string).replace(/\D/g,'')||null;
  if(entidade==='produtos'){
    novo.moeda='BRL';novo.preco=Math.round(b.preco*100)/100;
  }
  if(entidade==='contatos'&&novo.empresa_id){
    const {data,error}=await admin.from('crm_empresas').select('id').eq('conta_id',contaId)
      .eq('id',novo.empresa_id).maybeSingle();
    if(error||!data)return {erro:'Empresa não pertence à workspace.'} as const;
  }
  if(NOMES[entidade]){
    const {data:defs,error}=await admin.from('crm_campos_personalizados')
      .select('id,entidade,chave,rotulo,tipo,opcoes,obrigatorio,ativo')
      .eq('conta_id',contaId).eq('entidade',NOMES[entidade]);
    if(error)return {erro:'Falha ao validar campos personalizados.'} as const;
    const extras=validarValoresPersonalizados(b.campos_extras??{},(defs??[]) as CampoDef[]);
    if(!extras.ok)return {erro:extras.erro} as const;
    novo.campos_extras=extras.valores;
  }
  return {novo} as const;
}
export async function GET(_req:Request,{params}:{params:Promise<{entidade:string}>}) {
  const c=await contexto((await params).entidade);
  if('resposta' in c)return c.resposta;
  const {data,error}=await c.admin.from(TABELAS[c.entidade])
    .select('*').eq('conta_id',c.perfil.conta_id).order('atualizado_em',{ascending:false}).limit(250);
  if(error)return NextResponse.json({erro:'Falha ao carregar registros.'},{status:503});
  return NextResponse.json({ registros:data??[],limite:250 });
}
export async function POST(req:Request,{params}:{params:Promise<{entidade:string}>}) {
  const c=await contexto((await params).entidade);
  if('resposta' in c)return c.resposta;
  const b=await req.json().catch(()=>null);
  const check=await validarESanitizar(c.admin,c.perfil.conta_id!,c.entidade,b);
  if('erro' in check)return NextResponse.json({erro:check.erro},{status:400});
  const {data,error}=await c.admin.from(TABELAS[c.entidade])
    .insert({ ...check.novo,conta_id:c.perfil.conta_id })
    .select('*').single();
  if(error)return NextResponse.json({erro:'Falha ao criar registro. Confira duplicidade ou campos.'},{status:500});
  return NextResponse.json({registro:data},{status:201});
}
export async function PATCH(req:Request,{params}:{params:Promise<{entidade:string}>}) {
  const c=await contexto((await params).entidade);
  if('resposta' in c)return c.resposta;
  const b=await req.json().catch(()=>null);
  const id=b?.id;
  if(!Number.isSafeInteger(id)||id<1)
    return NextResponse.json({erro:'Registro inválido.'},{status:400});
  const check=await validarESanitizar(c.admin,c.perfil.conta_id!,c.entidade,b);
  if('erro' in check)return NextResponse.json({erro:check.erro},{status:400});
  const {data,error}=await c.admin.from(TABELAS[c.entidade])
    .update({...check.novo,atualizado_em:new Date().toISOString()})
    .eq('conta_id',c.perfil.conta_id).eq('id',id).select('*').maybeSingle();
  if(error||!data)return NextResponse.json({erro:'Falha ao atualizar registro.'},{status:500});
  return NextResponse.json({registro:data});
}
