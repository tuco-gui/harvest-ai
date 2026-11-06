import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { operadorPodeVerConversa, telefoneAtendimento, validarCanalAtendimento } from '@/lib/crmAtendimentos';
import { assumirBDR } from '@/lib/bdr';
import { estadoBloqueiaBDR, proximoFollowup } from '@/lib/bdrPolitica';

async function contexto(req: Request, raw: string) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return {resposta:NextResponse.json({erro:'Selecione uma workspace.'},{status:401})} as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin,perfil,'crm_avancado')) || !(await perfilTemModulo(admin,perfil,'crm')))
    return {resposta:NextResponse.json({erro:'Sem permissão.'},{status:403})} as const;
  const telefone = telefoneAtendimento(raw);
  const canalId = validarCanalAtendimento(new URL(req.url).searchParams.get('canal_id'));
  if (!telefone || !canalId) return {resposta:NextResponse.json({erro:'Canal/telefone inválido.'},{status:400})} as const;
  const {data:meta,error} = await admin.from('crm_atendimentos_canais').select('responsavel_id')
    .eq('conta_id',perfil.conta_id).eq('canal_id',canalId).eq('telefone',telefone).maybeSingle();
  if (error || !operadorPodeVerConversa(perfil,meta))
    return {resposta:NextResponse.json({erro:'Conversa não autorizada.'},{status:403})} as const;
  const {data:s,error:errS} = await admin.from('bdr_sessoes').select('*')
    .eq('conta_id',perfil.conta_id).eq('canal_id',canalId).eq('telefone',telefone).maybeSingle();
  if (errS) return {resposta:NextResponse.json({erro:'BDR indisponível.'},{status:503})} as const;
  return {perfil,admin,s,telefone,canalId,meta} as const;
}
export async function GET(req: Request, {params}: {params:Promise<{telefone:string}>}) {
  const c = await contexto(req,(await params).telefone); if ('resposta' in c) return c.resposta;
  if (!c.s) return NextResponse.json({sessao:null});
  const [exec,crm] = await Promise.all([
    c.admin.from('bdr_execucoes').select('id,tipo,status,previa,criado_em').eq('conta_id',c.perfil.conta_id)
      .eq('sessao_id',c.s.id).order('criado_em',{ascending:false}).limit(30),
    c.admin.from('superlogica_registros').select('id_superlogica,status_sincronizacao,tentativas,erro_tecnico,origem')
      .eq('conta_id',c.perfil.conta_id).eq('telefone',c.telefone).maybeSingle(),
  ]);
  if (exec.error || crm.error) return NextResponse.json({erro:'Histórico BDR indisponível.'},{status:503});
  return NextResponse.json({sessao:c.s,execucoes:exec.data,crm:crm.data,podeLiberar:c.perfil.papel!=='operador'});
}
export async function PATCH(req: Request,{params}:{params:Promise<{telefone:string}>}) {
  const c = await contexto(req,(await params).telefone); if ('resposta' in c) return c.resposta;
  if (!c.s) return NextResponse.json({erro:'Sessão BDR não encontrada.'},{status:404});
  const b = await req.json().catch(()=>null);
  if (b?.acao==='assumir') {
    try { await assumirBDR(c.admin,c.perfil.conta_id!,c.canalId,c.telefone,c.perfil.id); }
    catch { return NextResponse.json({erro:'Não foi possível pausar o BDR.'},{status:503}); }
    return NextResponse.json({ok:true});
  }
  if (c.perfil.papel==='operador') return NextResponse.json({erro:'Ação restrita ao administrador.'},{status:403});
  if (!['liberar','visita_confirmada','consentimento'].includes(b?.acao) || typeof b.evidencia!=='string' ||
      b.evidencia.trim().length<10 || b.evidencia.length>500)
    return NextResponse.json({erro:'Informe ação e evidência factual (10–500 caracteres).'},{status:400});
  if (b.acao==='liberar' && (c.s.estado==='opt_out' || c.s.envio_pendente || c.meta?.responsavel_id))
    return NextResponse.json({erro:'Remova a atribuição humana antes de liberar; opt-out/envio incerto exigem revisão própria.'},{status:409});
  const {error:erroLog} = await c.admin.from('bdr_execucoes').insert({conta_id:c.perfil.conta_id,
    sessao_id:c.s.id,chave:`${b.acao}:${crypto.randomUUID()}`,tipo:b.acao,status:'registrado',
    previa:b.evidencia.trim(),autor_id:c.perfil.id});
  if (erroLog) return NextResponse.json({erro:'Falha ao registrar evidência.'},{status:503});
  const patch = b.acao==='liberar'?{estado:'em_qualificacao',processada_entrada_id:null,versao:c.s.versao+1,turno_pendente:true,
    proxima_execucao:new Date().toISOString()}:
    b.acao==='consentimento'?{consentimento_followup:b.consentimento===true,versao:c.s.versao+1,
      proximo_followup:b.consentimento===true && c.s.cadencia_inicio && !estadoBloqueiaBDR(c.s.estado)
        ?proximoFollowup(c.s.cadencia_inicio,c.s.followups):null}:{};
  const {error} = await c.admin.from('bdr_sessoes').update({...patch,atualizado_em:new Date().toISOString()})
    .eq('conta_id',c.perfil.conta_id).eq('id',c.s.id).eq('versao',c.s.versao);
  return error?NextResponse.json({erro:'Falha ao atualizar BDR.'},{status:503}):NextResponse.json({ok:true});
}
