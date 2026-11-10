import type { SupabaseClient } from '@supabase/supabase-js';
import {recursoDaWorkspace} from './servicosWorkspace.ts';
import { paradaObrigatoria } from './bdrPolitica.ts';
import { capturarLeadSuperlogica } from './superlogica.ts';

/** Apenas eventos persistidos do canal/funil explicitamente configurado. Sem envio. */
export async function receberEventoBDR(admin: SupabaseClient, contaId: string, eventoId: number) {
  if(!(await recursoDaWorkspace(admin,contaId,['agentes.bdr'])))return;
  const {data:e,error} = await admin.from('inbound_eventos').select('*')
    .eq('conta_id',contaId).eq('id',eventoId).maybeSingle();
  if (error || !e?.canal_id || !e.funil_id) return;
  const {data:cfg} = await admin.from('bdr_config').select('canal_id,funil_id,codigo_anuncio')
    .eq('conta_id',contaId).eq('canal_id',e.canal_id).eq('funil_id',e.funil_id).maybeSingle();
  if (!cfg) return;
  const estado = e.tipo_evento==='optout'?'opt_out':paradaObrigatoria(e.mensagem??'');
  const {data:sessao,error:erroSessao} = await admin.rpc('bdr_receber', {p_conta:contaId,p_evento:eventoId,p_estado:estado});
  if (erroSessao) throw Error('estado_bdr_indisponivel');
  // Mesmo opt-out/frio precisa existir no CRM; não condiciona a qualificação.
  if (sessao && e.nome_contato?.trim()&&cfg.codigo_anuncio==='CA0653_MMOL'&&
    (process.env.REALIZE_SUPERLOGICA_WORKSPACES??'').split(',').map(x=>x.trim()).includes(contaId)) {
    const {data:s} = await admin.from('bdr_sessoes').select('lead_id').eq('conta_id',contaId).eq('id',sessao).single();
    await capturarLeadSuperlogica(admin,contaId,{chave:`${e.provider}:${e.canal_id}:${e.message_id_externo}`,
      nome:e.nome_contato,telefone:e.telefone,email:null,leadId:s?.lead_id,
      origem:{source_channel:'whatsapp'}});
  }
}
