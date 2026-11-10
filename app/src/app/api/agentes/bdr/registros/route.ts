import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {perfilTemRecursos} from '@/lib/servicosWorkspace';
async function contexto(){
 const p=await perfilAtual();if(!p?.conta_id||p.papel==='operador')return {erro:NextResponse.json({erro:'Administrador da workspace obrigatório.'},{status:403})} as const;
 const db=supabaseAdmin();if(!(await perfilTemRecursos(db,p,['integracoes.superlogica'])))return {erro:NextResponse.json({erro:'Integração não liberada.'},{status:403})} as const;
 return {p,db} as const;
}
export async function GET(){
 const c=await contexto();if('erro'in c)return c.erro;
 const indicadores:Record<string,number|null>={};
 for(const [k,t,recurso]of [['capturas_recebidas','superlogica_entradas','integracoes.superlogica'],['registros_integracao','superlogica_registros','integracoes.superlogica'],['contatos_cadastrados','crm_contatos','crm.contatos'],['leads_cadastrados','prospecta_leads','prospeccao.base'],['oportunidades_pipeline','oportunidades','crm.oportunidades']]){
  if(!(await perfilTemRecursos(c.db,c.p,[recurso]))){indicadores[k]=null;continue;}
  const {count,error}=await c.db.from(t).select('*',{count:'exact',head:true}).eq('conta_id',c.p.conta_id);
  if(error)return NextResponse.json({erro:'Contagens indisponíveis. Nenhuma contagem foi inferida.'},{status:503});indicadores[k]=count??0;
 }
 for(const status of ['pendente','processando','cadastrado','retry','reconciliar','falha']){
  const {count,error}=await c.db.from('superlogica_registros').select('*',{count:'exact',head:true}).eq('conta_id',c.p.conta_id).eq('status_sincronizacao',status);
  if(error)return NextResponse.json({erro:'Estados de sincronização indisponíveis.'},{status:503});indicadores['integracao_'+status]=count??0;
 }
 const {data,error}=await c.db.from('superlogica_registros').select('id,nome,telefone,email,codigo_anuncio,status_sincronizacao,id_superlogica,lead_id_harvest,contato_id,oportunidade_id,erro_tecnico,criado_em')
  .eq('conta_id',c.p.conta_id).order('criado_em',{ascending:false}).limit(100);
 if(error)return NextResponse.json({erro:'Diagnóstico exige migration 058.'},{status:503});
 return NextResponse.json({indicadores,registros:data,limite:100,nota:'Capturas são entregas/protocolos; registros de integração são identidades deduplicadas. Confirmação Superlógica não cria contato ou oportunidade local automaticamente.'},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:Request){
 const c=await contexto();if('erro'in c)return c.erro;
 if(!(await perfilTemRecursos(c.db,c.p,['crm.contatos','crm.oportunidades'],'configurar')))return NextResponse.json({erro:'Cadastros CRM não liberados.'},{status:403});
 const b=await req.json().catch(()=>null);if(!/^[0-9a-f-]{36}$/i.test(b?.registro_id??''))return NextResponse.json({erro:'Captura inválida.'},{status:400});
 const {data,error}=await c.db.rpc('superlogica_vincular_crm',{p_conta:c.p.conta_id,p_registro:b.registro_id,p_ator:c.p.id});
 if(error)return NextResponse.json({erro:'Vínculo recusado. Confira duplicidades, backend Twenty ou migration 058; nenhum cadastro parcial foi mantido.'},{status:409});
 return NextResponse.json({ok:true,vinculos:data,atribuicao_externa_alterada:false});
}
