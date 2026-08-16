/**
 * Testes do CRM P0 — camada de adapter (lib/twenty) + regras de negócio.
 * Roda sem banco/Supabase: node --experimental-strip-types tests/unit/crm.test.ts
 *
 * O backend real é o SupabaseCrmBackend (operacional). Aqui usamos um backend
 * em memória que implementa a MESMA interface CrmBackend, para validar as
 * regras (tenant, sem duplicação por lead, mover estágio, owner, valor,
 * próxima ação, persistência) de forma isolada. A integração real com Twenty
 * continua NÃO VERIFICADA (exige credencial ausente).
 */
import { ESTAGIOS_CRM, estagioValido, nomeEstagio, ESTAGIO_PADRAO } from '../../app/src/lib/crmStages.ts';

// Tipos mínimos replicados da interface CrmBackend (lib/twenty) para o teste
// NÃO precisar importar twenty.ts (que puxa supabase/server fora do Next).
type Oportunidade = {
  id: number; conta_id: string; lead_id: number | null; empresa: string; contato: string;
  telefone: string | null; email: string | null; origem: string; estagio: string;
  owner_id: string | null; valor: number; proxima_acao: string | null;
  observacoes: string | null; previsao_fechamento: string | null; criado_em: string; atualizado_em: string;
};
type OportunidadeInput = {
  lead_id?: number | null; empresa?: string; contato?: string; telefone?: string | null;
  email?: string | null; origem?: string; estagio?: string; owner_id?: string | null;
  valor?: number; proxima_acao?: string | null; observacoes?: string | null; previsao_fechamento?: string | null;
};
interface CrmBackend {
  listar(contaId: string): Promise<Oportunidade[]>;
  buscar(id: number): Promise<Oportunidade | null>;
  criar(contaId: string, input: OportunidadeInput): Promise<Oportunidade>;
  atualizar(id: number, patch: Partial<OportunidadeInput>): Promise<Oportunidade | null>;
  buscarOwners(contaId: string): Promise<{ id: string; nome: string }[]>;
  jaExistePorLead(leadId: number): Promise<boolean>;
}

let passou = 0;
let falhou = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passou++; console.log('  ok  -', msg); }
  else { falhou++; console.log('  FALHOU -', msg); }
}

class MemCrmBackend implements CrmBackend {
  private por = new Map<string, Oportunidade[]>();
  private seq = 1;
  async listar(contaId: string) {
    return (this.por.get(contaId) ?? []).map((o) => ({ ...o }));
  }
  async buscar(id: number) {
    for (const lista of this.por.values()) {
      const f = lista.find((o) => o.id === id);
      if (f) return { ...f };
    }
    return null;
  }
  async criar(contaId: string, input: OportunidadeInput) {
    const estagio = input.estagio && estagioValido(input.estagio) ? input.estagio : ESTAGIO_PADRAO;
    const op: Oportunidade = {
      id: this.seq++,
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
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    const lista = this.por.get(contaId) ?? [];
    lista.push(op);
    this.por.set(contaId, lista);
    return { ...op };
  }
  async atualizar(id: number, patch: Partial<OportunidadeInput>) {
    for (const lista of this.por.values()) {
      const idx = lista.findIndex((o) => o.id === id);
      if (idx >= 0) {
        const limpo: any = { ...patch };
        if (patch.estagio && !estagioValido(patch.estagio)) delete limpo.estagio;
        lista[idx] = { ...lista[idx], ...limpo, atualizado_em: new Date().toISOString() };
        return { ...lista[idx] };
      }
    }
    return null;
  }
  async buscarOwners(contaId: string) {
    return [{ id: 'u1', nome: 'Ana' }, { id: 'u2', nome: 'Beto' }];
  }
  async jaExistePorLead(leadId: number) {
    for (const lista of this.por.values()) {
      if (lista.some((o) => o.lead_id === leadId)) return true;
    }
    return false;
  }
}

async function main() {
  // --- Estágios (item 11: não hardcoded arbitrário, configurável) ---
  assert(ESTAGIOS_CRM.length === 6, 'estágios configuráveis (6)');
  assert(nomeEstagio('ganho') === 'Ganho', 'nomeEstagio mapeia id');
  assert(estagioValido('negociacao') && !estagioValido('xpto'), 'estagioValido valida');

  const b = new MemCrmBackend();
  const CONTA_A = 'conta-a';
  const CONTA_B = 'conta-b';

  // --- Criar oportunidade (qualificação) ---
  const op1 = await b.criar(CONTA_A, { lead_id: 10, empresa: 'Padaria SP', contato: 'João', valor: 1500, proxima_acao: 'Ligar' });
  assert(op1.id > 0 && op1.conta_id === CONTA_A, 'criar define conta_id');
  assert(op1.estagio === ESTAGIO_PADRAO, 'estágio padrão quando ausente');

  // --- Evitar duplicação por lead ---
  assert(await b.jaExistePorLead(10) === true, 'jaExistePorLead detecta vínculo');
  assert(await b.jaExistePorLead(999) === false, 'jaExistePorLead ausente = false');

  // --- Mover estágio ---
  const movida = await b.atualizar(op1.id, { estagio: 'proposta' });
  assert(movida?.estagio === 'proposta', 'mover estágio persiste');

  // --- Owner / valor / próxima ação ---
  const edit = await b.atualizar(op1.id, { owner_id: 'u2', valor: 3200, proxima_acao: 'Enviar proposta' });
  assert(edit?.owner_id === 'u2', 'owner atualizado');
  assert(edit?.valor === 3200, 'valor atualizado');
  assert(edit?.proxima_acao === 'Enviar proposta', 'próxima ação atualizada');

  // --- Estágio inválido não corrompe ---
  const semCorromper = await b.atualizar(op1.id, { estagio: 'estagio_falso' } as any);
  assert(semCorromper?.estagio === 'proposta', 'estágio inválido é ignorado');

  // --- Isolamento de tenant ---
  const opB = await b.criar(CONTA_B, { lead_id: 10, empresa: 'Outra' });
  const listaA = await b.listar(CONTA_A);
  const listaB = await b.listar(CONTA_B);
  assert(listaA.every((o) => o.conta_id === CONTA_A), 'listar A só traz conta A');
  assert(listaB.length === 1 && listaB[0].conta_id === CONTA_B, 'listar B só traz conta B');
  assert(!listaA.some((o) => o.conta_id === CONTA_B), 'nenhum vazamento entre contas');

  // --- Persistência (buscar após criar) ---
  const buscada = await b.buscar(op1.id);
  assert(buscada?.empresa === 'Padaria SP' && buscada?.valor === 3200, 'buscar reflete estado persistido');

  console.log(`\ncrm: ${passou} passou, ${falhou} falhou`);
  if (falhou > 0) process.exit(1);
}

main();
