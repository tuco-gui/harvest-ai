import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
async function contexto(idRaw:string){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return {resposta:NextResponse.json({erro:'Sem workspace.'},{status:401})} as const;
 const id=Number(idRaw);
 if(!Number.isSafeInteger(id)||id<1)
  return {resposta:NextResponse.json({erro:'Negócio inválido.'},{status:400})} as const;
 const admin=supabaseAdmin();
 if(!(await perfilTemModulo(admin,perfil,'crm'))||
    !(await perfilTemModulo(admin,perfil,'crm_avancado')))
  return {resposta:NextResponse.json({erro:'CRM avançado indisponível.'},{status:403})} as const;
 let q=admin.from('oportunidades').select('id')
  .eq('conta_id',perfil.conta_id).eq('id',id);
 if(!isAdmin(perfil.papel))q=q.eq('owner_id',perfil.id);
 const {data:op,error}=await q.maybeSingle();
 if(error||!op)return {resposta:NextResponse.json({erro:'Negócio sem acesso.'},{status:404})} as const;
 return {perfil,admin,id} as const;
}
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await contexto((await params).id);if('resposta' in c)return c.resposta;
 const [itens,produtos]=await Promise.all([
  c.admin.from('crm_itens_oportunidade').select('produto_id,quantidade,preco_unitario')
    .eq('conta_id',c.perfil.conta_id).eq('oportunidade_id',c.id).limit(100),
  c.admin.from('crm_produtos').select('id,nome,sku,preco,ativo')
    .eq('conta_id',c.perfil.conta_id).order('nome').limit(250),
 ]);
 if(itens.error||produtos.error)return NextResponse.json({erro:'Falha ao carregar produtos.'},{status:503});
 return NextResponse.json({itens:itens.data??[],produtos:produtos.data??[]});
}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await contexto((await params).id);if('resposta' in c)return c.resposta;
 const b=await req.json().catch(()=>null);
 const produtoId=b?.produto_id,quantidade=b?.quantidade;
 if(!Number.isSafeInteger(produtoId)||produtoId<1||
    typeof quantidade!=='number'||!Number.isFinite(quantidade)||quantidade<=0||quantidade>100000)
  return NextResponse.json({erro:'Produto ou quantidade inválidos.'},{status:400});
 const {data:produto,error}=await c.admin.from('crm_produtos')
  .select('id,preco,ativo').eq('conta_id',c.perfil.conta_id).eq('id',produtoId).maybeSingle();
 if(error||!produto||!produto.ativo)
  return NextResponse.json({erro:'Produto não encontrado ou inativo.'},{status:404});
 const {data:item,error:falha}=await c.admin.from('crm_itens_oportunidade').upsert({
  conta_id:c.perfil.conta_id,oportunidade_id:c.id,produto_id:produtoId,
  quantidade,preco_unitario:produto.preco,
 },{onConflict:'conta_id,oportunidade_id,produto_id'})
 .select('produto_id,quantidade,preco_unitario').single();
 if(falha)return NextResponse.json({erro:'Falha ao adicionar produto.'},{status:500});
 return NextResponse.json({item});
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await contexto((await params).id);if('resposta' in c)return c.resposta;
 const b=await req.json().catch(()=>null);
 const produtoId=b?.produto_id;
 if(!Number.isSafeInteger(produtoId)||produtoId<1)
  return NextResponse.json({erro:'Produto inválido.'},{status:400});
 const {error}=await c.admin.from('crm_itens_oportunidade').delete()
  .eq('conta_id',c.perfil.conta_id).eq('oportunidade_id',c.id).eq('produto_id',produtoId);
 if(error)return NextResponse.json({erro:'Falha ao remover produto.'},{status:500});
 return NextResponse.json({ok:true});
}
