import {NextResponse} from 'next/server';
import {contexto,isAdmin} from '@/lib/contextoConversasExternas';
type Ctx={params:Promise<{id:string}>};
async function carregar(id:string){
 const c=await contexto();if('erro'in c)return c;
 if(!/^[0-9a-f-]{36}$/i.test(id))return {erro:NextResponse.json({erro:'Conversa inválida.'},{status:400})} as const;
 const {admin,perfil}=c;
 const {data:conversa,error}=await admin.from('crm_conversas_externas')
  .select('id,fonte_id,nome,visitante_id,status,responsavel_id,criado_em,atualizado_em')
  .eq('id',id).eq('conta_id',perfil.conta_id).maybeSingle();
 if(error)return {erro:NextResponse.json({erro:'Falha ao consultar conversa.'},{status:503})} as const;
 if(!conversa)return {erro:NextResponse.json({erro:'Conversa não encontrada.'},{status:404})} as const;
 if(!isAdmin(perfil.papel)&&conversa.responsavel_id!==perfil.id)
  return {erro:NextResponse.json({erro:'Sem permissão para esta conversa.'},{status:403})} as const;
 const {data:fonte}=await admin.from('crm_fontes_funil')
  .select('id,nome,tipo,status,funil_id').eq('id',conversa.fonte_id)
  .eq('conta_id',perfil.conta_id).maybeSingle();
 if(!fonte)return {erro:NextResponse.json({erro:'Fonte não encontrada.'},{status:404})} as const;
 return {...c,conversa,fonte} as const;
}
export async function GET(_req:Request,{params}:Ctx){
 const c=await carregar((await params).id);if('erro'in c)return c.erro;
 const {data:mensagens,error}=await c.admin.from('crm_mensagens_externas')
  .select('id,texto,direcao,criado_em')
  .eq('conta_id',c.perfil.conta_id).eq('conversa_id',c.conversa.id)
  .order('criado_em',{ascending:true}).limit(200);
 if(error)return NextResponse.json({erro:'Falha ao ler histórico.'},{status:503});
 return NextResponse.json({conversa:c.conversa,fonte:c.fonte,mensagens:mensagens??[]});
}
export async function PATCH(req:Request,{params}:Ctx){
 const c=await carregar((await params).id);if('erro'in c)return c.erro;
 const b=await req.json().catch(()=>null);
 const dados:Record<string,unknown>={};
 if(b?.status!==undefined){
  if(!['aberto','pendente','resolvido'].includes(b.status))
   return NextResponse.json({erro:'Status inválido.'},{status:400});
  dados.status=b.status;
 }
 if(b?.responsavel_id!==undefined){
  if(!isAdmin(c.perfil.papel))return NextResponse.json({erro:'Sem permissão para transferir.'},{status:403});
  if(b.responsavel_id!==null && typeof b.responsavel_id!=='string')
   return NextResponse.json({erro:'Responsável inválido.'},{status:400});
  if(b.responsavel_id){
   const {data:atendente}=await c.admin.from('perfis').select('id')
    .eq('id',b.responsavel_id).eq('conta_id',c.perfil.conta_id).maybeSingle();
   if(!atendente)return NextResponse.json({erro:'Responsável não pertence à workspace.'},{status:403});
  }
  dados.responsavel_id=b.responsavel_id;
 }
 if(!Object.keys(dados).length)return NextResponse.json({erro:'Nenhuma alteração.'},{status:400});
 dados.atualizado_em=new Date().toISOString();
 const {data,error}=await c.admin.from('crm_conversas_externas').update(dados)
  .eq('conta_id',c.perfil.conta_id).eq('id',c.conversa.id)
  .select('id,status,responsavel_id,atualizado_em').single();
 if(error)return NextResponse.json({erro:'Falha ao atualizar atendimento.'},{status:503});
 return NextResponse.json({conversa:data});
}
export async function POST(req:Request,{params}:Ctx){
 const c=await carregar((await params).id);if('erro'in c)return c.erro;
 // Instagram/Messenger nunca são respondidos pelo webchat. A conexão real
 // exigirá OAuth e mensagens/webhooks oficiais previamente homologados.
 if(c.fonte.tipo!=='webchat'||c.fonte.status!=='pronto')
  return NextResponse.json({erro:'A fonte não possui envio habilitado.'},{status:409});
 const b=await req.json().catch(()=>null);
 if(typeof b?.texto!=='string'||b.texto.trim().length<1||b.texto.trim().length>2000)
  return NextResponse.json({erro:'Mensagem entre 1 e 2000 caracteres.'},{status:400});
 const {data,error}=await c.admin.from('crm_mensagens_externas').insert({
  conta_id:c.perfil.conta_id,conversa_id:c.conversa.id,
  direcao:'saida',texto:b.texto.trim(),
 }).select('id,texto,direcao,criado_em').single();
 if(error)return NextResponse.json({erro:'Não foi possível responder.'},{status:503});
 await c.admin.from('crm_conversas_externas').update({atualizado_em:new Date().toISOString()})
  .eq('id',c.conversa.id).eq('conta_id',c.perfil.conta_id);
 return NextResponse.json({mensagem:data},{status:201});
}
