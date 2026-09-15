/**
 * Classificação de mensagens inbound (P2) — separa em três categorias:
 *
 * 1. OPT-OUT: pedido explícito para não receber mais mensagens.
 *    "pare", "cancelar", "não quero mais", "sair", etc.
 *    Ação: suprimir telefone (mandatório) + movimentação via automação.
 *
 * 2. NEGATIVA COMERCIAL: resposta negativa que NÃO é opt-out.
 *    "não quero", "não tenho interesse", "agora não", etc.
 *    Ação: via automações configuráveis.
 *
 * 3. RESPOSTA: qualquer outra mensagem (incluindo positiva e neutra).
 *    Ação: via automações configuráveis.
 *
 * Princípios:
 *  - Opt-out é curto e explícito. "não" sozinho NÃO é opt-out.
 *  - Negativa comercial é semanticamente negativa mas não pede parada.
 *  - Case-insensitive, sem acento, tolera pontuação.
 *  - Função PURA (sem I/O) → testável em unitário sem banco.
 *
 * EVOLUÇÃO PENDENTE (não implementada ainda):
 *  - Classificação configurável pelo admin (frases/palavras customizáveis).
 *  - Classificação semântica via IA/bot (substituir regex por NLP).
 *  - O contrato de retorno (ClassificacaoMensagem) permanece o mesmo;
 *    apenas a implementação interna muda.
 *  - As frases e padrões abaixo são defaults racionais, não definitivos.
 *    O admin poderá sobrescrevê-los quando a configuração estiver disponível.
 */

// ---------- Normalização ----------

/** Normaliza para comparação: minúsculo, sem acento, colapsa espaços, remove pontuação solta. */
function normalizarTexto(t: string): string {
  return t
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[—–\-\/,;:!?.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- OPT-OUT ----------

const FRASES_OPT_OUT = [
  'nao quero mais', 'nao mande mais', 'nao me mande',
  'nao perturbe', 'nao mande mensagem', 'sem mensagem',
  'quero sair', 'me descadastre', 'descadastrar',
  'pare de me mandar', 'para de mandar',
  'nao quero receber', 'nao quero mensagens', 'nao quero mais mensagens',
  'nao quero nada', 'nao me envie', 'nao me contacte', 'nao me ligue',
  'nao quero ser contactado', 'nao quero mais contato',
];

const PALAVRAS_OPT_OUT = [
  'pare', 'parar', 'stop',
  'cancelar', 'cancela', 'cancele',
  'remover', 'remova', 'retirar', 'remove',
  'sair', 'unsubscribe', 'descadastre',
];

function ehOptOutExplicito(texto: string): boolean {
  // Fase 1: frases explícitas de opt-out (multi-palavra, alta certeza).
  if (FRASES_OPT_OUT.some((f) => texto.includes(f))) return true;

  // Fase 2: keyword curta — só é opt-out se a mensagem tiver até 3 palavras
  // e NÃO começar com número (evita "3 Cancelar" de lista de opções).
  const palavras = texto.split(/\s+/).length;
  const comecaComNumero = /^\d/.test(texto);
  if (palavras <= 3 && !comecaComNumero && PALAVRAS_OPT_OUT.some((p) => texto.includes(normalizarTexto(p)))) {
    return true;
  }

  return false;
}

// ---------- NEGATIVA COMERCIAL ----------

/**
 * Frases que indicam negativa comercial (interesse negativo, sem pedir parada).
 * Não confundir com opt-out — "não quero mais" é opt-out; "não tenho interesse" é negativa.
 */
const FRASES_NEGATIVA = [
  'nao tenho interesse', 'nao me interessa', 'nao gostaria',
  'nao faz sentido', 'nao compensa', 'nao vale a pena',
  'nao e pra mim', 'nao e o momento', 'nao estou afim',
  'agora nao', 'depois nao', 'nunca mais',
  'obrigado mas nao', 'obrigado nao', 'valeu mas nao',
  'ja tenho', 'ja uso', 'ja contratei',
  'nao preciso', 'nao quero', 'nao me interesso',
  'sem interesse', 'fora do escopo',
];

/**
 * Padrões regex para negativa comercial — captura variações que frases
 * fixas não pegam. Testado contra "não quero", "não tenho interesse",
 * "agora não", "depois não", "não me interesso", etc.
 */
const PADROES_NEGATIVA = [
  /nao\s+(quero|tenho|gostaria|preciso|faz\s+sentido|compensa|vale)/i,
  /nao\s+me\s+(interessa|interesso|interess)/i,
  /agora\s+nao/i,
  /depois\s+(nao|que)/i,
  /sem\s+interesse/i,
  /obrigado.*nao/i,
  /valeu.*nao/i,
  /ja\s+(tenho|uso|contratei|tenho)/i,
];

function ehNegativaComercial(texto: string): boolean {
  // Fase 1: frases fixas de negativa
  if (FRASES_NEGATIVA.some((f) => texto.includes(f))) return true;

  // Fase 2: padrões regex
  if (PADROES_NEGATIVA.some((p) => p.test(texto))) return true;

  return false;
}

// ---------- API pública ----------

export type ClassificacaoMensagem = 'optout' | 'negativa' | 'resposta';

/**
 * Classifica uma mensagem inbound de texto em três categorias:
 * - 'optout': pedido explícito para parar de receber mensagens
 * - 'negativa': resposta negativa comercial (sem pedir parada)
 * - 'resposta': resposta normal/positiva (default)
 *
 * Ordem de verificação: opt-out primeiro (prioridade máxima), depois negativa,
 * depois resposta. Uma mensagem que é opt-out NÃO é classificada como negativa,
 * mesmo que contenha palavras negativas.
 *
 * Futuramente, esta função pode ser substituída por classificação via IA/bot,
 * mantendo o mesmo contrato de retorno.
 */
export function classificarMensagem(mensagem: string | null | undefined): ClassificacaoMensagem {
  if (!mensagem || !mensagem.trim()) return 'resposta';
  const texto = normalizarTexto(mensagem);

  // Opt-out tem prioridade máxima
  if (ehOptOutExplicito(texto)) return 'optout';

  // Negativa comercial (sem pedir parada)
  if (ehNegativaComercial(texto)) return 'negativa';

  return 'resposta';
}

export function ehOptOut(mensagem: string | null | undefined): boolean {
  return classificarMensagem(mensagem) === 'optout';
}

export function ehNegativa(mensagem: string | null | undefined): boolean {
  return classificarMensagem(mensagem) === 'negativa';
}
