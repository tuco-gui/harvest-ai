import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemModulo} from '@/lib/autorizacao';
import {isAdmin} from '@/lib/crmControleAcesso';
import {consultaAgenda} from '@/lib/crmAgenda';

export async function GET(req:Request) {
 const perfil=await perfilAtual();
 if(!perfil?.conta_id)return NextResponse.json({erro:'Sessão ou workspace ausente.'},{status:401});
 const db=supabaseAdmin();
 if(!(await perfilTemModulo(db,perfil,'crm'))||!(await perfilTemModulo(db,perfil,'crm_avancado')))
  return NextResponse.json({erro:'CRM avançado não habilitado.'},{status:403});
 let consulta:ReturnType<typeof consultaAgenda>;
 try{consulta=consultaAgenda(new URL(req.url).searchParams);}
 catch(e){return NextResponse.json({erro:e instanceof Error?e.message:'Consulta inválida.'},{status:400});}
 let q=db.from('crm_atividades').select('id,tipo,titulo,descricao,concluida,vence_em,oportunidade_id,oportunidade:oportunidades!inner(id,conta_id,empresa,contato,owner_id)',{count:'exact'})
  .eq('conta_id',perfil.conta_id).eq('oportunidade.conta_id',perfil.conta_id)
  .gte('vence_em',consulta.de).lt('vence_em',consulta.ate)
  .in('tipo',['tarefa','reuniao','ligacao','email']).order('vence_em').order('id').limit(1000);
 if(!isAdmin(perfil.papel))q=q.eq('oportunidade.owner_id',perfil.id);
 const {data,error,count}=await q;
 if(error)return NextResponse.json({erro:'Não foi possível consultar a agenda.'},{status:503});
 return NextResponse.json({eventos:data??[],...consulta,total:count??0,limite:1000,truncado:(count??0)>(data?.length??0)});
}
