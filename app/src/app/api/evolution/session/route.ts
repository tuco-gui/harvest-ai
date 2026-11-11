import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {carregarCanais} from '@/lib/whatsappCanais';
import {credencialEvolution,estadoEvolution,codigoEvolution} from '@/lib/evolutionPareamento';

async function resolver(req:Request){
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return {erro:NextResponse.json({erro:'Selecione uma workspace.'},{status:401})} as const;
 if(perfil.papel==='operador')return {erro:NextResponse.json({erro:'Sem permissão para pareamento.'},{status:403})} as const;
 const id=Number(new URL(req.url).searchParams.get('canalId'));
 if(!Number.isInteger(id)||id<=0)return {erro:NextResponse.json({erro:'Canal inválido.'},{status:400})} as const;
 const admin=supabaseAdmin(),canais=await carregarCanais(admin,perfil.conta_id);
 const canal=canais.find(x=>x.id===id&&x.provider==='evolution'&&x.ativo);
 if(!canal)return {erro:NextResponse.json({erro:'Canal Evolution não encontrado nesta workspace.'},{status:404})} as const;
 return {admin,perfil,canal} as const;
}
export async function GET(req:Request){
 const x=await resolver(req);if('erro'in x)return x.erro;
 try {
  const cred=await credencialEvolution(x.admin,x.perfil.conta_id,x.canal);
  const r=await estadoEvolution(cred);
  // Atualiza somente o registro do canal, jamais estado de outras empresas.
  await x.admin.from('whatsapp_canais').update({status:r.status==='WORKING'?'conectado':'desconectado',
    atualizado_em:new Date().toISOString()}).eq('id',x.canal.id).eq('conta_id',x.perfil.conta_id);
  return NextResponse.json(r,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({erro:e instanceof Error?e.message:'Evolution indisponível.'},{status:502})}
}
export async function POST(req:Request){
 const x=await resolver(req);if('erro'in x)return x.erro;
 const body=await req.json().catch(()=>({}));
 const telefone=typeof body.telefone==='string'?body.telefone.replace(/\D/g,''):'';
 if(!/^\d{10,15}$/.test(telefone))return NextResponse.json({erro:'Informe um telefone válido com DDI e DDD.'},{status:400});
 if(x.canal.numero&&x.canal.numero.replace(/\D/g,'')!==telefone)
   return NextResponse.json({erro:'Telefone diferente do registrado no canal.'},{status:409});
 try{
  const cred=await credencialEvolution(x.admin,x.perfil.conta_id,x.canal);
  const codigo=await codigoEvolution(cred,telefone);
  return NextResponse.json({codigo},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({erro:e instanceof Error?e.message:'Evolution indisponível.'},{status:502})}
}
