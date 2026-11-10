import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {perfilAtual,supabaseAdmin,COOKIE_CONTA} from '@/lib/supabase/server';
import {COOKIE_DELEGACAO,encerrarDelegacao} from '@/lib/servicosWorkspace';

export async function POST(req:Request){
 const perfil=await perfilAtual();if(perfil?.papel!=='super_admin')return NextResponse.json({erro:'Somente super admin.'},{status:403});
 const b=await req.json().catch(()=>null);
 if(!/^[0-9a-f-]{36}$/i.test(b?.conta_id??'')||!['configuracao','suporte','homologacao'].includes(b?.modo)||
  typeof b.motivo!=='string'||b.motivo.trim().length<10||b.motivo.length>500||!Number.isInteger(b.minutos)||b.minutos<5||b.minutos>120)
  return NextResponse.json({erro:'Informe workspace, modo, motivo e prazo de 5 a 120 minutos.'},{status:400});
 const db=supabaseAdmin();
 const {data,error}=await db.rpc('servicos_delegar',{p_conta:b.conta_id,p_ator:perfil.id,p_modo:b.modo,p_motivo:b.motivo.trim(),p_minutos:b.minutos});
 if(error||!data)return NextResponse.json({erro:'Não foi possível iniciar acesso delegado. Homologação é limitada à Figueira Marketing; confira a migration 055.'},{status:409});
 const r=NextResponse.json({ok:true});const options={httpOnly:true,sameSite:'lax' as const,secure:true,path:'/',maxAge:12*3600};
 r.cookies.set(COOKIE_CONTA,b.conta_id,options);r.cookies.set(COOKIE_DELEGACAO,data,options);return r;
}
export async function DELETE(){
 const p=await perfilAtual();if(p?.papel!=='super_admin')return NextResponse.json({erro:'Somente super admin.'},{status:403});
 const jar=await cookies();const id=jar.get(COOKIE_DELEGACAO)?.value;const db=supabaseAdmin();
 if(id){try{await encerrarDelegacao(db,id,p.id);}catch{return NextResponse.json({erro:'Falha ao encerrar acesso delegado.'},{status:503});}}
 const r=NextResponse.json({ok:true});r.cookies.delete(COOKIE_DELEGACAO);return r;
}
