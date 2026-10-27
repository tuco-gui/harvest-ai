import type { SupabaseClient } from '@supabase/supabase-js';

/** O vínculo explícito é a identidade; nunca inferir conversa por nome ou telefone. */
export async function conversaDaOportunidade(admin:SupabaseClient,contaId:string,id:number|string) {
  const {data,error}=await admin.from('crm_vinculos_conversa_negocio')
    .select('conversa_id').eq('conta_id',contaId).eq('oportunidade_id',id).maybeSingle();
  if(error)throw Error('Não foi possível consultar o atendimento deste negócio.');
  return data?.conversa_id as string|null ?? null;
}

export type MensagemExternaCRM={id:string;direcao:'entrada'|'saida';texto:string;criado_em:string;status_envio?:string};
export function mensagensDaConversa(mensagens:MensagemExternaCRM[]) {
  return mensagens.map(m=>({id:'social-'+m.id,direcao:m.direcao,texto:m.texto,
    data:m.criado_em,status:m.direcao==='entrada'?'recebida':m.status_envio??'enviado',
    erro:m.status_envio==='falhou'?'Envio não confirmado.':null}));
}
