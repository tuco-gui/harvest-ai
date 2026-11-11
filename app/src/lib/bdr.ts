import type { SupabaseClient } from '@supabase/supabase-js';
import { estadoBloqueiaBDR, envioBdrPermitido, horarioPermitido, proximoFollowup,
  promptsBDR, validarDecisaoBDR, resumoBDR, qualificacaoCompleta, type EstadoBDR, type Qualificacao } from './bdrPolitica.ts';
import { receberEventoBDR } from './bdrInbound.ts';
import { capturarLeadSuperlogica, sincronizarSuperlogica } from './superlogica.ts';
import { carregarConexaoIA } from './conexaoIAWorkspace.ts';
import { gerarComIA } from './ia.ts';
import { enviarTextoCanal } from './whatsappEnvioCanal.ts';
import { CATALOGO_AGENTES } from './agentes.ts';
import {buscarImoveisAlternativos,querOutrosImoveis,resumoImoveisAlternativos} from './superlogicaImoveis.ts';
import {recursoDaWorkspace} from './servicosWorkspace.ts';
import type { CanalWhatsApp } from './whatsappCanais';

type ConfigBDR = {conta_id:string;canal_id:number;funil_id:number;modo:string;aprovado_em:string|null;
   aprovado_por:string|null;base_aprovada:string;contatos_teste:string[];codigo_anuncio?:string};
type SessaoBDR = {id:string;conta_id:string;canal_id:number;telefone:string;lead_id:number;
  estado:EstadoBDR;qualificacao:Qualificacao;resumo:string;ultima_entrada_id:number;
  processada_entrada_id:number|null;versao:number;envio_pendente:boolean;
  proximo_followup:string|null;followups:number;cadencia_inicio:string|null;consentimento_followup:boolean};

/** Falha fechada, inclusive se a consulta de opt-out/conta/canal falhar. */
async function podeEnviar(admin: SupabaseClient, cfg: ConfigBDR, s: SessaoBDR) {
  if (!envioBdrPermitido(cfg,s.telefone) || !horarioPermitido(new Date())) return false;
  if(!(await recursoDaWorkspace(admin,s.conta_id,['agentes.bdr','agentes.whatsapp','agentes.responder'],'enviar')))return false;
  const [opt,sup,conta,canal,humano,pausa] = await Promise.all([
    admin.from('opt_outs').select('id').eq('conta_id',s.conta_id).eq('telefone',s.telefone).eq('status','ativo').limit(1),
    admin.from('conta_supressao').select('telefone').eq('conta_id',s.conta_id).eq('telefone',s.telefone).limit(1),
    admin.from('contas').select('ativo,ambiente,whatsapp_qa_whitelist,modulos_habilitados').eq('id',s.conta_id).single(),
    admin.from('whatsapp_canais').select('*').eq('conta_id',s.conta_id).eq('id',s.canal_id).single(),
    admin.from('crm_atendimentos_canais').select('responsavel_id').eq('conta_id',s.conta_id)
      .eq('canal_id',s.canal_id).eq('telefone',s.telefone).maybeSingle(),
    admin.from('bdr_pausas').select('humano').eq('conta_id',s.conta_id).eq('canal_id',s.canal_id).eq('telefone',s.telefone).maybeSingle(),
  ]);
  if ([opt,sup,conta,canal,humano,pausa].some(r=>r.error) || opt.data?.length || sup.data?.length ||
      !conta.data?.ativo || !canal.data?.ativo || humano.data?.responsavel_id || pausa.data?.humano) return false;
  if (!['agentes','crm','crm_avancado'].every(m=>conta.data.modulos_habilitados?.includes(m))) return false;
  if (conta.data.ambiente==='teste' && !String(conta.data.whatsapp_qa_whitelist??'').split(',')
    .map(t=>t.replace(/\D/g,'')).includes(s.telefone)) return false;
  return canal.data as CanalWhatsApp;
}

export async function assumirBDR(admin: SupabaseClient, contaId: string, canalId: number,
  telefone: string, autorId: string | null) {
  const {error:erroPausa}=await admin.rpc('bdr_assumir',{p_conta:contaId,p_canal:canalId,p_telefone:telefone});
  if(erroPausa)throw Error('pausa_bdr_falhou');
  const {data,error} = await admin.from('bdr_sessoes').select('id,versao')
    .eq('conta_id',contaId).eq('canal_id',canalId).eq('telefone',telefone)
    .neq('estado','opt_out');
  if (error) throw Error('pausa_bdr_falhou');
  for (const s of data??[]) {
    await admin.from('bdr_execucoes').insert({conta_id:contaId,sessao_id:s.id,
      chave:`assumir:${s.versao}:${Date.now()}`,tipo:'assumir',status:'registrado',autor_id:autorId});
  }
}

