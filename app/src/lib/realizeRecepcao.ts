/** Realize: roteamento conservador da recepção geral. Sem chamadas externas. */
export type IntencaoRealize = 'comprar'|'alugar'|'vender_proprio'|'disponibilizar_locacao'|'outro'|'indefinida';
export type JornadaRealize = 'alea'|'recepcao';
const normalizar=(v:unknown)=>String(v??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
export function mencionaAlea(v:unknown):boolean {
  const t=normalizar(v);
  return /\b(alea|aleia)\b/.test(t) && !/\b(nao (quero|tenho interesse|estou interessado)|sem interesse|nao e (o |a )?)\b.{0,45}\b(alea|aleia)\b/.test(t);
}
export function intencaoRealize(v:unknown):IntencaoRealize {
  const t=normalizar(v);
  const proprio=/\b(meu|minha|sou proprietari[oa]|tenho um imovel|tenho uma casa|tenho um apartamento)\b/.test(t);
  if(/\b(colocar|por|disponibilizar|anunciar)\b.{0,60}\b(alugar|locacao|aluguel)\b/.test(t)||proprio&&/\b(alugar|locacao|aluguel)\b/.test(t))return 'disponibilizar_locacao';
  if(/\b(vender|anunciar para venda)\b/.test(t)&&proprio||/\bquero vender\b/.test(t))return 'vender_proprio';
  if(/\b(alugar|aluguel|locacao|locar)\b/.test(t))return 'alugar';
  if(/\b(comprar|compra|adquirir)\b/.test(t))return 'comprar';
  return 'indefinida';
}
export function jornadaRealize(texto:unknown, anterior:unknown, campanhaAlea:boolean):JornadaRealize {
  const t=normalizar(texto), intencao=intencaoRealize(t);
  if(['alugar','vender_proprio','disponibilizar_locacao'].includes(intencao)||
     /\b(outro|outra|outros|outras)\s+(imovel|imoveis|empreendimento|empreendimentos|casa|casas|apartamento|apartamentos)\b/.test(t)||
     /\b(nao (quero|tenho interesse|estou interessado)|sem interesse)\b.{0,45}\b(alea|aleia)\b/.test(t))return 'recepcao';
  if(mencionaAlea(t))return 'alea';
  if(anterior==='recepcao')return 'recepcao';
  return anterior==='alea'||campanhaAlea?'alea':'recepcao';
}
export function origemAleaVerificada(origem:unknown):boolean {
  if(!origem||typeof origem!=='object')return false;
  const o=origem as Record<string,unknown>;
  return ['lp','minichat'].includes(String(o.source_channel))&&
    /\b(alea|aleia)\b/.test(normalizar(o.utm_campaign).replace(/[_-]/g,' '));
}
export const INTENCOES_REALIZE=['comprar','alugar','vender_proprio','disponibilizar_locacao','outro'] as const;
export function intencaoValida(v:unknown):v is typeof INTENCOES_REALIZE[number] {
  return INTENCOES_REALIZE.includes(v as typeof INTENCOES_REALIZE[number]);
}
export function mensagemRecepcao(nome:unknown,intencao:unknown,imovel:unknown) {
  if(!String(nome??'').trim())return {resposta:'Olá! Sou o assistente virtual da Realize. Como posso chamar você?',handoff:false};
  if(!intencaoValida(intencao))return {resposta:'Você procura um imóvel para comprar ou alugar, ou deseja vender ou disponibilizar seu imóvel para locação?',handoff:false};
  if(intencao!=='outro'&&!String(imovel??'').trim())return {resposta:'Pode me contar brevemente qual imóvel ou tipo de imóvel você tem em mente?',handoff:false};
  return {resposta:'Obrigado pelas informações! Vou deixar seu atendimento encaminhado para a equipe da Realize. Um corretor dará continuidade ao seu atendimento.',handoff:true};
}
/** Mesmo critério de faixas do subworkflow MCMV 2026, sem solicitar renda exata. */
export const FAIXAS_MCMV=['ate_3200','3200_01_a_5000','5000_01_a_9600','9600_01_a_13000','acima_13000','prefere_nao_informar'] as const;
export function preTriagemRealize(q:Record<string,unknown>) {
  const renda=FAIXAS_MCMV.includes(q.renda_faixa as typeof FAIXAS_MCMV[number])?String(q.renda_faixa):null;
  const faixa=renda==='ate_3200'?'faixa_1':renda==='3200_01_a_5000'?'faixa_2':renda==='5000_01_a_9600'?'faixa_3':renda==='9600_01_a_13000'?'classe_media':renda==='acima_13000'?'fora_do_limite_mcmv_urbano':null;
  const financiamento=normalizar(q.financiamento), entrada=String(q.fgts_entrada??'').trim();
  const status=/^(a vista|recursos proprios|sem financiamento)$/.test(financiamento)?'nao_aplicavel':
    renda==='prefere_nao_informar'?'recusada':faixa&&financiamento&&entrada?'coletada':'dados_insuficientes';
  return {status,faixa_renda:faixa,criterio:'somente renda familiar bruta mensal declarada',fonte:'Portaria MCID 333/2026',aprovacao_credito:false,parcela_estimada:null,subsidio_estimado:null,entrada_estimada:null,referencia:'https://simuladorhabitacao.caixa.gov.br/'};
}
