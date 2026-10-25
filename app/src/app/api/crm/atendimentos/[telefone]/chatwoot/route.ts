import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { telefoneAtendimento } from '@/lib/crmAtendimentos';
import { atribuirAgente, buscarContato, buscarConversa, listarAgentes } from '@/lib/chatwoot';
import { atribuidoAoAgente, canalPertenceAoVinculo, contatoConfere, idContatoConversa,
  type ConversaChatwootVerificada } from '@/lib/crmChatwootHandoff';

/**
 * Encaminhamento EXPLÍCITO ao humano do Chatwoot.
 * Nunca cria conversa/contato nem envia WhatsApp. Todas as consultas e
 * atribuições permanecem limitadas ao account_id e inbox da workspace.
 */
async function contexto(raw: string) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return {
    resposta: NextResponse.json({erro:'Sessão expirada ou workspace ausente.'},{status:401}),
  } as const;
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado')) ||
      !isAdmin(perfil.papel)) {
    return { resposta: NextResponse.json({erro:'Operação restrita ao administrador do CRM avançado.'},{status:403}) } as const;
  }
  const telefone = telefoneAtendimento(raw);
  if (!telefone) return { resposta:NextResponse.json({erro:'Telefone inválido.'},{status:400}) } as const;
  const {data:evento, error:errEvento} = await admin.from('inbound_eventos')
    .select('id').eq('conta_id',perfil.conta_id).eq('telefone',telefone)
    .limit(1).maybeSingle();
  if (errEvento) return { resposta:NextResponse.json({erro:'Falha ao verificar a conversa Harvest.'},{status:503}) } as const;
  if (!evento) return { resposta:NextResponse.json({erro:'Conversa não existe nesta workspace.'},{status:404}) } as const;
  return {perfil,admin,telefone} as const;
}

async function configuracao(admin: ReturnType<typeof supabaseAdmin>,contaId:string){
  const {data:vinculo,error:errV} = await admin.from('crm_vinculos')
    .select('chatwoot_account_id,ativo').eq('conta_id',contaId).maybeSingle();
  if(errV)throw Error('Falha ao consultar vínculo do Chatwoot.');
  const accountId = Number(vinculo?.chatwoot_account_id);
  if(!vinculo?.ativo || !Number.isSafeInteger(accountId) || accountId<1) return null;
  const {data:inboxes,error:errI} = await admin.from('chatwoot_inboxes')
    .select('chatwoot_inbox_id').eq('conta_id',contaId)
    .eq('chatwoot_account_id',accountId).eq('ativo',true);
  if(errI)throw Error('Falha ao consultar canais Chatwoot.');
  const ids = (inboxes??[]).map(x=>x.chatwoot_inbox_id).filter(
    (x):x is number => Number.isSafeInteger(x) && x>0,
  );
  if(!ids.length)return null;
  return {accountId,inboxIds:ids};
}

export async function GET(_req:Request,{params}:{params:Promise<{telefone:string}>}){
  const c=await contexto((await params).telefone);
  if('resposta' in c)return c.resposta;
  let cfg: Awaited<ReturnType<typeof configuracao>>;
  try { cfg=await configuracao(c.admin,c.perfil.conta_id!); }
  catch(e){return NextResponse.json({configurado:false,
    motivo:e instanceof Error?e.message:'Configuração indisponível.'},{status:503});}
  if(!cfg)return NextResponse.json({configurado:false,
    motivo:'Vincule uma conta e uma Inbox Chatwoot em Configurações > Canais antes de encaminhar.',
    agentes:[],historico:[]});
  if(!process.env.CHATWOOT_API_URL || !process.env.CHATWOOT_API_TOKEN)
    return NextResponse.json({configurado:false,
      motivo:'Adapter Chatwoot ainda não possui conexão API disponível no servidor.',
      agentes:[],historico:[]});
  try {
    const [rawAgentes,historico] = await Promise.all([
      listarAgentes(cfg.accountId),
      c.admin.from('crm_chatwoot_encaminhamentos')
        .select('id,chatwoot_conversa_id,chatwoot_agente_id,confirmado,criado_em')
        .eq('conta_id',c.perfil.conta_id).eq('telefone',c.telefone)
        .order('criado_em',{ascending:false}).limit(20),
    ]);
    if(historico.error)throw Error('Histórico de encaminhamentos indisponível.');
    const agentes=Array.isArray(rawAgentes)?rawAgentes:[];
    return NextResponse.json({configurado:true,accountId:cfg.accountId,
      agentes:agentes.filter((x:{id?:number})=>Number.isSafeInteger(x.id)&&Number(x.id)>0)
        .map((x:{id:number;name:string;email?:string})=>({id:x.id,nome:x.name,email:x.email??null})),
      historico:historico.data??[],
      aviso:'Antes de encaminhar, informe o ID da conversa Chatwoot correspondente a este telefone.'});
  } catch(e){
    return NextResponse.json({configurado:false,
      motivo:e instanceof Error?e.message:'Falha na conexão com Chatwoot.',agentes:[],historico:[]},
      {status:503});
  }
}

