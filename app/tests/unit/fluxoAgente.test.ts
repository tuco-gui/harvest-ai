import { describe, expect, it } from 'vitest';
import { FLUXO_BDR_IMOBILIARIO_BASE, validarFluxoAgente } from '../../src/lib/fluxoAgente';

describe('fluxo do agente BDR', () => {
  it('aceita o modelo imobiliario com handoff', () => {
    expect(validarFluxoAgente(FLUXO_BDR_IMOBILIARIO_BASE)).toEqual([]);
  });
  it('recusa desativar regras obrigatorias', () => {
    expect(validarFluxoAgente({
      ...FLUXO_BDR_IMOBILIARIO_BASE,
      respeitarOptOut: false as true,
    })).toContain('Regras de segurança não podem ser desligadas.');
  });
  it('recusa salto para etapa desconhecida', () => {
    expect(validarFluxoAgente({
      ...FLUXO_BDR_IMOBILIARIO_BASE,
      blocos: FLUXO_BDR_IMOBILIARIO_BASE.blocos.map((b, i) => i === 0 ? {...b, proximo: 'fantasma'} : b),
    })).toContain('Bloco seguinte inexistente.');
  });
  it('exige transferencia humana', () => {
    expect(validarFluxoAgente({
      ...FLUXO_BDR_IMOBILIARIO_BASE,
      blocos: FLUXO_BDR_IMOBILIARIO_BASE.blocos.filter(b => b.etapa !== 'handoff'),
    })).toContain('Handoff humano obrigatório.');
  });
});