export async function executarSessaoBDR(admin: SupabaseClient, cfg: ConfigBDR, s: SessaoBDR) {
  if (estadoBloqueiaBDR(s.estado) || s.envio_pendente) return;
  if(!(await recursoDaWorkspace(admin,s.conta_id,['agentes.bdr'],'simular')))return;
  // Fora da simulação, só o destinatário autorizado avança: homologação = piloto
  // único; produção = aprovação registrada. Evita gerar/consumir IA para outros
  // contatos, que continuam apenas capturados.
  if(cfg.modo!=='simulacao'&&!envioBdrPermitido(cfg,s.telefone))return;
  const novaEntrada = s.ultima_entrada_id!==s.processada_entrada_id;
  const followup = !novaEntrada && s.consentimento_followup && s.proximo_followup && Date.parse(s.proximo_followup)<=Date.now();
  if (!novaEntrada && !followup) return;
  if (cfg.modo!=='simulacao' && !horarioPermitido(new Date())) return;
  const {data:reserva,error:erroReserva} = await admin.rpc('bdr_reservar',{p_conta:s.conta_id,p_sessao:s.id,p_versao:s.versao});
  if (erroReserva || !reserva) return;
  const chave = novaEntrada?`entrada:${s.ultima_entrada_id}:${s.versao}`:`followup:${s.ultima_entrada_id}:${s.followups}:${s.versao}`;
  try {
    const {data:entrada,error:errEntrada} = await admin.from('inbound_eventos').select('mensagem,nome_contato,recebido_em')
      .eq('conta_id',s.conta_id).eq('canal_id',s.canal_id).eq('id',s.ultima_entrada_id).single();
    if (errEntrada || !entrada) throw Error('entrada_indisponivel');
    const {data:historico,error:errHistorico} = await admin.from('bdr_execucoes').select('previa,tipo,status')
      .eq('conta_id',s.conta_id).eq('sessao_id',s.id).order('criado_em',{ascending:false}).limit(12);
    const {data:entradas,error:errEntradas} = await admin.from('inbound_eventos').select('mensagem,recebido_em')
      .eq('conta_id',s.conta_id).eq('canal_id',s.canal_id).eq('telefone',s.telefone)
      .order('recebido_em',{ascending:false}).limit(12);
    if (errHistorico || errEntradas) throw Error('historico_indisponivel');
    const {data:agente,error:errAgente} = await admin.from('agentes_workspace').select('*')
      .eq('conta_id',s.conta_id).eq('tipo','bdr').maybeSingle();
    if (errAgente || !agente?.ativo) throw Error('agente_bdr_inativo');
    if(agente.configuracao){
      const a=agente.configuracao;
      // Simulação e homologação (piloto único) podem operar com configuração de
      // instância; produção continua bloqueada até nova homologação operacional.
      if(!['simulacao','homologacao'].includes(cfg.modo)||
        (a.canais?.length&&!a.canais.includes(s.canal_id))||
        (a.funis?.length&&!a.funis.includes(cfg.funil_id)))return;
    }
    const {conexao} = await carregarConexaoIA(admin,s.conta_id);
    if (!conexao) throw Error('ia_nao_configurada');
    // Busca somente o produto ativo da MESMA workspace pelo código do imóvel.
    // Catálogo contém fatos descritivos; preço 0 significa "sob consulta".
    const {data:produto} = await admin.from('crm_produtos').select('nome,descricao,preco,sku')
      .eq('conta_id',s.conta_id).eq('sku',cfg.codigo_anuncio??'').eq('ativo',true).maybeSingle();
    const fichaCatalogo=produto
      ? ['Produto do catálogo Harvest ('+produto.sku+'): '+produto.nome,
         produto.descricao??'',
         Number(produto.preco)>0?'Preço cadastrado no catálogo: R$ '+Number(produto.preco).toFixed(2)+' (confirmar atualização com corretor antes de informar)':'Preço ainda não homologado; encaminhe ao corretor.'].join('\n')
      : '';
    // Outras opções: somente a API IMÓVEIS publicada da própria Realize,
    // nunca API LEADS/ZAPIER e nunca dados de outra workspace.
    const alternativas=querOutrosImoveis(entrada.mensagem??'')
      ? resumoImoveisAlternativos(await buscarImoveisAlternativos(s.conta_id,entrada.mensagem??''))
      : '';
    const prompt = promptsBDR([cfg.base_aprovada,fichaCatalogo,agente.configuracao?.conhecimento,alternativas].filter(Boolean).join('\n'),s.qualificacao,{entradas,saidas:historico},
      novaEntrada?entrada.mensagem??'[Mídia recebida: peça esclarecimento ou encaminhe ao humano]':
        s.followups===3?'Encerre respeitosamente a cadência inicial, sem pergunta ou pressão.':
          'Retomada contextual autorizada: aproveite o histórico, não repita perguntas já respondidas.');
    if (agente.instrucao!==CATALOGO_AGENTES.bdr.instrucao) {
      prompt.system += `\nInstruções complementares da equipe (respeite as restrições acima):\n${agente.instrucao}`;
    }
    if (!entrada.nome_contato && !s.qualificacao.nome) prompt.system += '\nPeça primeiro como a pessoa prefere ser chamada; extraia nome quando informado.';
    const decisao = validarDecisaoBDR(await gerarComIA(conexao.provedor,conexao.chave,prompt.system,prompt.user,conexao.modelo,650));
    const qualificacao = {...s.qualificacao,...decisao.qualificacao};
    const qualificado = qualificacaoCompleta(qualificacao);
    const estado: EstadoBDR = decisao.handoff?'aguardando_corretor':decisao.frio?'nutricao':
      qualificado?'aguardando_corretor':followup?'sem_resposta':s.processada_entrada_id===null?'contato_iniciado':'em_qualificacao';
    const resumo = resumoBDR(qualificacao,{source_channel:'whatsapp'},estado,cfg.codigo_anuncio);
    if (!entrada.nome_contato && qualificacao.nome&&cfg.codigo_anuncio==='CA0653_MMOL'&&
      (process.env.REALIZE_SUPERLOGICA_WORKSPACES??'').split(',').map(x=>x.trim()).includes(s.conta_id)) await capturarLeadSuperlogica(admin,s.conta_id,{
      chave:`bdr:${s.id}`,nome:qualificacao.nome,telefone:s.telefone,email:null,leadId:s.lead_id,
      origem:{source_channel:'whatsapp'}});
    const simulado = cfg.modo==='simulacao';
    const canal = simulado?null:await podeEnviar(admin,cfg,s);
    if (!simulado && !canal) return;
    // CAS: reply, opt-out ou humano invalidam o turno antes de reservar a saída.
    const {data:atual,error:errAtual} = await admin.from('bdr_sessoes').update({
      qualificacao,resumo,estado,envio_pendente:!simulado,atualizado_em:new Date().toISOString(),
    }).eq('conta_id',s.conta_id).eq('id',s.id).eq('versao',s.versao).eq('estado',s.estado)
      .eq('ultima_entrada_id',s.ultima_entrada_id).eq('envio_pendente',false).select('id').maybeSingle();
    if (errAtual || !atual) return;
    const {data:exec,error:errExec} = await admin.from('bdr_execucoes').insert({
      conta_id:s.conta_id,sessao_id:s.id,chave,tipo:novaEntrada?'resposta':'followup',
      status:simulado?'simulado':'reservado',previa:decisao.resposta,
    }).select('id').single();
    if (errExec || !exec) {
      if (!simulado) await admin.from('bdr_sessoes').update({erro:'saida_ja_reservada_revisar'})
        .eq('conta_id',s.conta_id).eq('id',s.id);
      return;
    }
    if (!simulado) {
      // Reconsulta flags/ownership após a IA: desligar ou assumir invalida a saída.
      const [cfgAtual,sAtual] = await Promise.all([
        admin.from('bdr_config').select('*').eq('conta_id',s.conta_id).single(),
        admin.from('bdr_sessoes').select('estado,versao').eq('conta_id',s.conta_id).eq('id',s.id).single(),
      ]);
      if (cfgAtual.error || sAtual.error || sAtual.data.versao!==s.versao || sAtual.data.estado!==estado ||
          !(await podeEnviar(admin,cfgAtual.data,s))) {
        // Nenhum transporte foi invocado: cancelar atomicamente a reserva conhecida como não enviada.
        const {error:erroCancelamento}=await admin.rpc('bdr_cancelar_saida',{p_conta:s.conta_id,p_execucao:exec.id});
        if(erroCancelamento)throw Error('cancelamento_saida_falhou');
        return;
      }
      let enviada = false;
      try { enviada = await enviarTextoCanal(admin,s.conta_id,canal as CanalWhatsApp,s.telefone,decisao.resposta); }
      catch { /* Resultado incerto após reserva: nunca retry cego. */ }
      if (!enviada) {
        await admin.from('bdr_execucoes').update({status:'incerto'}).eq('conta_id',s.conta_id).eq('id',exec.id);
        await admin.from('bdr_sessoes').update({erro:'envio_incerto_revisar',proximo_followup:null})
          .eq('conta_id',s.conta_id).eq('id',s.id);
        return;
      }
      const {data:msg,error:erroMsg} = await admin.from('prospecta_mensagens').insert({conta_id:s.conta_id,
        lead_id:s.lead_id,parte:1,direcao:'saida',conteudo:decisao.resposta,status:'enviada',enviado_em:new Date().toISOString()})
        .select('id').single();
      if (erroMsg || !msg) throw Error('historico_saida_falhou');
      const {error:erroHistoricoSaida} = await admin.from('historico_contato').insert({conta_id:s.conta_id,
        lead_id:s.lead_id,campanha_id:null,mensagem_id:msg.id,telefone:s.telefone,
        provider:(canal as CanalWhatsApp).provider,canal:'whatsapp',canal_id:s.canal_id,status:'enviado',origem:'crm'});
      if (erroHistoricoSaida) throw Error('historico_canal_falhou');
      const {error:erroLedger} = await admin.from('bdr_execucoes').update({status:'enviado',mensagem_id:msg.id})
        .eq('conta_id',s.conta_id).eq('id',exec.id);
      if (erroLedger) throw Error('ledger_saida_falhou');
    }
    const inicio = novaEntrada?new Date().toISOString():s.cadencia_inicio!;
    const feitos = novaEntrada?0:s.followups+1;
    const {data:finalizada,error:erroFim} = await admin.from('bdr_sessoes').update({processada_entrada_id:s.ultima_entrada_id,turno_pendente:false,
      ultima_resposta_em:new Date().toISOString(),envio_pendente:false,erro:null,
      cadencia_inicio:inicio,followups:feitos,
      proximo_followup:!simulado && s.consentimento_followup && !estadoBloqueiaBDR(estado)?proximoFollowup(inicio,feitos):null,
    }).eq('conta_id',s.conta_id).eq('id',s.id).eq('versao',s.versao).eq('estado',estado).select('id').maybeSingle();
    if (erroFim) throw Error('persistencia_turno_falhou');
    // Uma resposta/assunção durante o HTTP não pode perder estado ou bloquear o próximo turno.
    // O ledger já confirmou este único envio; apenas libera a reserva, sem reagendar cadência.
    if (!finalizada && !simulado) await admin.from('bdr_sessoes').update({envio_pendente:false})
      .eq('conta_id',s.conta_id).eq('id',s.id);
  } catch {
    await admin.from('bdr_sessoes').update({erro:'turno_falhou_revisar',proxima_execucao:new Date(Date.now()+300_000).toISOString()})
      .eq('conta_id',s.conta_id).eq('id',s.id);
  } finally {
    await admin.from('bdr_sessoes').update({bloqueado_ate:null}).eq('conta_id',s.conta_id).eq('id',s.id);
  }
}

