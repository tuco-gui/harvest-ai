/**
 * Adapter de CRM (P0).
 *
 * O Harvest é a experiência unificada (ADR-007); o Twenty é a fonte de verdade
 * remota do CRM pós-qualificação. Esta camada isola a origem dos dados:
 *
 *  - SupabaseCrmBackend: backend atual do Harvest (espelho local das
 *    oportunidades). OPERACIONAL — usado enquanto a credencial Twenty não
 *    está disponível.
 *  - TwentyCrmBackend: stub da integração real com o Twenty. NÃO VERIFICADA —
 *    exige credencial/endpoint Twenty que não estão neste ambiente. Implementa
 *    a mesma interface para troca futura sem mexer nas rotas/UI.
 *
 * O VineCRM original tinha um lib/twenty.ts (GraphQL). Como o código-fonte do
 * VineCRM NÃO está no disco (só a auditoria), esta implementação reutiliza os
 * PADRÕES descritos (getOpportunities, createLead, pickOwner, STAGES) e usa o
 * stack do Harvest (Supabase multi-tenant).
 */
import { supabaseAdmin, perfilAtual } from './supabase/server';
import { ESTAGIO_PADRAO, estagioValido } from './crmStages';

export type Oportunidade = {
  id: number;
  conta_id: string;
  lead_id: number | null;
  empresa: string;
  contato: string;
  telefone: string | null;
  email: string | null;
  origem: string;
  estagio: string;
  owner_id: string | null;
  valor: number;
  proxima_acao: string | null;
  observacoes: string | null;
  previsao_fechamento: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type OportunidadeInput = {
  lead_id?: number | null;
  empresa?: string;
  contato?: string;
  telefone?: string | null;
  email?: string | null;
  origem?: string;
  estagio?: string;
  owner_id?: string | null;
  valor?: number;
  proxima_acao?: string | null;
  observacoes?: string | null;
  previsao_fechamento?: string | null;
};

export interface CrmBackend {
  listar(contaId: string): Promise<Oportunidade[]>;
  buscar(id: number): Promise<Oportunidade | null>;
  criar(contaId: string, input: OportunidadeInput): Promise<Oportunidade>;
  atualizar(id: number, patch: Partial<OportunidadeInput>): Promise<Oportunidade | null>;
  buscarOwners(contaId: string): Promise<{ id: string; nome: string }[]>;
  jaExistePorLead(leadId: number): Promise<boolean>;
}

class SupabaseCrmBackend implements CrmBackend {
  async listar(contaId: string): Promise<Oportunidade[]> {
    const { data } = await supabaseAdmin()
      .from('oportunidades')
      .select('*')
      .eq('conta_id', contaId)
      .order('atualizado_em', { ascending: false });
    return (data ?? []) as Oportunidade[];
  }

  async buscar(id: number): Promise<Oportunidade | null> {
    const { data } = await supabaseAdmin().from('oportunidades').select('*').eq('id', id).maybeSingle();
    return (data as Oportunidade) ?? null;
  }

  async criar(contaId: string, input: OportunidadeInput): Promise<Oportunidade> {
    const estagio = input.estagio && estagioValido(input.estagio) ? input.estagio : ESTAGIO_PADRAO;
    const { data, error } = await supabaseAdmin()
      .from('oportunidades')
      .insert({
        conta_id: contaId,
        lead_id: input.lead_id ?? null,
        empresa: input.empresa ?? '',
        contato: input.contato ?? '',
        telefone: input.telefone ?? null,
        email: input.email ?? null,
        origem: input.origem ?? 'prospeccao',
        estagio,
        owner_id: input.owner_id ?? null,
        valor: input.valor ?? 0,
        proxima_acao: input.proxima_acao ?? null,
        observacoes: input.observacoes ?? null,
        previsao_fechamento: input.previsao_fechamento ?? null,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Não consegui criar a oportunidade.');
    return data as Oportunidade;
  }

  async atualizar(id: number, patch: Partial<OportunidadeInput>): Promise<Oportunidade | null> {
    const limpo: Record<string, unknown> = { ...patch, atualizado_em: new Date().toISOString() };
    if (patch.estagio && !estagioValido(patch.estagio)) delete limpo.estagio;
    const { data, error } = await supabaseAdmin()
      .from('oportunidades')
      .update(limpo)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error?.message ?? 'Não consegui atualizar a oportunidade.');
    return (data as Oportunidade) ?? null;
  }

  async buscarOwners(contaId: string): Promise<{ id: string; nome: string }[]> {
    const { data } = await supabaseAdmin()
      .from('perfis')
      .select('id, nome, email')
      .eq('conta_id', contaId)
      .order('nome');
    return (data ?? []).map((p: any) => ({ id: p.id, nome: p.nome ?? p.email ?? p.id }));
  }

  async jaExistePorLead(leadId: number): Promise<boolean> {
    const { data } = await supabaseAdmin()
      .from('oportunidades')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();
    return !!data;
  }
}

/**
 * Stub da integração real com o Twenty. NÃO VERIFICADA: exige credencial/
 * endpoint Twenty ausentes neste ambiente. Mantém a mesma interface para
 * troca futura sem alterar rotas/UI.
 */
class TwentyCrmBackend implements CrmBackend {
  async listar(): Promise<Oportunidade[]> {
    throw new Error('Twenty backend não configurado (NÃO VERIFICADO).');
  }
  async buscar(): Promise<Oportunidade | null> {
    throw new Error('Twenty backend não configurado (NÃO VERIFICADO).');
  }
  async criar(): Promise<Oportunidade> {
    throw new Error('Twenty backend não configurado (NÃO VERIFICADO).');
  }
  async atualizar(): Promise<Oportunidade | null> {
    throw new Error('Twenty backend não configurado (NÃO VERIFICADO).');
  }
  async buscarOwners(): Promise<{ id: string; nome: string }[]> {
    throw new Error('Twenty backend não configurado (NÃO VERIFICADO).');
  }
  async jaExistePorLead(): Promise<boolean> {
    throw new Error('Twenty backend não configurado (NÃO VERIFICADO).');
  }
}

/** Backend ativo: Supabase (operacional). Trocar aqui quando o Twenty entrar. */
export function crmBackend(): CrmBackend {
  // ponytail: quando TWENTY_API_URL/TWENTY_API_KEY existirem, retornar
  // TwentyCrmBackend após implementar o transporte GraphQL. Por ora, Supabase.
  return new SupabaseCrmBackend();
}

/** Owner: seleção manual (P0). pickOwner fuzzy do VineCRM NÃO é usado. */
export async function ownerAtual(): Promise<string | null> {
  const perfil = await perfilAtual();
  return perfil?.id ?? null;
}
