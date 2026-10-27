import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { normalizarTelefone } from '@/lib/telefone';
import { conversaDaOportunidade } from '@/lib/crmConversaOportunidade';
import { GET as lerConversa } from '@/app/api/crm/conversas-externas/[id]/route';
import {
    montarTimeline, type AtividadeTimeline, type EntradaTimeline, type SaidaTimeline, type EventoTimeline,
} from '@/lib/crmTimeline';

/**
 * Somente LEITURA. Junta três fontes já existentes para a ficha CRM.
 * Permissão verificada no servidor, antes de qualquer consulta de mensagens.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 });
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) {
    return NextResponse.json({ erro: 'CRM avançado indisponível nesta workspace.' }, { status: 403 });
  }
  const { id } = await params;
  const opId = Number(id);
  if (!Number.isSafeInteger(opId) || opId < 1) {
    return NextResponse.json({ erro: 'Oportunidade inválida.' }, { status: 400 });
  }

  let query = admin.from('oportunidades')
    .select('id,lead_id,telefone').eq('conta_id', perfil.conta_id).eq('id', opId);
  if (!isAdmin(perfil.papel)) query = query.eq('owner_id', perfil.id);
  const { data: op, error: errOp } = await query.maybeSingle();
  if (errOp) return NextResponse.json({ erro: 'Falha ao verificar acesso ao negócio.' }, { status: 503 });
  if (!op) return NextResponse.json({ erro: 'Oportunidade não encontrada ou sem acesso.' }, { status: 404 });

  const telefone = normalizarTelefone(op.telefone || '');
  const [atividades, entradas, saidas, autores] = await Promise.all([
    admin.from('crm_atividades')
      .select('id,tipo,titulo,descricao,concluida,vence_em,criado_em,autor_id')
      .eq('conta_id', perfil.conta_id).eq('oportunidade_id', opId)
      .order('criado_em', { ascending: false }).limit(150),
    telefone
      ? admin.from('inbound_eventos')
        .select('id,mensagem,tipo_mensagem,tipo_evento,recebido_em,nome_contato')
        .eq('conta_id', perfil.conta_id).eq('telefone', telefone)
        .order('recebido_em', { ascending: false }).limit(150)
      : Promise.resolve({ data: [], error: null }),
    op.lead_id
      ? admin.from('prospecta_mensagens')
        .select('id,conteudo,status,criado_em,enviado_em,erro')
        .eq('conta_id', perfil.conta_id).eq('lead_id', op.lead_id)
        .order('criado_em', { ascending: false }).limit(150)
      : Promise.resolve({ data: [], error: null }),
    admin.from('perfis').select('id,nome,email').eq('conta_id', perfil.conta_id).limit(250),
  ]);
  if (atividades.error || entradas.error || saidas.error || autores.error) {
    return NextResponse.json({ erro: 'Não foi possível consultar todo o histórico da oportunidade.' }, { status: 503 });
  }
  const mapaAutores = Object.fromEntries((autores.data ?? []).map(a => [a.id, a.nome || a.email || 'Equipe']));
  const eventos = montarTimeline(
    (atividades.data ?? []) as AtividadeTimeline[],
    (entradas.data ?? []) as EntradaTimeline[],
    (saidas.data ?? []) as SaidaTimeline[],
    mapaAutores,
  );
  let conversaId:string|null=null;
  try{
    conversaId=await conversaDaOportunidade(admin,perfil.conta_id,opId);
    if(conversaId){
      const resposta=await lerConversa(_req,{params:Promise.resolve({id:conversaId})});
      if(!resposta.ok)return resposta;
      const social=await resposta.json();
      const canal=social.fonte.tipo==='instagram_dm'?'Instagram':social.fonte.tipo==='facebook_messenger'?'Messenger':'Webchat';
      eventos.push(...social.mensagens.map((m:{id:string;direcao:'entrada'|'saida';texto:string;criado_em:string;status_envio:string}):EventoTimeline=>({
        id:'social-'+m.id,origem:m.direcao,titulo:canal+(m.direcao==='entrada'?' recebido':' enviado'),
        texto:m.texto,data:m.criado_em,status:m.direcao==='entrada'?'Recebida':m.status_envio,
        vencimento:null,autor:m.direcao==='entrada'?social.conversa.nome:null,
      })));
      eventos.sort((a,b)=>Date.parse(b.data)-Date.parse(a.data)||a.id.localeCompare(b.id));
      eventos.splice(250);
    }
  }catch{return NextResponse.json({erro:'Falha ao consultar o histórico do atendimento.'},{status:503});}
  return NextResponse.json({
    oportunidadeId: opId, eventos, atualizadoEm: new Date().toISOString(),
    totalExibido: eventos.length, limitePorFonte: 150,
    conversaId,
    aviso: conversaId?'Histórico associado ao atendimento deste negócio pelo vínculo de origem.':telefone
      ? 'Conversas associadas ao número de telefone deste negócio. Confira a identidade em casos de números compartilhados.'
      : 'Este negócio ainda não possui telefone; mostrando atividades e mensagens ligadas ao lead, se houver.',
  });
}
