import assert from 'node:assert/strict';
import { montarConversas, telefoneAtendimento, validarAlteracaoAtendimento,
  operadorPodeVerConversa } from '../../app/src/lib/crmAtendimentos.ts';
import { modulosDaConta } from '../../app/src/lib/autorizacao.ts';

const admin = { id: 'adm', papel: 'admin' as const };
const operador = { id: 'op1', papel: 'operador' as const };
const r = [
  { telefone: '5514999991111', nome_contato: 'Cliente A', mensagem: 'Olá',
    recebido_em: '2026-10-25T10:00:00Z', lead_id: 1 },
  { telefone: '5514999991111', nome_contato: 'Cliente A', mensagem: 'Preciso de orçamento',
    recebido_em: '2026-10-25T12:00:00Z', lead_id: 1 },
  { telefone: '5514999992222', nome_contato: 'Cliente B', mensagem: 'Bom dia',
    recebido_em: '2026-10-25T13:00:00Z', lead_id: 2 },
  { telefone: '5514999993333', nome_contato: 'Cliente C', mensagem: 'Aguardando',
    recebido_em: '2026-10-25T14:00:00Z', lead_id: 3 },
];
const metadados = [
  { telefone: '5514999991111', status: 'pendente' as const,
    responsavel_id: 'op1', etiquetas: ['proposta'], atualizado_em: '2026-10-25T13:00:00Z' },
  { telefone: '5514999992222', status: 'aberto' as const,
    responsavel_id: 'op2', etiquetas: [], atualizado_em: '2026-10-25T13:00:00Z' },
];
assert.equal(montarConversas(r, metadados, admin).length, 3, 'administrador visualiza a fila');
const minhas = montarConversas(r, metadados, operador);
assert.equal(minhas.length, 1, 'operador vê apenas suas conversas atribuídas');
assert.equal(minhas[0].telefone, '5514999991111');
assert.equal(minhas[0].total, 2);
assert.equal(minhas[0].ultimaMensagem, 'Preciso de orçamento');
assert.equal(minhas[0].status, 'pendente');
assert.equal(minhas[0].etiquetas[0], 'proposta');
assert(!operadorPodeVerConversa(operador, null));
assert(!operadorPodeVerConversa(operador, { responsavel_id: 'op2' }));
assert(operadorPodeVerConversa(operador, { responsavel_id: 'op1' }));
assert(operadorPodeVerConversa(admin, null));
assert.equal(telefoneAtendimento(' (14) 99999-1111 '), '5514999991111');
assert.equal(telefoneAtendimento('1234'), null);
assert.equal(telefoneAtendimento('5514999991111123'), null);
assert('erro' in validarAlteracaoAtendimento({ status: 'resolvido', etiquetas: [],
  responsavel_id: 'um-outro-usuario' }, true));
assert('erro' in validarAlteracaoAtendimento({ status: 'aberto', etiquetas: [],
  responsavel_id: null }, false), 'operador não transfere');
assert('erro' in validarAlteracaoAtendimento({ status: 'fechado', etiquetas: [] }, true));
assert('erro' in validarAlteracaoAtendimento({ status: 'aberto', etiquetas: ['<script>'] }, true));
assert('erro' in validarAlteracaoAtendimento({ status: 'aberto',
  etiquetas: Array(9).fill('a') }, true));
const v = validarAlteracaoAtendimento({ status: 'resolvido', etiquetas: ['  urgente ', 'urgente'] }, false);
assert(!('erro' in v));
if (!('erro' in v)) assert.deepEqual(v.etiquetas, ['urgente']);
assert(!modulosDaConta(['crm'], 'super_admin').has('crm_avancado'));
assert(modulosDaConta(['crm', 'crm_avancado'], 'admin').has('crm_avancado'));
console.log('Inbox CRM: fila, isolamento de atendentes, papeis, etiquetas, telefone e modulos OK');
