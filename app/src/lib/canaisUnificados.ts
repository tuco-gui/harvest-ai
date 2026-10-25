/** Contrato da Inbox multicanal Harvest. Não abre webhooks nem expõe segredos.
 * Estado "planejado" significa que ainda NÃO existe integração funcional.
 * Provider ChatGPT/OpenAI entra como motor de IA, não como canal de atendimento.
 */
export const CANAIS_HARVEST = [
  { id:'whatsapp_waha', nome:'WhatsApp · WAHA', situacao:'operacional', entrada:true, saida:true },
  { id:'whatsapp_evolution', nome:'WhatsApp · Evolution API', situacao:'operacional', entrada:true, saida:true },
  { id:'whatsapp_cloud_api', nome:'WhatsApp · API oficial Meta', situacao:'planejado', entrada:false, saida:false },
  { id:'instagram_dm', nome:'Instagram · Direct', situacao:'planejado', entrada:false, saida:false },
  { id:'facebook_messenger', nome:'Facebook · Messenger', situacao:'planejado', entrada:false, saida:false },
  { id:'webchat', nome:'Webchat · site', situacao:'planejado', entrada:false, saida:false },
  { id:'google_business_reviews', nome:'Google Perfil da Empresa · avaliações', situacao:'planejado', entrada:false, saida:false },
  { id:'google_business_messages', nome:'Google Business Messages · chat descontinuado', situacao:'indisponivel', entrada:false, saida:false },
] as const;
export type CanalHarvestId = typeof CANAIS_HARVEST[number]['id'];
export type MensagemCanalNormalizada = {
  contaId:string;
  canalId:CanalHarvestId;
  conexaoId:string;
  conversaExternaId:string;
  mensagemExternaId:string;
  remetenteExternoId:string;
  tipo:'texto'|'imagem'|'audio'|'arquivo'|'evento';
  texto:string;
  recebidoEm:string;
};
export function chaveConversaCanal(v:Pick<MensagemCanalNormalizada,
 'contaId'|'canalId'|'conexaoId'|'conversaExternaId'>):string {
  if(!v.contaId || !v.canalId || !v.conexaoId || !v.conversaExternaId)
    throw Error('Identificadores de canal e workspace obrigatórios.');
  return [v.contaId,v.canalId,v.conexaoId,v.conversaExternaId]
    .map(x=>encodeURIComponent(x)).join(':');
}
export function validarEventoCanal(v:MensagemCanalNormalizada):boolean {
  if(!CANAIS_HARVEST.some(c=>c.id===v?.canalId && c.entrada))return false;
  if(!v.contaId || !v.conexaoId || !v.conversaExternaId || !v.mensagemExternaId ||
    !v.remetenteExternoId || !Number.isFinite(Date.parse(v.recebidoEm)))return false;
  if(!['texto','imagem','audio','arquivo','evento'].includes(v.tipo))return false;
  return typeof v.texto==='string' && v.texto.length<=10000;
}
