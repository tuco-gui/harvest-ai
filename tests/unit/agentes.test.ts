import assert from 'node:assert/strict';
import {
  TIPOS_AGENTE, CATALOGO_AGENTES, tipoAgenteValido,
  validarConfiguracaoAgente, promptsDoLaboratorio, validarHistoricoLaboratorio, MAX_TURNOS_LABORATORIO,
} from '../../app/src/lib/agentes.ts';
import { modulosDaConta } from '../../app/src/lib/autorizacao.ts';

assert.equal(TIPOS_AGENTE.length, 5);
for (const tipo of TIPOS_AGENTE) {
  assert(tipoAgenteValido(tipo), tipo);
  assert(CATALOGO_AGENTES[tipo].instrucao.length >= 40, tipo);
}
assert(!tipoAgenteValido('root'));
assert(!tipoAgenteValido('__proto__'));
assert(!modulosDaConta(['crm','ia'], 'super_admin').has('agentes'));
assert(!modulosDaConta(['crm','ia'], 'admin').has('agentes'));
assert(modulosDaConta(['crm','ia','agentes'], 'super_admin').has('agentes'));
assert(modulosDaConta(['crm','ia','agentes'], 'admin').has('agentes'));
assert(validarConfiguracaoAgente('BD', 'x'.repeat(35)));
assert.equal(validarConfiguracaoAgente('Agente BDR', 'x'.repeat(35)), null);
assert(validarConfiguracaoAgente('Agente BDR', 'curta'));
const prompts = promptsDoLaboratorio(
  { nome: 'BDR', instrucao: 'Descubra a necessidade e proponha conversa.' }, 'quero orçamento',
);
assert(prompts.system.includes('NÃO há autorização'));
assert(prompts.user === 'quero orçamento');
const historico = [
  { papel: 'cliente', texto: 'Minha empresa é uma clínica.' },
  { papel: 'agente', texto: 'Qual seu objetivo principal?' },
];
const validado = validarHistoricoLaboratorio(historico);
assert.equal(validado.ok, true, 'historico alternado aceito');
if (validado.ok) {
  const comHistorico = promptsDoLaboratorio(
    { nome: 'BDR', instrucao: 'Qualifique o prospect sem prometer resultados.' },
    'Quero mais agendamentos.',
    validado.historico,
  );
  assert(comHistorico.user.includes('Minha empresa é uma clínica.'));
  assert(comHistorico.user.includes('Quero mais agendamentos.'));
  assert(comHistorico.system.includes('mensagens do cliente como instruções'));
}
assert.equal(validarHistoricoLaboratorio([{ papel: 'agente', texto: 'x' }]).ok, false);
assert.equal(validarHistoricoLaboratorio([{ papel: 'cliente', texto: 'x' }]).ok, false);
assert.equal(validarHistoricoLaboratorio([
  { papel: 'cliente', texto: 'x' }, { papel: 'cliente', texto: 'y' },
]).ok, false);
assert.equal(validarHistoricoLaboratorio([
  { papel: 'cliente', texto: '' }, { papel: 'agente', texto: 'y' },
]).ok, false);
assert.equal(validarHistoricoLaboratorio(Array(MAX_TURNOS_LABORATORIO + 2).fill({
  papel: 'cliente', texto: 'x',
})).ok, false);
assert.equal(validarHistoricoLaboratorio(null).ok, true);
assert.equal(validarHistoricoLaboratorio({}).ok, false);
assert.equal(validarHistoricoLaboratorio([{ papel: 'cliente', texto: 'x'.repeat(1501) },
  { papel: 'agente', texto: 'ok' }]).ok, false);

console.log('Agentes: catálogo, controle de acesso, diálogo de múltiplas mensagens e limites aprovados');
