/**
 * Modelo de fluxo conversacional para agentes Harvest.
 * Primeira fase: configuração declarativa e validação, SEM disparo, webhook ou ativação automática.
 * A execução deverá usar a conta validada, o dispatcher de eventos e a Inbox existentes.
 */
export type EtapaAgente = 'abertura' | 'necessidade' | 'tipologia' | 'orcamento' | 'pagamento' | 'objecoes' | 'visita' | 'handoff';
export type AcaoAgente = 'perguntar' | 'informar' | 'escalar';
export type BlocoAgente = {
  id: string;
  etapa: EtapaAgente;
  acao: AcaoAgente;
  instrucao: string;
  proximo?: string;
};
export type FluxoAgente = {
  versao: 1;
  nome: string;
  objetivo: string;
  regras: string[];
  blocos: BlocoAgente[];
  maxRespostasAutomaticas: number;
  pausarQuandoHumanoAssumir: true;
  respeitarOptOut: true;
  confirmarVisitaSomentePorHumano: true;
};
const etapas: EtapaAgente[] = ['abertura','necessidade','tipologia','orcamento','pagamento','objecoes','visita','handoff'];
export const FLUXO_BDR_IMOBILIARIO_BASE: FluxoAgente = {
  versao: 1,
  nome: 'BDR imobiliário consultivo',
  objetivo: 'Qualificar o interesse e solicitar uma visita para confirmação humana.',
  regras: [
    'Apresente-se como assistente virtual.',
    'Faça apenas uma pergunta por resposta e não repita respostas já conhecidas.',
    'Nunca invente preço, disponibilidade, metragem, condição comercial ou data.',
    'Não confirme visitas: encaminhe o pedido para o responsável humano.',
    'Pare quando o cliente solicitar interrupção ou um atendente assumir.'
  ],
  blocos: [
    {id:'a',etapa:'abertura',acao:'perguntar',instrucao:'Cumprimente e pergunte o objetivo do contato.',proximo:'b'},
    {id:'b',etapa:'necessidade',acao:'perguntar',instrucao:'Entenda se o imóvel é para moradia ou investimento.',proximo:'c'},
    {id:'c',etapa:'tipologia',acao:'perguntar',instrucao:'Pergunte a tipologia desejada, se ainda desconhecida.',proximo:'d'},
    {id:'d',etapa:'orcamento',acao:'perguntar',instrucao:'Pergunte a faixa de investimento sem inventar valores.',proximo:'e'},
    {id:'e',etapa:'pagamento',acao:'perguntar',instrucao:'Entenda a preferência de pagamento sem prometer condições.',proximo:'f'},
    {id:'f',etapa:'objecoes',acao:'perguntar',instrucao:'Esclareça objeções com fatos verificáveis.',proximo:'g'},
    {id:'g',etapa:'visita',acao:'perguntar',instrucao:'Pergunte dia e horário preferidos; nunca confirme agendamento.',proximo:'h'},
    {id:'h',etapa:'handoff',acao:'escalar',instrucao:'Entregue resumo, contexto e preferência de visita ao corretor.'}
  ],
  maxRespostasAutomaticas: 20,
  pausarQuandoHumanoAssumir: true,
  respeitarOptOut: true,
  confirmarVisitaSomentePorHumano: true
};
export function validarFluxoAgente(input: FluxoAgente): string[] {
  const erros: string[] = [];
  if (input.versao !== 1) erros.push('Versão incompatível.');
  if (!input.nome?.trim() || !input.objetivo?.trim()) erros.push('Nome e objetivo são obrigatórios.');
  if (!Number.isInteger(input.maxRespostasAutomaticas) || input.maxRespostasAutomaticas < 1 || input.maxRespostasAutomaticas > 30) erros.push('Limite de respostas inválido.');
  if (input.pausarQuandoHumanoAssumir !== true || input.respeitarOptOut !== true || input.confirmarVisitaSomentePorHumano !== true) erros.push('Regras de segurança não podem ser desligadas.');
  if (!Array.isArray(input.blocos) || input.blocos.length < 2 || input.blocos.length > 30) return [...erros,'Quantidade de blocos inválida.'];
  const ids = new Set<string>();
  for (const b of input.blocos) {
    if (!b.id?.trim() || ids.has(b.id)) erros.push('Identificadores de blocos inválidos ou repetidos.');
    ids.add(b.id);
    if (!etapas.includes(b.etapa) || !['perguntar','informar','escalar'].includes(b.acao)) erros.push('Etapa ou ação inválida.');
    if (!b.instrucao?.trim() || b.instrucao.length > 1500) erros.push('Instrução de bloco inválida.');
  }
  for (const b of input.blocos) if (b.proximo && !ids.has(b.proximo)) erros.push('Bloco seguinte inexistente.');
  if (!input.blocos.some(b => b.etapa === 'handoff' && b.acao === 'escalar')) erros.push('Handoff humano obrigatório.');
  return erros;
}
