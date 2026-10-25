import assert from 'node:assert/strict';
import { contatosDasOportunidades, pesquisarContatos } from '../../app/src/lib/crmContatos.ts';
import type { Oportunidade } from '../../app/src/lib/twenty.ts';

const exemplo = {
  conta_id: 'figueira', lead_id: null, contato: 'João', empresa: 'Padaria',
  telefone: '14999999999', email: 'joao@example.com', origem: 'manual', campanha_id: null,
  estagio: 'novo', owner_id: null, valor: 1000, proxima_acao: null,
  observacoes: null, previsao_fechamento: null, probabilidade: 5, tags: ['Interessado'],
  motivo_perda: null, criado_em: '2026-10-22T00:00:00Z', atualizado_em: '2026-10-25T10:00:00Z',
} satisfies Omit<Oportunidade, 'id'>;
const ops = [
  { ...exemplo, id: 1 },
  { ...exemplo, id: 2, empresa: 'Outra loja', tags: ['Retorno'] },
  { ...exemplo, id: 3, contato: 'Maria', email: 'maria@example.com' },
  { ...exemplo, id: 4, contato: '', telefone: null, email: null },
] satisfies Oportunidade[];
const contatos = contatosDasOportunidades(ops);
assert.equal(contatos.length, 3, 'dois negocios do mesmo contato sao agrupados');
assert.equal(contatos.find(c => c.nome === 'João')?.negocios.length, 2);
assert.equal(contatos.find(c => c.nome === 'João')?.tags.length, 2);
assert.equal(contatos.find(c => c.nome === 'Maria')?.possivelDuplicidade, true,
  'mesmo telefone de pessoas diferentes marca possivel duplicidade sem juntar');
assert.equal(contatos.find(c => c.nome === 'João')?.possivelDuplicidade, true);
assert.equal(pesquisarContatos(contatos, 'padaria', false).length, 3);
assert.equal(pesquisarContatos(contatos, 'Joao', false).length, 1);
assert.equal(pesquisarContatos(contatos, '', true).length, 2);
assert.equal(contatosDasOportunidades([]).length, 0);
console.log('Contatos CRM: agrupamento conservador, pesquisa e duplicidade sem merge aprovados');