export async function POST(req:Request,{params}:{params:Promise<{telefone:string}>}){
  const c=await contexto((await params).telefone);
  if('resposta' in c)return c.resposta;
  const b=await req.json().catch(()=>null);
  const conversaId=b?.conversaId,agenteId=b?.agenteId;
  if(b?.confirmar!==true || !Number.isSafeInteger(conversaId)||conversaId<1
     ||!Number.isSafeInteger(agenteId)||agenteId<1)
    return NextResponse.json({erro:'Confirme IDs válidos de conversa e agente Chatwoot.'},{status:400});
  const cfg=await configuracao(c.admin,c.perfil.conta_id!).catch(()=>null);
  if(!cfg||!process.env.CHATWOOT_API_URL||!process.env.CHATWOOT_API_TOKEN)
    return NextResponse.json({erro:'Conta, inbox ou API Chatwoot ainda não vinculadas à workspace.'},{status:409});

  try {
    const [conversa,agentes]=await Promise.all([
      buscarConversa(cfg.accountId,conversaId),
      listarAgentes(cfg.accountId),
    ]);
    if(!conversa || !canalPertenceAoVinculo(conversa as ConversaChatwootVerificada,cfg.inboxIds))
      return NextResponse.json({erro:'Conversa não pertence a um canal Chatwoot vinculado.'},{status:403});
    const ids=Array.isArray(agentes)?agentes:[];
    if(!ids.some(a=>a.id===agenteId))
      return NextResponse.json({erro:'Agente não pertence à equipe Chatwoot vinculada.'},{status:403});
    const contactId=idContatoConversa(conversa as ConversaChatwootVerificada);
    if(!contactId)
      return NextResponse.json({erro:'Chatwoot não retornou a identidade do contato da conversa.'},{status:409});
    const contato=await buscarContato(cfg.accountId,contactId);
    if(!contato || !contatoConfere(contato,c.telefone))
      return NextResponse.json({erro:'O telefone do contato no Chatwoot não coincide com a Inbox Harvest.'},{status:409});

    // Uma única ação externa, após todas as checagens. NÃO envia mensagens.
    await atribuirAgente(cfg.accountId,conversaId,agenteId);
    let confirmado=false;
    try {
      const depois=await buscarConversa(cfg.accountId,conversaId);
      confirmado=!!depois&&atribuidoAoAgente(depois as ConversaChatwootVerificada,agenteId);
    }catch{ /* status remoto não confirmado; reportar isso ao usuário */ }
    const {error:errLog}=await c.admin.from('crm_chatwoot_encaminhamentos').insert({
      conta_id:c.perfil.conta_id,telefone:c.telefone,
      chatwoot_account_id:cfg.accountId,chatwoot_conversa_id:conversaId,
      chatwoot_agente_id:agenteId,realizado_por:c.perfil.id,confirmado,
    });
    return NextResponse.json({
      encaminhamentoEnviado:true,confirmado,registrado:!errLog,
      aviso:!confirmado
        ? 'Chatwoot aceitou a atribuição, mas o novo responsável ainda não pôde ser confirmado na leitura.'
        : errLog
          ? 'Responsável confirmado no Chatwoot; falhou apenas o registro local da auditoria.'
          : 'Encaminhamento humano confirmado e registrado.',
      envioWhatsApp:false,
    });
  }catch(e){
    return NextResponse.json({erro:e instanceof Error?e.message:'Falha ao encaminhar no Chatwoot.'},
      {status:502});
  }
}
