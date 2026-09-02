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
  campanha_id: number | null;
  estagio: string;
  owner_id: string | null;
  valor: number;
  proxima_acao: string | null;
  observacoes: string | null;
  previsao_fechamento: string | null;
  probabilidade: number;
  tags: string[];
  motivo_perda: string | null;
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
  campanha_id?: number | null;
  estagio?: string;
  owner_id?: string | null;
  valor?: number;
  proxima_acao?: string | null;
  observacoes?: string | null;
  previsao_fechamento?: string | null;
  probabilidade?: number;
  tags?: string[];
  motivo_perda?: string | null;
};

export interface CrmBackend {
  listar(contaId: string): Promise<Oportunidade[]>;
  buscar(contaId: string, id: number): Promise<Oportunidade | null>;
  criar(contaId: string, input: OportunidadeInput): Promise<Oportunidade>;
  atualizar(contaId: string, id: number, patch: Partial<OportunidadeInput>): Promise<Oportunidade | null>;
  buscarOwners(contaId: string): Promise<{ id: string; nome: string }[]>;
  jaExistePorLead(contaId: string, leadId: number): Promise<boolean>;
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

  async buscar(contaId: string, id: number): Promise<Oportunidade | null> {
    const { data } = await supabaseAdmin()
      .from('oportunidades')
      .select('*')
      .eq('conta_id', contaId)
      .eq('id', id)
      .maybeSingle();
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
        campanha_id: input.campanha_id ?? null,
        estagio,
        owner_id: input.owner_id ?? null,
        valor: input.valor ?? 0,
        proxima_acao: input.proxima_acao ?? null,
        observacoes: input.observacoes ?? null,
        previsao_fechamento: input.previsao_fechamento ?? null,
        probabilidade: input.probabilidade ?? 5,
        tags: input.tags ?? [],
        motivo_perda: input.motivo_perda ?? null,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Não consegui criar a oportunidade.');
    return data as Oportunidade;
  }

