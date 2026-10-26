import { createHash,timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

type Ctx={params:Promise<{token:string}>};
type Fonte={id:string;conta_id:string;nome:string;dominio:string|null;tipo:string;status:string};
function hashSegredo(fonteId:string,segredo:string){
 return createHash('sha256').update(fonteId+':'+segredo).digest('hex');
}
function segredoValido(valor:unknown):valor is string {
 return typeof valor==='string'&&/^[a-f0-9]{64}$/i.test(valor);
}
function sessaoValida(valor:unknown):valor is string {
 return typeof valor==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}
async function carregarFonte(token:string):Promise<Fonte|null>{
 if(!sessaoValida(token))return null;
 const {data}=await supabaseAdmin().from('crm_fontes_funil')
  .select('id,conta_id,nome,dominio,tipo,status')
  .eq('token_publico',token).eq('tipo','webchat').maybeSingle();
 return data??null;
}
function naoEncontrado(){return NextResponse.json({erro:'Webchat não disponível.'},{status:404});}
function conferirSegredo(atual:string,enviado:string){
 try {return timingSafeEqual(Buffer.from(atual,'hex'),Buffer.from(enviado,'hex')); }
 catch{return false;}
}
export async function GET(req:Request,{params}:Ctx){
 const fonte=await carregarFonte((await params).token);
 if(!fonte||fonte.status!=='pronto')return naoEncontrado();
 const p=new URL(req.url).searchParams;
 const visitante=p.get('visitante'),segredo=p.get('segredo');
 const padrao={nome:fonte.nome,mensagens:[],habilitado:true};
 if(!visitante&&!segredo)return NextResponse.json(padrao,{headers:{'Cache-Control':'no-store'}});
 if(!sessaoValida(visitante)||!segredoValido(segredo))
  return NextResponse.json({erro:'Sessão inválida.'},{status:400});
 const admin=supabaseAdmin();
 const {data:conversa}=await admin.from('crm_conversas_externas')
  .select('id,segredo_hash,status').eq('conta_id',fonte.conta_id)
  .eq('fonte_id',fonte.id).eq('visitante_id',visitante).maybeSingle();
 if(!conversa)return NextResponse.json(padrao,{headers:{'Cache-Control':'no-store'}});
 if(!conferirSegredo(conversa.segredo_hash,hashSegredo(fonte.id,segredo)))
  return NextResponse.json({erro:'Sessão não autorizada.'},{status:403});
 const {data,error}=await admin.from('crm_mensagens_externas')
  .select('id,direcao,texto,criado_em').eq('conta_id',fonte.conta_id)
  .eq('conversa_id',conversa.id).order('criado_em',{ascending:true}).limit(200);
 if(error)return NextResponse.json({erro:'Falha ao consultar conversa.'},{status:503});
 return NextResponse.json({...padrao,mensagens:data??[],status:conversa.status},
  {headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:Request,{params}:Ctx){
 const token=(await params).token;
 const fonte=await carregarFonte(token);
 if(!fonte||fonte.status!=='pronto')return naoEncontrado();
 if(Number(req.headers.get('content-length')||0)>9000)
  return NextResponse.json({erro:'Mensagem muito grande.'},{status:413});
 const body=await req.json().catch(()=>null);
 if(!sessaoValida(body?.visitante)||!segredoValido(body?.segredo))
  return NextResponse.json({erro:'Identificação inválida.'},{status:400});
 const texto=typeof body?.texto==='string'?body.texto.trim():'';
 const nome=typeof body?.nome==='string'?body.nome.trim().slice(0,80):'';
 if(texto.length<1||texto.length>2000)
  return NextResponse.json({erro:'Mensagem de 1 a 2000 caracteres.'},{status:400});
 const admin=supabaseAdmin();
 let {data:conversa,error:erroConversa}=await admin.from('crm_conversas_externas')
  .select('id,segredo_hash,status').eq('conta_id',fonte.conta_id)
  .eq('fonte_id',fonte.id).eq('visitante_id',body.visitante).maybeSingle();
 if(erroConversa)return NextResponse.json({erro:'Falha ao consultar a sessão.'},{status:503});
 const segredoHash=hashSegredo(fonte.id,body.segredo);
 if(conversa&&!conferirSegredo(conversa.segredo_hash,segredoHash))
  return NextResponse.json({erro:'Sessão não autorizada.'},{status:403});
 if(!conversa){
  // Limite por fonte evita ativação acidental de formulário público sem controle.
  const dia=new Date(Date.now()-86400000).toISOString();
  const {count}=await admin.from('crm_conversas_externas')
    .select('id',{head:true,count:'exact'}).eq('fonte_id',fonte.id)
    .gte('criado_em',dia);
  if((count??0)>=300)return NextResponse.json({erro:'Webchat temporariamente indisponível.'},{status:429});
  const r=await admin.from('crm_conversas_externas').insert({
   conta_id:fonte.conta_id,fonte_id:fonte.id,visitante_id:body.visitante,
   segredo_hash:segredoHash,nome:nome||null,
  }).select('id,segredo_hash,status').single();
  if(r.error){
   if(r.error.code==='23505'){
    const outra=await admin.from('crm_conversas_externas')
     .select('id,segredo_hash,status').eq('fonte_id',fonte.id)
     .eq('visitante_id',body.visitante).maybeSingle();
    conversa=outra.data;
    if(!conversa||!conferirSegredo(conversa.segredo_hash,segredoHash))
     return NextResponse.json({erro:'Sessão já existe com outra credencial.'},{status:409});
   } else return NextResponse.json({erro:'Falha ao iniciar conversa.'},{status:503});
  }else conversa=r.data;
 }
 if(!conversa)return NextResponse.json({erro:'Sessão indisponível.'},{status:503});
 const recente=new Date(Date.now()-60000).toISOString();
 const {count,error:erroContagem}=await admin.from('crm_mensagens_externas')
   .select('id',{head:true,count:'exact'}).eq('conversa_id',conversa.id)
   .eq('direcao','entrada').gte('criado_em',recente);
 if(erroContagem)return NextResponse.json({erro:'Não foi possível verificar o limite.'},{status:503});
 if((count??0)>=5)return NextResponse.json({erro:'Aguarde antes de enviar outra mensagem.'},{status:429});
 const {data:mensagem,error}=await admin.from('crm_mensagens_externas')
  .insert({conta_id:fonte.conta_id,conversa_id:conversa.id,direcao:'entrada',texto})
  .select('id,direcao,texto,criado_em').single();
 if(error)return NextResponse.json({erro:'Não foi possível registrar a mensagem.'},{status:503});
 await admin.from('crm_conversas_externas').update({atualizado_em:new Date().toISOString()})
  .eq('id',conversa.id).eq('conta_id',fonte.conta_id);
 return NextResponse.json({mensagem,recebida:true},{status:201,headers:{'Cache-Control':'no-store'}});
}
