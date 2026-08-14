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

/** Normaliza para comparação: minúsculo, sem acento, colapsa espaços. */
function normalizarTexto(t: string): string {
  return t
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type ClassificacaoMensagem = 'optout' | 'resposta';

/**
 * Classifica uma mensagem inbound de texto.
 * Retorna 'optout' se bater uma palavra-chave de parada; senão 'resposta'.
 * Mensagem nula/vazia → 'resposta' (não é opt-out por omissão).
 */
export function classificarMensagem(mensagem: string | null | undefined): ClassificacaoMensagem {
  if (!mensagem || !mensagem.trim()) return 'resposta';
  const texto = normalizarTexto(mensagem);
  if (PALAVRAS_OPT_OUT.some((p) => texto.includes(normalizarTexto(p)))) return 'optout';
  return 'resposta';
}

export function ehOptOut(mensagem: string | null | undefined): boolean {
  return classificarMensagem(mensagem) === 'optout';
}
