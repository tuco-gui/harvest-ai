import assert from 'node:assert/strict';
import {
  montarTimeline, filtrarTimeline, type AtividadeTimeline, type EntradaTimeline, type SaidaTimeline,
} from '../../app/src/lib/crmTimeline.ts';
import { modulosDaConta } from '../../app/src/lib/autorizacao.ts';

assert(!modulosDaConta(['crm'], 'super_admin').has('crm_avancado'));
assert(modulosDaConta(['crm', 'crm_avancado'], 'super_admin').has('crm_avancado'));
const a: AtividadeTimeline[] = [
  { id: 2, tipo: 'tarefa', titulo: 'Retorno', descricao: 'Ligar amanhã',
    concluida: false, vence_em: null, criado_em: '2026-10-24T13:00:00.000Z', autor_id: 'dono' },
  { id: 3, tipo: 'whatsapp', titulo: 'Mensagem enviada', descricao: 'Bom dia!',
    concluida: true, vence_em: null, criado_em: '2026-10-25T14:00:02.000Z', autor_id: 'dono' },
  { id: 4, tipo: 'whatsapp', titulo: 'Mensagem enviada depois', descricao: 'Bom dia!',
    concluida: true, vence_em: null, criado_em: '2026-10-26T18:00:00.000Z', autor_id: 'dono' },
];
const e: EntradaTimeline[] = [
  { id: 8, mensagem: 'Tenho interesse', tipo_mensagem: 'texto',
    tipo_evento: 'resposta', recebido_em: '2026-10-25T15:00:00.000Z', nome_contato: 'João' },
];
const s: SaidaTimeline[] = [
  { id: 3, conteudo: 'Bom dia!', status: 'enviada', erro: null,
    criado_em: '2026-10-25T14:00:00.000Z', enviado_em: '2026-10-25T14:00:01.000Z' },
];
const eventos = montarTimeline(a, e, s, { dono: 'Responsável' });
assert.equal(eventos.length, 4, 'duplicata muito proxima removida, envio posterior preservado');
assert.deepEqual(eventos.map(x => x.id), ['a-4', 'e-8', 's-3', 'a-2'], 'ordem decrescente');
assert.equal(eventos.find(x => x.id === 'a-2')?.autor, 'Responsável');
assert.equal(filtrarTimeline(eventos, 'mensagens').length, 2);
assert.equal(filtrarTimeline(eventos, 'atividades').length, 2);
assert.equal(filtrarTimeline(eventos, 'todos').length, 4);
assert.equal(montarTimeline([], [], [], {}).length, 0);
assert.equal(montarTimeline(a, e, s, {}, 1).length, 1);
assert.equal(montarTimeline([], [{ ...e[0], recebido_em: 'DATA-INVALIDA' }], [], {}).length, 0);
console.log('CRM timeline: ordenacao, fontes, limites, filtragem, deduplicacao e modulo verificados');
