import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import {perfilTemRecursos} from '@/lib/servicosWorkspace';

async function contexto() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return {resposta:NextResponse.json({erro:'Selecione uma workspace.'},{status:401})} as const;
  const admin = supabaseAdmin();
  if (perfil.papel==='operador' || !(await perfilTemRecursos(admin,perfil,['agentes.bdr']))||!(await perfilTemModulo(admin,perfil,'agentes')) ||
    !(await perfilTemModulo(admin,perfil,'crm_avancado')))
    return {resposta:NextResponse.json({erro:'Acesso restrito ao administrador dos agentes/CRM.'},{status:403})} as const;
  return {perfil,admin} as const;
}
export async function GET() {
  const c = await contexto(); if ('resposta' in c) return c.resposta;
  const [cfg,kpis] = await Promise.all([
    c.admin.from('bdr_config').select('*').eq('conta_id',c.perfil.conta_id).maybeSingle(),
    c.admin.rpc('bdr_kpis',{p_conta:c.perfil.conta_id}),
  ]);
  if (cfg.error || kpis.error) return NextResponse.json({erro:'BDR indisponível. Verifique a migration 054.'},{status:503});
  return NextResponse.json({config:cfg.data,kpis:kpis.data});
}
export async function POST(req: Request) {
  const c = await contexto(); if ('resposta' in c) return c.resposta;
  const b = await req.json().catch(()=>null);
  if (b?.acao==='processar') {
    const {processarBDR} = await import('@/lib/bdr');
    try { await processarBDR(c.admin,c.perfil.conta_id!); return NextResponse.json({ok:true}); }
    catch { return NextResponse.json({erro:'Não foi possível processar o BDR.'},{status:503}); }
  }
  return NextResponse.json({erro:'Edite a ficha por PATCH. Mudanças de modo exigem homologação operacional documentada; este endpoint não concede aprovação.'},{status:409});
}

/** Edita a ficha e vínculos sem alterar modo, autorização CRM ou aprovação operacional. */
export async function PATCH(req:Request){
  const c=await contexto();if('resposta'in c)return c.resposta;
  const b=await req.json().catch(()=>null);
  if(!Number.isSafeInteger(b?.canal_id)||!Number.isSafeInteger(b?.funil_id)||
    typeof b?.codigo_anuncio!=='string'||!/^[\w.-]{1,100}$/.test(b.codigo_anuncio)||
    typeof b?.base_aprovada!=='string'||b.base_aprovada.length>16000)
    return NextResponse.json({erro:'Informe canal, funil, código e ficha aprovada do imóvel.'},{status:400});
  const [canal,funil,ex]=await Promise.all([
    c.admin.from('whatsapp_canais').select('id').eq('id',b.canal_id).eq('conta_id',c.perfil.conta_id).eq('ativo',true).maybeSingle(),
    c.admin.from('funis').select('id').eq('id',b.funil_id).eq('conta_id',c.perfil.conta_id).eq('canal_padrao_id',b.canal_id).eq('ativo',true).maybeSingle(),
    c.admin.from('bdr_config').select('*').eq('conta_id',c.perfil.conta_id).maybeSingle(),
  ]);
  if([canal,funil,ex].some(x=>x.error)||!canal.data||!funil.data)return NextResponse.json({erro:'Canal/funil inválido nesta workspace.'},{status:403});
  if(ex.data?.modo&&ex.data.modo!=='simulacao')return NextResponse.json({erro:'Pause e homologue a operação antes de editar uma configuração com envio habilitado.'},{status:409});
  if(ex.data&&(ex.data.canal_id!==b.canal_id||ex.data.funil_id!==b.funil_id||ex.data.codigo_anuncio!==b.codigo_anuncio)){
    const [ss,rr]=await Promise.all(['bdr_sessoes','superlogica_registros'].map(t=>c.admin.from(t).select('id',{count:'exact',head:true}).eq('conta_id',c.perfil.conta_id)));
    if(ss.error||rr.error||ss.count||rr.count)return NextResponse.json({erro:'Há sessões/capturas vinculadas. A troca de imóvel/canal/funil exige migração específica; a ficha continua editável.'},{status:409});
  }
  const patch={canal_id:b.canal_id,funil_id:b.funil_id,codigo_anuncio:b.codigo_anuncio,base_aprovada:b.base_aprovada.trim(),atualizado_em:new Date().toISOString()};
  const q=ex.data?c.admin.from('bdr_config').update(patch).eq('conta_id',c.perfil.conta_id).eq('atualizado_em',ex.data.atualizado_em):
    c.admin.from('bdr_config').insert({...patch,conta_id:c.perfil.conta_id,modo:'simulacao'});
  const {data,error}=await q.select('*').maybeSingle();
  if(error||!data)return NextResponse.json({erro:'Não foi possível salvar. Recarregue a configuração e confira a migration 056.'},{status:409});
  return NextResponse.json({config:data,ok:true,ativado:false});
}
