import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemRecursos} from '@/lib/servicosWorkspace';
export async function GET(req:Request){
 const p=await perfilAtual();if(!p?.conta_id)return NextResponse.json({erro:'Selecione uma workspace.'},{status:401});
 if(p.papel==='operador')return NextResponse.json({erro:'Indicadores administrativos.'},{status:403});
 const db=supabaseAdmin();const relatorio=new URL(req.url).pathname.endsWith('/relatorios');
 if(!(await perfilTemRecursos(db,p,[relatorio?'analytics.relatorios':'analytics.dashboards'])))return NextResponse.json({erro:'Analytics não liberado.'},{status:403});
 const indicadores:Record<string,number|null>={};
 for(const [recurso,tabela,chave]of [['prospeccao.base','prospecta_leads','leads'],['crm.oportunidades','oportunidades','oportunidades_locais'],['inbox.atendimento','inbound_eventos','mensagens_recebidas'],['prospeccao.campanhas','prospecta_campanhas','campanhas']]){
  if(!(await perfilTemRecursos(db,p,[recurso]))){indicadores[chave]=null;continue;}
  const {count,error}=await db.from(tabela).select('id',{count:'exact',head:true}).eq('conta_id',p.conta_id);
  if(error)return NextResponse.json({erro:'Indicadores indisponíveis.'},{status:503});indicadores[chave]=count??0;
 }
 return NextResponse.json({workspace_id:p.conta_id,indicadores,origem:'Registros locais do Harvest; não representam confirmação externa do CRM.',gerado_em:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
}
