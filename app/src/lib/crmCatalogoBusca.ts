/** Busca administrativa em todo o catálogo, antes da paginação no banco. */
export const PRODUTOS_POR_PAGINA = 50;
export type EstadoCatalogo = 'todos' | 'ativos' | 'inativos';

export function consultaCatalogo(params: URLSearchParams) {
  const raw = params.get('pagina') ?? '1';
  const pagina = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000)
    throw Error('Página inválida.');
  const busca = (params.get('busca') ?? '').trim();
  if (busca.length > 160 || /[\x00-\x1f\x7f]/.test(busca)) throw Error('Busca inválida (até 160 caracteres).');
  const estado = params.get('estado') ?? 'todos';
  if (!['todos', 'ativos', 'inativos'].includes(estado)) throw Error('Estado do catálogo inválido.');
  return { pagina, busca, estado: estado as EstadoCatalogo };
}

export function filtroCatalogo(busca: string): string | null {
  // Remover delimitadores do DSL; escapar LIKE. `*` é alias de `%` no PostgREST.
  const termo = busca.replace(/[,()"*]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/[\\%_]/g, c => '\\' + c);
  if (!termo) return null;
  return ['nome', 'sku'].map(c => c + '.ilike.%' + termo + '%').join(',');
}

export function intervaloCatalogo(pagina: number): [number, number] {
  const inicio = (pagina - 1) * PRODUTOS_POR_PAGINA;
  return [inicio, inicio + PRODUTOS_POR_PAGINA - 1];
}