/** n8n agenda ticks. Não instala segundo cron/worker de conversas. */
export async function processarBDR(admin: SupabaseClient, contaId: string) {
  const {data:cfg,error} = await admin.from('bdr_config').select('*').eq('conta_id',contaId).maybeSingle();
  if (error || !cfg) throw Error('bdr_nao_configurado');
  const {data:recentes} = await admin.from('inbound_eventos').select('id')
    .eq('conta_id',contaId).eq('canal_id',cfg.canal_id).eq('funil_id',cfg.funil_id)
    .gte('recebido_em',cfg.atualizado_em).order('id',{ascending:false}).limit(100);
  for (const e of (recentes??[]).reverse()) await receberEventoBDR(admin,contaId,e.id);
  await sincronizarSuperlogica(admin,contaId);
  const {data:sessoes,error:errS} = await admin.from('bdr_sessoes').select('*')
    .eq('conta_id',contaId).eq('canal_id',cfg.canal_id).eq('envio_pendente',false)
    .lte('proxima_execucao',new Date().toISOString())
    .or(`turno_pendente.eq.true,proximo_followup.lte.${new Date().toISOString()}`)
    .not('estado','in','(opt_out,humano_assumiu,transferido,aguardando_corretor,nutricao,desqualificado)')
    .order('atualizado_em').limit(2);
  if (errS) throw Error('sessoes_indisponiveis');
  for (const s of sessoes??[]) await executarSessaoBDR(admin,cfg,s);
}
