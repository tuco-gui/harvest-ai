import assert from 'node:assert/strict';
import { PALETA_ETIQUETAS, nomeEtiqueta, corEtiqueta, atualizarSelecao,
  prioridadeValida, prazoTriagem, estadoSla } from '../../app/src/lib/crmEtiquetas.ts';
assert.equal(PALETA_ETIQUETAS.length,8);
for (const t of PALETA_ETIQUETAS) assert.equal(corEtiqueta(t.cor.toLowerCase()),t.cor);
assert.equal(corEtiqueta('#000000'),undefined);
assert.equal(corEtiqueta(null),null);
assert.equal(nomeEtiqueta(' Proposta ENVIADA  '),'proposta enviada');
assert.equal(nomeEtiqueta('<script>'),null);
assert.deepEqual(atualizarSelecao(['a'],['b','c'],'incluir'),['a','b','c']);
assert.deepEqual(atualizarSelecao(['a','b','c'],['b','a'],'remover'),['c']);
assert(prioridadeValida('urgente'));
assert(!prioridadeValida('invalida'));
assert.equal(prazoTriagem('2026-10-25T12:00:00.000Z','urgente'),'2026-10-25T12:15:00.000Z');
assert.equal(estadoSla('2026-10-25T12:15:00.000Z','aberto',Date.parse('2026-10-25T12:20:00.000Z')),'vencido');
assert.equal(estadoSla('2026-10-25T12:15:00.000Z','resolvido',Date.parse('2026-10-25T12:20:00.000Z')),'concluido');
assert.equal(estadoSla('2026-10-25T12:15:00.000Z','aberto',Date.parse('2026-10-25T12:05:00.000Z')),'em_risco');
console.log('Etiquetas coloridas, lotes, prioridades e SLA verificados');
