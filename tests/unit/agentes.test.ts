import assert from 'node:assert/strict';
import {
  TIPOS_AGENTE, CATALOGO_AGENTES, tipoAgenteValido,
  validarConfiguracaoAgente, promptsDoLaboratorio,
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
console.log('Agentes: catálogo, permissões e restrições de simulação aprovados');
