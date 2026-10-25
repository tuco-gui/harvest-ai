/**
 * HARVEST / DESKCOMM PILOTO
 * Consulta READ-ONLY de agentes em um tenant QA do Deskcomm.
 *
 * Fail closed: desabilitado por padrão, somente staging e conta QA explícita.
 * Não usa API de produção, não envia mensagens, não altera nenhuma informação
 * de cliente e nunca expõe segredos ou corpo da resposta do Deskcomm ao browser.
 */
export type EstadoDeskcommPiloto =
  | { estado: 'desativado' }
  | { estado: 'sem_configuracao' }
  | { estado: 'indisponivel'; httpStatus?: number }
  | { estado: 'resposta_invalida' }
  | { estado: 'operacional'; agentes: number };

export function pilotoDeskcommPermitido(contaId: string): boolean {
  const qa = process.env.HARVEST_DESKCOMM_QA_CONTA_ID;
  const ambiente = process.env.NEXT_PUBLIC_AMBIENTE;
  return process.env.HARVEST_DESKCOMM_PILOT_ENABLED === 'true'
    && ambiente === 'staging'
    && !!qa && qa === contaId;
}

export async function diagnosticarAgentesDeskcomm(contaId: string): Promise<EstadoDeskcommPiloto> {
  if (!pilotoDeskcommPermitido(contaId)) return { estado: 'desativado' };
  const base = process.env.HARVEST_DESKCOMM_API_URL;
  const token = process.env.HARVEST_DESKCOMM_API_TOKEN;
  if (!base || !token) return { estado: 'sem_configuracao' };

  let url: URL;
  try {
    url = new URL('/api/v1/ai/agents', base);
    const origem = new URL(base);
    if (url.origin !== origem.origin || origem.protocol !== 'https:' || origem.username || origem.password) {
      return { estado: 'sem_configuracao' };
    }
    // Nunca consultar as instâncias legadas ou endpoints de produção por engano.
    const interditados = new Set([
      'harvest.figueiramarketing.com.br',
      'crm.figueiramarketing.com.br',
      'chatwoot.figueiramarketing.com.br',
      'waha.figueiramarketing.com.br',
    ]);
    if (interditados.has(origem.hostname)) return { estado: 'sem_configuracao' };
  } catch {
    return { estado: 'sem_configuracao' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return { estado: 'indisponivel', httpStatus: response.status };
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
      return { estado: 'resposta_invalida' };
    }
    const agentes = (payload as { data: unknown }).data;
    if (!Array.isArray(agentes)) return { estado: 'resposta_invalida' };
    return { estado: 'operacional', agentes: agentes.length };
  } catch {
    return { estado: 'indisponivel' };
  } finally {
    clearTimeout(timeout);
  }
}
