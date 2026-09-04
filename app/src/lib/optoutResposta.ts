/**
 * Detecção de opt-out e de resposta (Fase 3C).
 *
 * Fase 3B já captura inbound em inbound_eventos; a 3C decide o QUE a mensagem
 * significa para o funil: (a) o lead pediu para parar de receber (opt-out) ou
 * (b) o lead respondeu (qualquer mensagem de texto que não seja opt-out).
 *
 * Princípios:
 *  - Não depende de "agente de resposta" (Chatwoot/Twenty, fase 3D). Detectar
 *    "respondeu" aqui é só marcar que houve entrada — o enriquecimento do
 *    conteúdo fica para a 3D.
 *  - Opt-out é uma PALAVRA-CHAVE curta e explícita (PT-BR). Evita falsos
 *    positivos: "não" sozinho NÃO é opt-out (o lead pode estar dizendo "não
 *    tenho interesse" = objeção, não pedido de parada). Só dispara opt-out quem
 *    pede explicitamente para parar/cancelar/remover/não perturbar.
 *  - Case-insensitive, sem acento, tolera pontuação.
 *  - Função PURA (sem I/O) → testável em unitário sem banco.
 */

const PALAVRAS_OPT_OUT = [
  'pare', 'parar', 'stop',
  'cancelar', 'cancela', 'cancele',
  'remover', 'remova', 'retirar', 'remove',
  'nao perturbe', 'nao quero mais', 'nao mande mais', 'nao mande',
  'sair', 'unsubscribe', 'descadastrar', 'descadastre',
  'nao mande mensagem', 'nao me mande', 'sem mensagem',
];

/** Normaliza para comparação: minúsculo, sem acento, colapsa espaços, remove pontuação solta. */
function normalizarTexto(t: string): string {
  return t
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[—–\-\/,;:!?.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ClassificacaoMensagem = 'optout' | 'resposta';

/**
 * Classifica uma mensagem inbound de texto.
 * Retorna 'optout' se a mensagem for uma solicitação clara e primária de
 * parada (curta, sem muitas palavras além da keyword); senão 'resposta'.
 *
 * Evita falsos positivos: "3 — Cancelar" em lista de opções NÃO é opt-out.
 * Só é opt-out se a mensagem for predominantemente uma keyword de parada
 * (até 5 palavras) ou se contiver frase explícita de opt-out.
 */
export function classificarMensagem(mensagem: string | null | undefined): ClassificacaoMensagem {
  if (!mensagem || !mensagem.trim()) return 'resposta';
  const texto = normalizarTexto(mensagem);

  // Fase 1: frases explícitas de opt-out (multi-palavra, alta certeza).
  const FRASES_EXPLICITAS = [
    'nao quero mais', 'nao mande mais', 'nao me mande',
    'nao perturbe', 'nao mande mensagem', 'sem mensagem',
    'quero sair', 'me descadastre', 'descadastrar',
    'pare de me mandar', 'para de mandar', 'stop',
  ];
  if (FRASES_EXPLICITAS.some((f) => texto.includes(f))) return 'optout';

  // Fase 2: keyword curta — só é opt-out se a mensagem tiver até 3 palavras
  // e NÃO começar com número (evita "3 Cancelar" de lista de opções).
  const palavras = texto.split(/\s+/).length;
  const comecaComNumero = /^\d/.test(texto);
  if (palavras <= 3 && !comecaComNumero && PALAVRAS_OPT_OUT.some((p) => texto.includes(normalizarTexto(p)))) {
    return 'optout';
  }

  return 'resposta';
}

export function ehOptOut(mensagem: string | null | undefined): boolean {
  return classificarMensagem(mensagem) === 'optout';
}
