import assert from 'node:assert/strict';
import { classificarPrazo, filtrarTarefas, validarNovaTarefa, type TarefaCrm } from '../../app/src/lib/crmTarefas.ts';
import { modulosDaConta } from '../../app/src/lib/autorizacao.ts';

assert(!modulosDaConta(['crm'], 'super_admin').has('crm_avancado'), 'feature comercial nao pode furar superadmin');
assert(modulosDaConta(['crm', 'crm_avancado'], 'super_admin').has('crm_avancado'));
assert(!modulosDaConta(['crm'], 'admin').has('crm_avancado'));
assert(modulosDaConta(['crm', 'crm_avancado'], 'admin').has('crm_avancado'));

const agora = new Date('2026-10-25T12:00:00.000Z');
assert.equal(classificarPrazo(null, false, agora), 'sem_prazo');
assert.equal(classificarPrazo('2026-10-24T12:00:00.000Z', false, agora), 'atrasada');
assert.equal(classificarPrazo('2026-10-27T12:00:00.000Z', false, agora), 'proxima');
assert.equal(classificarPrazo('2026-10-24T12:00:00.000Z', true, agora), 'concluida');
const base = {
 id: 1, oportunidade_id: 10, titulo: 'Ligar para prospect', descricao: null, concluida: false,
 vence_em: '2026-10-24T12:00:00.000Z', criado_em: '2026-10-22T00:00:00.000Z',
 empresa: 'Figueira', contato: 'João', owner_id: 'u1', responsavel_nome: 'Ana',
} satisfies TarefaCrm;
const tarefas: TarefaCrm[] = [base,
 {...base, id: 2, titulo: 'Reunião', concluida: true, owner_id: 'u2'},
 {...base, id: 3, titulo: 'Enviar proposta', vence_em: null, empresa: 'Outra'}];
assert.equal(filtrarTarefas(tarefas, 'abertas', '', '', agora).length, 2);
assert.equal(filtrarTarefas(tarefas, 'atrasadas', '', '', agora).length, 1);
assert.equal(filtrarTarefas(tarefas, 'concluidas', '', '', agora).length, 1);
assert.equal(filtrarTarefas(tarefas, 'todas', 'figueira', 'u1', agora).length, 1);
assert.equal(filtrarTarefas(tarefas, 'todas', 'inexistente', '', agora).length, 0);
assert(validarNovaTarefa('', null, null));
assert(validarNovaTarefa('Nova tarefa', 'data-invalida', null));
assert.equal(validarNovaTarefa('Nova tarefa', new Date().toISOString(), 'Descrição'), null);
console.log('crm avançado: isolamento de módulo, prazos, filtros e validação OK');
