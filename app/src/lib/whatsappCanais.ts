import type { SupabaseClient } from '@supabase/supabase-js';
import { wahaSessionName, getStatus, getNumeroConectado } from './waha.ts';

/**
 * Camada de canais WhatsApp (tabela whatsapp_canais, migration 018).
 *
 * A entidade operacional é o CANAL (número/conta de WhatsApp), não o provider.
 * O provider (WAHA/Evolution) é infraestrutura do canal. Uma conta pode ter N
 * canais. O disparo escolhe um canal por vez (fixo ou rodízio determinístico).
 */

export type ProviderCanal = 'waha' | 'evolution';

export type CanalWhatsApp = {
  id: number;
  conta_id: string;
  nome: string;
  provider: ProviderCanal;
  numero: string | null;
  identificador_externo: string | null;
  status: string;
  ativo: boolean;
  padrao: boolean;
  criado_em: string;
  atualizado_em: string;
};

/** Canais elegíveis para envio: ativos, da conta, e com provider conectado/viável. */
function canalElegivel(c: CanalWhatsApp): boolean {
  return c.ativo && (c.status === 'conectado' || c.status === 'desconhecido');
}

/**
 * Seleção determinística de rodízio. Não é random: dado (canais, semente) o
 * resultado é sempre o mesmo, e avança em ordem estável de id. A semente vem do
 * índice do lead no disparo (indice % canaisElegiveis.length), então o mesmo
 * lead sempre cai no mesmo canal numa rodada — mas leads diferentes se distribuem.
 *
 * Canais inativos, desconectados ou de fora da conta são ignorados (filtrados
 * antes de chegar aqui). Sem fallback silencioso: se não houver canal elegível,
 * retorna null e o disparo deve falhar explicitamente.
 */
export function escolherCanalRodizio(
  canais: CanalWhatsApp[],
  semente: number,
): CanalWhatsApp | null {
  const elegiveis = canais.filter(canalElegivel).sort((a, b) => a.id - b.id);
  if (!elegiveis.length) return null;
  const idx = ((semente % elegiveis.length) + elegiveis.length) % elegiveis.length;
  return elegiveis[idx];
}

/** Canal fixo por id, ou o padrão da conta se nenhum id foi dado. */
export function escolherCanalFixo(
  canais: CanalWhatsApp[],
  canalId: number | null,
): CanalWhatsApp | null {
  if (canalId != null) {
    const achado = canais.find((c) => c.id === canalId);
    if (achado && canalElegivel(achado)) return achado;
    return null; // canal inexistente/desativado desta conta → rejeitar
  }
  const padrao = canais.find((c) => c.padrao && canalElegivel(c));
  return padrao ?? null;
}

/** Carrega os canais da conta (service_role, já filtrado por conta_id). */
export async function carregarCanais(
  admin: SupabaseClient,
  contaId: string,
): Promise<CanalWhatsApp[]> {
  const { data } = await admin
    .from('whatsapp_canais')
    .select('*')
    .eq('conta_id', contaId)
    .order('padrao', { ascending: false })
    .order('id');
  const canais = (data as CanalWhatsApp[] | null) ?? [];
  // Reconcilia status/número dos canais WAHA com a sessão real (corrige o
  // backfill, que não tinha o número/status da sessão). Evolution só fica
  // conectado se a instância existir de verdade — validado no disparo.
  return Promise.all(canais.map((c) => reconciliarStatusWaha(admin, c)));
}

/**
 * Resolve o canal a usar no disparo. `modo` vem de prospecta_campanhas
 * (fixo|rodizio) ou do corpo da requisição. A posse do canal pela conta já foi
 * garantida por carregarCanais (filtra por conta_id); aqui só validamos
 * elegibilidade e seleção.
 */
export function resolverCanalDisparo(
  canais: CanalWhatsApp[],
  modo: 'fixo' | 'rodizio',
  canalId: number | null,
  semente: number,
): CanalWhatsApp | null {
  return modo === 'rodizio'
    ? escolherCanalRodizio(canais, semente)
    : escolherCanalFixo(canais, canalId);
}

/**
 * Reconcilia o status (e número) de um canal WAHA com a sessão real do provider.
 *
 * Fonte de verdade: a sessão WAHA da conta (identificador da sessão derivado do
 * conta_id). O canal é só o espelho persistido. Se a sessão estiver WORKING, o
 * canal fica conectado e ganha o número real; se parada/falhou, fica
 * desconectado. Nunca criamos QR novo aqui — isso é responsabilidade do fluxo
 * de conexão (Configurações). Retorna o canal atualizado ou null se a sessão
 * não existir (canal sem WAHA vivo não vira conectado por mágica).
 *
 * ponytail: custo de 1 GET por canal WAHA; chamado no carregarCanais, não em
 * loop de disparo. Se o WAHA estiver fora, falha fechada (não corrompe o canal).
 */
export async function reconciliarStatusWaha(
  admin: SupabaseClient,
  canal: CanalWhatsApp,
): Promise<CanalWhatsApp> {
  if (canal.provider !== 'waha' || !canal.ativo) return canal;

  const sessao = wahaSessionName(canal.conta_id);
  let statusWaha: string | null = null;
  let numero: string | null = null;
  try {
    const st = await getStatus(sessao);
    statusWaha = st?.status ?? null;
    if (statusWaha === 'WORKING') numero = await getNumeroConectado(sessao);
  } catch {
    // WAHA indisponível: mantém o canal como está, não assume desconectado.
    return canal;
  }

  const conectado = statusWaha === 'WORKING';
  const novoStatus = conectado ? 'conectado' : 'desconectado';
  // Só grava se mudou algo — evita write a toda requisição de configurações.
  if (canal.status !== novoStatus || canal.numero !== (numero ?? canal.numero)) {
    const { data, error } = await admin
      .from('whatsapp_canais')
      .update({ status: novoStatus, numero: numero ?? canal.numero, atualizado_em: new Date().toISOString() })
      .eq('id', canal.id)
      .eq('conta_id', canal.conta_id)
      .select('*')
      .single();
    if (!error && data) return data as CanalWhatsApp;
  }
  return canal;
}
