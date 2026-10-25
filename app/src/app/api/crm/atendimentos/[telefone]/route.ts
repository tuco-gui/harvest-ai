import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { operadorPodeVerConversa, telefoneAtendimento } from '@/lib/crmAtendimentos';

/** Timeline read-only. O servidor nunca confia na workspace enviada pelo cliente. */
export async function GET(req: Request, { params }: { params: Promise<{ telefone: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Selecione uma workspace.' }, { status: 400 });
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) {
    return NextResponse.json({ erro: 'Central de atendimento não habilitada.' }, { status: 403 });
  }
  const { telefone: raw } = await params;
  const telefone = telefoneAtendimento(raw);
  if (!telefone) return NextResponse.json({ erro: 'Telefone inválido.' }, { status: 400 });

  const { data: meta, error: erroMeta } = await admin.from('crm_atendimentos')
    .select('responsavel_id,status,etiquetas,atualizado_em')
    .eq('conta_id', perfil.conta_id).eq('telefone', telefone).maybeSingle();
  if (erroMeta) return NextResponse.json({ erro: 'Não foi possível verificar a conversa.' }, { status: 503 });
  if (!operadorPodeVerConversa(perfil, meta)) {
    return NextResponse.json({ erro: 'Você não está atribuído a esta conversa.' }, { status: 403 });
  }

  const param=new URL(req.url).searchParams.get('canal_id');
  const canalFiltro=param==null?null:Number(param);
  if(canalFiltro!==null && (!Number.isSafeInteger(canalFiltro)||canalFiltro<=0))
    return NextResponse.json({erro:'Canal inválido.'},{status:400});
  const {data:origens,error:erroOrigens}=await admin.from('inbound_eventos')
    .select('canal_id,funil_id').eq('conta_id',perfil.conta_id).eq('telefone',telefone)
    .order('recebido_em',{ascending:false}).limit(500);
  if(erroOrigens)return NextResponse.json({erro:'Falha ao identificar canal de entrada.'},{status:503});
  const canaisObservados=[...new Set((origens??[]).map(x=>x.canal_id).filter((x):x is number=>x!=null))];
  if(canalFiltro!==null && !canaisObservados.includes(canalFiltro))
    return NextResponse.json({erro:'Canal não corresponde a esta conversa.'},{status:404});
  const filtradas=canalFiltro===null?origens??[]:(origens??[]).filter(x=>x.canal_id===canalFiltro);
  const canalSugeridoId=canalFiltro??(canaisObservados.length===1?canaisObservados[0]:null);
  const funisDistintos=[...new Set(filtradas.map(x=>x.funil_id).filter((x):x is number=>x!=null))];
  const funilSugeridoId=canalSugeridoId!==null && funisDistintos.length===1
    ?funisDistintos[0]:null;
  const [entradas, oportunidade] = await Promise.all([
    admin.from('inbound_eventos')
      .select('id,mensagem,tipo_mensagem,tipo_evento,recebido_em,nome_contato,lead_id,canal_id')
      .eq('conta_id', perfil.conta_id).eq('telefone', telefone)
      .match(canalFiltro===null?{}:{canal_id:canalFiltro})
      .order('recebido_em', { ascending: false }).limit(150),
    admin.from('oportunidades')
      .select('id,estagio,owner_id,funil_id')
      .eq('conta_id', perfil.conta_id).eq('telefone', telefone)
      .match(funilSugeridoId===null?{}:{funil_id:funilSugeridoId})
      .order('criado_em', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (entradas.error || oportunidade.error) {
    return NextResponse.json({ erro: 'Não foi possível consultar as mensagens.' }, { status: 503 });
  }
  if (!entradas.data?.length) return NextResponse.json({ erro: 'Conversa não localizada.' }, { status: 404 });
  const { data:funilDaOportunidade } = oportunidade.data?.funil_id
    ? await admin.from('funis').select('canal_padrao_id')
      .eq('id',oportunidade.data.funil_id).eq('conta_id',perfil.conta_id).maybeSingle()
    : {data:null};
  const leadId = entradas.data.find(e => e.lead_id)?.lead_id ?? null;
  const {data:historicoDeCanal,error:erroHistorico}=canalFiltro!==null
    ?await admin.from('historico_contato').select('mensagem_id')
      .eq('conta_id',perfil.conta_id).eq('telefone',telefone).eq('canal_id',canalFiltro)
      .not('mensagem_id','is',null).order('criado_em',{ascending:false}).limit(250)
    :{data:[],error:null};
  if(erroHistorico)return NextResponse.json({erro:'Falha ao filtrar histórico do canal.'},{status:503});
  const idsSaidas=[...new Set((historicoDeCanal??[]).map(x=>x.mensagem_id).filter((x):x is number=>x!=null))];
  let consultaSaidas=admin.from('prospecta_mensagens')
    .select('id,conteudo,status,enviado_em,criado_em')
    .eq('conta_id',perfil.conta_id).eq('lead_id',leadId??-1);
  if(canalFiltro!==null && idsSaidas.length)consultaSaidas=consultaSaidas.in('id',idsSaidas);
  const saidas=leadId && (canalFiltro===null || idsSaidas.length>0)
    ?await consultaSaidas.order('criado_em',{ascending:false}).limit(150)
    :{data:[],error:null};
  if (saidas.error) return NextResponse.json({ erro: 'Falha ao carregar mensagens enviadas.' }, { status: 503 });
  const timeline = [
    ...entradas.data.map(m => ({
      id: `e-${m.id}`, direcao: 'entrada' as const, texto: m.mensagem || `[${m.tipo_mensagem || 'Mensagem sem texto'}]`,
      data: m.recebido_em, status: m.tipo_evento,
    })),
    ...(saidas.data ?? []).map(m => ({
      id: `s-${m.id}`, direcao: 'saida' as const, texto: m.conteudo || 'Mensagem sem texto',
      data: m.enviado_em || m.criado_em, status: m.status,
    })),
  ].sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  return NextResponse.json({
    telefone, timeline, nome: entradas.data.find(e => e.nome_contato)?.nome_contato ?? null,
    canaisObservados,canalSugeridoId,funilSugeridoId,canalAmbiguo:canaisObservados.length>1,
    atendimento: meta ?? { status: 'aberto', etiquetas: [], responsavel_id: null, atualizado_em: null },
    // Negocios podem ter ownership diferente da conversa. So exibe link
    // se o usuario for o responsavel ou tiver papel de administrador.
    oportunidade: oportunidade.data && (perfil.papel !== 'operador' ||
      oportunidade.data.owner_id === perfil.id)
      ? { id: oportunidade.data.id, estagio: oportunidade.data.estagio,
          funil_id: oportunidade.data.funil_id,
          canal_padrao_id:funilDaOportunidade?.canal_padrao_id??null } : null,
    limitePorFonte: 150,
  });
}
