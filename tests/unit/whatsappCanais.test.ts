/**
 * Testes unitários do resolvedor de canais (lib/whatsappCanais.ts) — Fase 3B.1.
 * Roda sem banco, só a lógica de seleção fixo/rodízio e regras de elegibilidade.
 *
 * Execução:  node --experimental-strip-types tests/unit/whatsappCanais.test.ts
 *
 * Sem framework: contador de asserts e processo com código de saída != 0 em
 * falha (o runner do projeto não tem jest/vitest — mantemos leve, no padrão
 * "um check runnable" da filosofia do repo).
 */
import {
  escolherCanalRodizio, escolherCanalFixo, resolverCanalDisparo,
  type CanalWhatsApp,
} from '../../app/src/lib/whatsappCanais.ts';

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) {
    console.log('  ok  -', msg);
  } else {
    falhas++;
    console.error('  FALHOU -', msg);
  }
}

const mk = (id: number, over: Partial<CanalWhatsApp> = {}): CanalWhatsApp => ({
  id, conta_id: 'conta-a', nome: `Canal ${id}`, provider: 'waha',
  numero: null, identificador_externo: null, status: 'conectado',
  ativo: true, padrao: false, criado_em: '', atualizado_em: '',
  ...over,
});

// --- Rodízio determinístico ---
{
  const canais = [mk(1), mk(2), mk(3)];
  // índice 0 -> id 1, 1 -> 2, 2 -> 3, 3 -> 1 (wrap), sempre estável
  ok(escolherCanalRodizio(canais, 0)?.id === 1, 'rodízio semente 0 -> canal 1');
  ok(escolherCanalRodizio(canais, 1)?.id === 2, 'rodízio semente 1 -> canal 2');
  ok(escolherCanalRodizio(canais, 2)?.id === 3, 'rodízio semente 2 -> canal 3');
  ok(escolherCanalRodizio(canais, 3)?.id === 1, 'rodízio semente 3 (wrap) -> canal 1');
  // não é aleatório: mesma semente sempre mesmo canal
  ok(escolherCanalRodizio(canais, 5)?.id === escolherCanalRodizio(canais, 5)?.id, 'rodízio é determinístico (não random)');
  // distribuição: 9 leads em 3 canais cai ~3/3/3
  const contagem: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 9; i++) { const c = escolherCanalRodizio(canais, i); if (c) contagem[c.id]++; }
  ok(contagem[1] === 3 && contagem[2] === 3 && contagem[3] === 3, 'rodízio distribui igualmente (3/3/3)');
}

// --- Rodízio ignora inativo / desconectado ---
{
  const canais = [mk(1, { ativo: false }), mk(2, { status: 'desconectado' }), mk(3)];
  // só o canal 3 é elegível -> sempre 3
  ok(escolherCanalRodizio(canais, 0)?.id === 3, 'rodízio ignora canal inativo');
  ok(escolherCanalRodizio(canais, 1)?.id === 3, 'rodízio ignora canal desconectado');
  ok(escolherCanalRodizio(canais, 7)?.id === 3, 'rodízio fica só no canal elegível mesmo com semente alta');
}

// --- Fixo por id e padrão ---
{
  const canais = [mk(1, { padrao: true }), mk(2)];
  ok(escolherCanalFixo(canais, 2)?.id === 2, 'fixo escolhe o id pedido');
  ok(escolherCanalFixo(canais, null)?.id === 1, 'fixo sem id usa o padrão');
  // id inexistente -> null (rejeitado, sem fallback silencioso)
  ok(escolherCanalFixo(canais, 99) === null, 'fixo com id inexistente -> null (rejeitado)');
  // canal pedido inativo -> null
  ok(escolherCanalFixo([mk(1, { ativo: false })], 1) === null, 'fixo em canal inativo -> null');
  ok(escolherCanalFixo([mk(1, { status: 'desconhecido' })], 1) === null, 'fixo desconhecido -> null (somente WORKING pode enviar)');
}

// --- Isolamento de tenant: o resolvedor nunca retorna canal fora do array ---
{
  // A posse do canal pela conta é garantida ANTES (query filtra por conta_id /
  // RLS). O resolvedor só escolhe DENTRO do conjunto recebido — não há vazamento
  // possível aqui. Confirmamos que o retorno sempre pertence ao array de entrada.
  const canaisA = [mk(1, { conta_id: 'conta-a', padrao: true })];
  const canaisB = [mk(9, { conta_id: 'conta-b', padrao: true })];
  const rA = resolverCanalDisparo(canaisA, 'fixo', null, 0);
  const rB = resolverCanalDisparo(canaisB, 'fixo', null, 0);
  ok(rA !== null && canaisA.includes(rA), 'resolvedor só retorna canal do conjunto A');
  ok(rB !== null && canaisB.includes(rB), 'resolvedor só retorna canal do conjunto B');
  // canal pedido de outra conta (id 99) não existe no array -> rejeitado
  ok(resolverCanalDisparo(canaisA, 'fixo', 99, 0) === null, 'canal de outra conta (id 99) ausente do array -> null');
  ok(resolverCanalDisparo([], 'rodizio', null, 0) === null, 'sem canais elegíveis -> null (disparo deve falhar explicitamente)');
}

// --- Modo via parâmetro ---
{
  const canais = [mk(1), mk(2)];
  ok(resolverCanalDisparo(canais, 'rodizio', null, 0)?.id === 1, 'resolver rodizio respeita semente');
  ok(resolverCanalDisparo(canais, 'fixo', 2, 0)?.id === 2, 'resolver fixo respeita canalId');
}

if (falhas) {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
console.log('\nTodos os testes de canal passaram.');
