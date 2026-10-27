import assert from 'node:assert/strict';
import {consultaAgenda,diasDaGrade,mudarMes} from '../../app/src/lib/crmAgenda.ts';
import {instanteDe,diaLocalISO} from '../../app/src/lib/agenda/fuso.ts';
const q=consultaAgenda(new URLSearchParams('mes=2026-10&fuso=America/Sao_Paulo'));
assert.equal(consultaAgenda(new URLSearchParams(),new Date('2026-11-01T01:00:00Z')).mes,'2026-10');
assert.equal(q.de,'2026-09-27T03:00:00.000Z');
assert.equal(q.ate,'2026-11-08T03:00:00.000Z');
const dias=diasDaGrade('2026-10');assert.equal(dias.length,42);assert.equal(dias[0],'2026-09-27');assert.equal(dias.at(-1),'2026-11-07');
assert.equal(mudarMes('2026-12',1),'2027-01');assert.equal(mudarMes('2026-01',-1),'2025-12');
assert.equal(diaLocalISO(new Date('2026-10-28T01:00:00Z'),'America/Sao_Paulo'),'2026-10-27');
assert.equal(instanteDe({ano:2026,mes:3,dia:8,hora:2,minuto:30},'America/New_York').toISOString(),'2026-03-08T07:30:00.000Z');
assert.equal(instanteDe({ano:2018,mes:3,dia:25},'Asia/Beirut').toISOString(),'2018-03-24T22:00:00.000Z');
for(const query of ['mes=2026-13','mes=2026-00','mes=abc','fuso=Inexistente/Teste','mes=999999-01'])
 assert.throws(()=>consultaAgenda(new URLSearchParams(query)));
console.log('Agenda: grade e consulta idênticas, meses vizinhos, fuso explícito e horário de verão OK');
