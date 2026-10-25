import type { CanalWhatsApp } from './whatsappCanais.ts';
import { escolherCanalFixo, resolverCanalDisparo } from './whatsappCanais.ts';

export type RegraCanalFunil = {
  modo: 'fixo'|'rodizio';
  canalSolicitadoId?: number|null;
  canaisSolicitadosIds?: number[]|null;
  canaisCampanhaIds?: number[]|null;
  canalFunilId?: number|null;
  indice?: number;
};
/**
 * Ordem: escolha explícita -> seleção da campanha -> canal do funil ->
 * padrão da workspace. Canal específico indisponível NÃO gera fallback.
 * Os canais precisam vir filtrados pelo conta_id, conectados e elegíveis.
 */
export function resolverCanalFunil(
  canais: CanalWhatsApp[],
  op: RegraCanalFunil,
): CanalWhatsApp|null {
  const idsExplicitos=(op.canaisSolicitadosIds?.length ? op.canaisSolicitadosIds : null);
  const idsCampanha=(op.canaisCampanhaIds?.length ? op.canaisCampanhaIds : null);
  if (op.canalSolicitadoId != null) return escolherCanalFixo(canais,op.canalSolicitadoId);
  if (idsExplicitos) {
    const filtrados=canais.filter(c=>idsExplicitos.includes(c.id));
    return op.modo==='rodizio'
      ? resolverCanalDisparo(filtrados,'rodizio',null,op.indice??0)
      : escolherCanalFixo(filtrados,idsExplicitos[0]);
  }
  if (idsCampanha) {
    const filtrados=canais.filter(c=>idsCampanha.includes(c.id));
    return op.modo==='rodizio'
      ? resolverCanalDisparo(filtrados,'rodizio',null,op.indice??0)
      : escolherCanalFixo(filtrados,idsCampanha[0]);
  }
  if (op.canalFunilId != null) return escolherCanalFixo(canais,op.canalFunilId);
  return escolherCanalFixo(canais,null);
}
