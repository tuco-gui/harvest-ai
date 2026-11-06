import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';

async function contexto() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return {resposta:NextResponse.json({erro:'Selecione uma workspace.'},{status:401})} as const;
  const admin = supabaseAdmin();
  if (perfil.papel==='operador' || !(await perfilTemModulo(admin,perfil,'agentes')) ||
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
  if (!Number.isSafeInteger(b?.canal_id) || !Number.isSafeInteger(b?.funil_id) ||
    !['simulacao','homologacao'].includes(b?.modo) || typeof b.base_aprovada!=='string' || b.base_aprovada.length>16000 ||
    !Array.isArray(b.contatos_teste) || b.contatos_teste.length>10 ||
    b.contatos_teste.some((x:unknown)=>typeof x!=='string'||!/^55\d{10,11}$/.test(x)))
    return NextResponse.json({erro:'Informe canal, funil, modo de teste e até dez contatos controlados.'},{status:400});
  const [canal,funil,conta,existente] = await Promise.all([
    c.admin.from('whatsapp_canais').select('id').eq('conta_id',c.perfil.conta_id).eq('id',b.canal_id).eq('ativo',true).maybeSingle(),
    c.admin.from('funis').select('id').eq('conta_id',c.perfil.conta_id).eq('id',b.funil_id).eq('canal_padrao_id',b.canal_id).eq('ativo',true).maybeSingle(),
    c.admin.from('contas').select('slug').eq('id',c.perfil.conta_id).single(),
    c.admin.from('bdr_config').select('canal_id,funil_id,modo').eq('conta_id',c.perfil.conta_id).maybeSingle(),
  ]);
  if ([canal,funil,conta,existente].some(x=>x.error) || !canal.data || !funil.data)
    return NextResponse.json({erro:'Canal/funil inválido para a workspace.'},{status:403});
  if (b.modo==='homologacao' && (conta.data?.slug!=='figueira-marketing' || !b.contatos_teste.length))
    return NextResponse.json({erro:'Homologue na Figueira Marketing com contatos controlados.'},{status:409});
  if (existente.data && (existente.data.canal_id!==b.canal_id || existente.data.funil_id!==b.funil_id))
    return NextResponse.json({erro:'Há configuração existente. Migração de canal/funil exige revisão dos vínculos.'},{status:409});
  const {error} = await c.admin.from('bdr_config').upsert({conta_id:c.perfil.conta_id,
    canal_id:b.canal_id,funil_id:b.funil_id,modo:b.modo,base_aprovada:b.base_aprovada.trim(),
    contatos_teste:b.contatos_teste,aprovado_em:null,aprovado_por:null,evidencia_homologacao:null,
    atualizado_em:new Date().toISOString()},{onConflict:'conta_id'});
  return error?NextResponse.json({erro:'Não foi possível salvar o BDR.'},{status:503}):NextResponse.json({ok:true});
}
