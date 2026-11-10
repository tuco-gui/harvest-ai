import {NextResponse} from 'next/server';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {carregarRecursos} from '@/lib/servicosWorkspace';
import {RECURSOS,recursoLiberado,origemPermissao,validarConcessoes,efeitoPermitido} from '@/lib/recursos';
import {carregarEstadosServicos} from '@/lib/estadosServicos';

async function contexto(id:string){
 const perfil=await perfilAtual();if(perfil?.papel!=='super_admin')return {resposta:NextResponse.json({erro:'Somente super admin gerencia serviços.'},{status:403})} as const;
 if(!/^[0-9a-f-]{36}$/i.test(id))return {resposta:NextResponse.json({erro:'Workspace inválida.'},{status:400})} as const;
 return {perfil,db:supabaseAdmin()} as const;
}
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const c=await contexto(id);if('resposta'in c)return c.resposta;
 try{
  const snapshot=await carregarRecursos(c.db,id);const estados=await carregarEstadosServicos(c.db,id);
  for(const st of Object.values(estados))if(st.ia_autorizada)st.ia_autorizada=efeitoPermitido(snapshot,['agentes.bdr','agentes.whatsapp','agentes.responder'],'enviar');
  const auditoria=await c.db.from('servicos_auditoria').select('id,ator_id,evento,detalhes,criado_em').eq('workspace_id',id).order('criado_em',{ascending:false}).limit(60);
  return NextResponse.json({snapshot,catalogo:RECURSOS,recursos:Object.keys(RECURSOS).map(k=>({chave:k,liberado:recursoLiberado(snapshot,k),origem:origemPermissao(snapshot,k),
    estado:estados[k]??null})),auditoria:auditoria.data??[]},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({erro:'Não foi possível carregar serviços desta workspace.'},{status:503});}
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const c=await contexto(id);if('resposta'in c)return c.resposta;
 const b=await req.json().catch(()=>null);
 if(!Array.isArray(b?.mudancas)||b.mudancas.length>Object.keys(RECURSOS).length||typeof b.motivo!=='string'||b.motivo.trim().length<10||b.motivo.length>500||!Number.isSafeInteger(b.versao))
  return NextResponse.json({erro:'Informe mudanças, versão atual e motivo de 10–500 caracteres.'},{status:400});
 try{
  const atual=await carregarRecursos(c.db,id);if(!atual.migrada)return NextResponse.json({erro:'Aplique a migration 055 antes de editar serviços.'},{status:409});
  const mudancas=b.mudancas.map((x:any)=>({recurso:x?.recurso,liberado:x?.liberado,expira_em:x?.expira_em??null}));
  const erros=validarConcessoes(atual,mudancas);if(erros.length)return NextResponse.json({erro:erros.join(' ')},{status:400});
  const {data,error}=await c.db.rpc('servicos_salvar',{p_conta:id,p_ator:c.perfil.id,p_versao:b.versao,p_motivo:b.motivo.trim(),p_mudancas:mudancas});
  if(error)return NextResponse.json({erro:error.code==='40001'?'Outra alteração ocorreu; recarregue os serviços.':'Não foi possível salvar serviços e auditoria.'},{status:error.code==='40001'?409:503});
  return NextResponse.json({ok:true,versao:data});
 }catch{return NextResponse.json({erro:'Serviços indisponíveis.'},{status:503});}
}
