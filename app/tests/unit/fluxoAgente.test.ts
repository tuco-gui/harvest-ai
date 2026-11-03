import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FLUXO_BDR_IMOBILIARIO_BASE, validarFluxoAgente } from '../../src/lib/fluxoAgente';

describe('fluxo do agente BDR', () => {
  it('aceita o modelo imobiliario com handoff', () => {
    assert.deepEqual(validarFluxoAgente(FLUXO_BDR_IMOBILIARIO_BASE), []);
  });
  it('recusa desativar regras obrigatorias', () => {
    assert.ok(validarFluxoAgente({
      ...FLUXO_BDR_IMOBILIARIO_BASE,
      respeitarOptOut: false as true,
    }).includes('Regras de segurança não podem ser desligadas.'));
  });
  it('recusa salto para etapa desconhecida', () => {
    assert.ok(validarFluxoAgente({
      ...FLUXO_BDR_IMOBILIARIO_BASE,
      blocos: FLUXO_BDR_IMOBILIARIO_BASE.blocos.map((b, i) => i === 0 ? {...b, proximo: 'fantasma'} : b),
    }).includes('Bloco seguinte inexistente.'));
  });
  it('exige transferencia humana', () => {
    assert.ok(validarFluxoAgente({
      ...FLUXO_BDR_IMOBILIARIO_BASE,
      blocos: FLUXO_BDR_IMOBILIARIO_BASE.blocos.filter(b => b.etapa !== 'handoff'),
    }).includes('Handoff humano obrigatório.'));
  });
});