import type { SupabaseClient } from '@supabase/supabase-js';
import type { Perfil } from './supabase/server';

/**
 * Módulos operacionais habilitados por conta (coluna contas.modulos_habilitados,
 * criada em 018). O papel (super_admin/admin/operador) decide o QUE o usuário
 * pode fazer no sistema; os módulos decidem o QUE A CONTA enxerga. São camadas
 * independentes: um admin de conta não alcança um módulo que a conta não tem,
 * mesmo tendo papel de admin.
 *
 * super_admin enxerga tudo (não há conta a restringir).
 */

export type Modulo = 'whatsapp' | 'ia' | 'usuarios' | 'chamados' | 'status' | 'enriquecimento';

/** Módulos que nunca ficam escondidos para um admin de conta (já são operacionais). */
const MODULOS_PADRAO: Modulo[] = ['whatsapp', 'ia', 'usuarios', 'chamados', 'status'];

/** Módulos que só o super admin (Figueira) enxerga — infra/integrações internas. */
const MODULOS_FIGUEIRA: Modulo[] = ['enriquecimento'];

export function modulosDaConta(
  modulosHabilitados: string[] | null | undefined,
  papel: Perfil['papel'],
): Set<Modulo> {
  if (papel === 'super_admin') {
    return new Set<Modulo>([...MODULOS_PADRAO, ...MODULOS_FIGUEIRA]);
  }
  const hab = (modulosHabilitados ?? MODULOS_PADRAO) as Modulo[];
  return new Set<Modulo>(hab.filter((m) => !MODULOS_FIGUEIRA.includes(m)));
}

/** Tem acesso a um módulo? server-side. */
export function temModulo(
  perfil: Perfil,
  modulosHabilitados: string[] | null | undefined,
  modulo: Modulo,
): boolean {
  return modulosDaConta(modulosHabilitados, perfil.papel).has(modulo);
}

/**
 * Carrega os módulos habilitados da conta do perfil. Usa service_role (admin)
 * porque a leitura é no contexto da sessão verificada, e a coluna está sob RLS
 * de conta — o admin do cliente também poderia ler, mas o service_role evita
 * redirecionamento de cookie/sessão aqui.
 */
export async function carregarModulos(
  admin: SupabaseClient,
  perfil: Perfil,
): Promise<string[] | null> {
  if (!perfil.conta_id) return null;
  const { data } = await admin
    .from('contas')
    .select('modulos_habilitados')
    .eq('id', perfil.conta_id)
    .maybeSingle();
  return (data?.modulos_habilitados as string[] | null) ?? null;
}