  async atualizar(contaId: string, id: number, patch: Partial<OportunidadeInput>): Promise<Oportunidade | null> {
    const limpo: Record<string, unknown> = { ...patch, atualizado_em: new Date().toISOString() };
    if (patch.estagio && !estagioValido(patch.estagio)) delete limpo.estagio;
    const { data, error } = await supabaseAdmin()
      .from('oportunidades')
      .update(limpo)
      .eq('conta_id', contaId)
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

  async jaExistePorLead(contaId: string, leadId: number): Promise<boolean> {
    const { data } = await supabaseAdmin()
      .from('oportunidades')
      .select('id')
      .eq('conta_id', contaId)
      .eq('lead_id', leadId)
      .maybeSingle();
    return !!data;
  }
}

/**
 * Campo bruto da Opportunity na Twenty REST API. Nomes exatos NÃO VERIFICADOS
 * contra o workspace real (plano HAI-002, Seção 6/13) — melhor esforço com
 * base no schema padrão do objeto Opportunity do Twenty. A Twenty gera a API
 * a partir do schema de cada workspace ("schema-per-tenant") — não existe
 * referência estática de campos; a doc real só existe em
 * Settings → API & Webhooks daquele workspace, com uma API key válida
 * (confirmado em docs.twenty.com/developers/extend/api, 02/09/2026).
 *
 * `harvestLeadId`: campo customizado ASSUMIDO (NÃO VERIFICADO) para guardar o
 * id do lead do Harvest na Opportunity — necessário para jaExistePorLead sem
 * usar telefone fuzzy como chave. Precisa existir no workspace antes de usar.
 */
type TwentyOpportunity = {
  id: string;
  name?: string | null;
  amount?: { amountMicros?: number | null } | null;
  stage?: string | null;
  closeDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  harvestLeadId?: number | null;
  pointOfContactId?: string | null;
  companyId?: string | null;
  pointOfContact?: { name?: { firstName?: string; lastName?: string }; phones?: { primaryPhoneNumber?: string }; emails?: { primaryEmail?: string } } | null;
};

type TwentyPerson = {
  id: string;
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  companyId?: string | null;
};

type TwentyCompany = {
  id: string;
  name?: string | null;
};

type TwentyWorkspaceMember = {
  id: string;
  name?: { firstName?: string; lastName?: string };
  userEmail?: string | null;
};

const TWENTY_TIMEOUT_MS = 10_000;

function twentyParaOportunidade(contaId: string, o: TwentyOpportunity): Oportunidade {
  const contato = o.pointOfContact?.name
    ? [o.pointOfContact.name.firstName, o.pointOfContact.name.lastName].filter(Boolean).join(' ')
    : '';
  return {
    id: Number(o.id) || 0,
    conta_id: contaId,
    lead_id: null,
    empresa: o.name ?? '',
    contato,
    telefone: o.pointOfContact?.phones?.primaryPhoneNumber ?? null,
    email: o.pointOfContact?.emails?.primaryEmail ?? null,
    origem: 'twenty',
    campanha_id: null,
    estagio: (o.stage && estagioValido(o.stage) ? o.stage : ESTAGIO_PADRAO),
    owner_id: null,
    valor: o.amount?.amountMicros ? o.amount.amountMicros / 1_000_000 : 0,
    proxima_acao: null,
    observacoes: null,
    previsao_fechamento: o.closeDate ?? null,
    probabilidade: 5,
    tags: [],
    motivo_perda: null,
    criado_em: o.createdAt ?? new Date().toISOString(),
    atualizado_em: o.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Integração real com o Twenty (REST API). listar/buscar implementados
 * (plano HAI-002, Seção 14); demais métodos ainda são stub. Requer
 * TWENTY_API_URL e TWENTY_API_KEY no ambiente — ausentes hoje, então
 * `crmBackend()` continua devolvendo `SupabaseCrmBackend` por padrão.
 * Endpoints/campos NÃO VERIFICADOS contra workspace real (Seção 13).
 */
class TwentyCrmBackend implements CrmBackend {
  private baseUrl(): string {
    const url = process.env.TWENTY_API_URL;
    if (!url) throw new Error('Twenty backend não configurado: falta TWENTY_API_URL (NÃO VERIFICADO).');
    return url.replace(/\/$/, '');
  }

  private headers(): HeadersInit {
    const key = process.env.TWENTY_API_KEY;
    if (!key) throw new Error('Twenty backend não configurado: falta TWENTY_API_KEY (NÃO VERIFICADO).');
    return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  }

  /**
   * fetch com timeout + tratamento uniforme de erro (401/403/429/5xx/JSON
   * inválido). Único ponto de I/O da classe — os métodos de negócio só leem
   * `.data`. NÃO VERIFICADO: mensagens/shape de erro do workspace real.
   */
  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TWENTY_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl()}${path}`, {
        ...init,
        headers: { ...this.headers(), ...(init.headers ?? {}) },
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error(`Twenty: timeout (${TWENTY_TIMEOUT_MS}ms) em ${path}.`);
      throw new Error(`Twenty: falha de rede em ${path}: ${err?.message ?? err}`);
    } finally {
      clearTimeout(timeout);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Twenty: não autorizado (${res.status}) — verifique TWENTY_API_KEY.`);
    }
    if (res.status === 429) throw new Error('Twenty: rate limit excedido (429).');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Twenty: erro HTTP ${res.status} em ${path}.`);
    if (res.status === 204) return {};
    try {
      return await res.json();
    } catch {
      throw new Error(`Twenty: resposta inválida (não-JSON) em ${path}.`);
    }
  }

  /** Filtro simples no formato de query da Twenty REST (NÃO VERIFICADO). */
  private filterQuery(campo: string, valor: string | number): string {
    const v = typeof valor === 'number' ? valor : `"${valor.replace(/"/g, '\\"')}"`;
    return `?filter=${encodeURIComponent(`${campo}[eq]:${v}`)}`;
  }

  async listar(contaId: string): Promise<Oportunidade[]> {
    const dados: TwentyOpportunity[] = [];
    let cursor: string | null = null;
    for (let pagina = 0; pagina < 20; pagina++) {
      const qs = cursor ? `?first=60&after=${encodeURIComponent(cursor)}` : '?first=60';
      const json = await this.request(`/opportunities${qs}`);
      const lote: TwentyOpportunity[] = json?.data?.opportunities ?? [];
      dados.push(...lote);
      const pageInfo = json?.pageInfo ?? json?.data?.pageInfo;
      if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) break;
      cursor = pageInfo.endCursor;
    }
    return dados.map((o) => twentyParaOportunidade(contaId, o));
  }

  async buscar(contaId: string, id: number): Promise<Oportunidade | null> {
    const json = await this.request(`/opportunities/${id}`);
    const dado: TwentyOpportunity | undefined = json?.data?.opportunity;
    return dado ? twentyParaOportunidade(contaId, dado) : null;
  }

  /** Busca Company por nome exato; cria se não existir. */
  private async encontrarOuCriarCompany(nome: string): Promise<string | null> {
    if (!nome.trim()) return null;
    const busca = await this.request(`/companies${this.filterQuery('name', nome)}`);
    const existente: TwentyCompany | undefined = busca?.data?.companies?.[0];
    if (existente) return existente.id;
    const criado = await this.request('/companies', { method: 'POST', body: JSON.stringify({ name: nome }) });
    const nova: TwentyCompany | undefined = criado?.data?.createCompany;
    return nova?.id ?? null;
  }

  /** Busca Person por email (fonte de verdade); fallback por telefone só se e-mail ausente. Cria se não existir. */
  private async encontrarOuCriarPerson(input: {
    contato: string;
    email?: string | null;
    telefone?: string | null;
    companyId?: string | null;
  }): Promise<string | null> {
    const [firstName, ...resto] = input.contato.trim().split(/\s+/).filter(Boolean);
    const lastName = resto.join(' ');
    if (!firstName && !input.email && !input.telefone) return null;

    if (input.email) {
      const busca = await this.request(`/people${this.filterQuery('emails.primaryEmail', input.email)}`);
      const existente: TwentyPerson | undefined = busca?.data?.people?.[0];
      if (existente) return existente.id;
    } else if (input.telefone) {
      // ponytail: telefone só como desempate quando não há e-mail — nunca é a
      // chave primária de match (instrução explícita da rodada).
      const busca = await this.request(`/people${this.filterQuery('phones.primaryPhoneNumber', input.telefone)}`);
      const existente: TwentyPerson | undefined = busca?.data?.people?.[0];
      if (existente) return existente.id;
    }

    const payload: Record<string, unknown> = {
      name: { firstName: firstName || input.contato || '', lastName },
    };
    if (input.email) payload.emails = { primaryEmail: input.email };
    if (input.telefone) payload.phones = { primaryPhoneNumber: input.telefone };
    if (input.companyId) payload.companyId = input.companyId;
    const criado = await this.request('/people', { method: 'POST', body: JSON.stringify(payload) });
    const nova: TwentyPerson | undefined = criado?.data?.createPerson;
    return nova?.id ?? null;
  }

  async criar(contaId: string, input: OportunidadeInput): Promise<Oportunidade> {
    const companyId = input.empresa ? await this.encontrarOuCriarCompany(input.empresa) : null;
    const pointOfContactId = input.contato
      ? await this.encontrarOuCriarPerson({ contato: input.contato, email: input.email, telefone: input.telefone, companyId })
      : null;

    const estagio = input.estagio && estagioValido(input.estagio) ? input.estagio : ESTAGIO_PADRAO;
    const payload: Record<string, unknown> = {
      name: input.empresa ?? '',
      stage: estagio,
      amount: { amountMicros: Math.round((input.valor ?? 0) * 1_000_000) },
      closeDate: input.previsao_fechamento ?? null,
      companyId,
      pointOfContactId,
      harvestLeadId: input.lead_id ?? null,
    };
    const json = await this.request('/opportunities', { method: 'POST', body: JSON.stringify(payload) });
    const criada: TwentyOpportunity | undefined = json?.data?.createOpportunity;
    if (!criada) throw new Error('Twenty: não consegui criar a oportunidade (resposta sem createOpportunity).');
    return twentyParaOportunidade(contaId, criada);
  }

  async atualizar(contaId: string, id: number, patch: Partial<OportunidadeInput>): Promise<Oportunidade | null> {
    const payload: Record<string, unknown> = {};
    if (patch.empresa !== undefined) payload.name = patch.empresa;
    if (patch.estagio !== undefined) {
      if (!estagioValido(patch.estagio)) throw new Error(`Twenty: estágio inválido "${patch.estagio}".`);
      payload.stage = patch.estagio;
    }
    if (patch.valor !== undefined) payload.amount = { amountMicros: Math.round(patch.valor * 1_000_000) };
    if (patch.previsao_fechamento !== undefined) payload.closeDate = patch.previsao_fechamento;
    if (Object.keys(payload).length === 0) return this.buscar(contaId, id);

    const json = await this.request(`/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (json === null) return null;
    const atualizada: TwentyOpportunity | undefined = json?.data?.updateOpportunity;
    return atualizada ? twentyParaOportunidade(contaId, atualizada) : null;
  }

  async buscarOwners(): Promise<{ id: string; nome: string }[]> {
    const json = await this.request('/workspaceMembers?first=60');
    const membros: TwentyWorkspaceMember[] = json?.data?.workspaceMembers ?? [];
    return membros.map((m) => ({
      id: m.id,
      nome: [m.name?.firstName, m.name?.lastName].filter(Boolean).join(' ') || m.userEmail || m.id,
    }));
  }

  /** Usa o campo customizado harvestLeadId (NÃO VERIFICADO) em vez de telefone fuzzy. */
  async jaExistePorLead(_contaId: string, leadId: number): Promise<boolean> {
    const json = await this.request(`/opportunities${this.filterQuery('harvestLeadId', leadId)}`);
    const lista: TwentyOpportunity[] = json?.data?.opportunities ?? [];
    return lista.length > 0;
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
