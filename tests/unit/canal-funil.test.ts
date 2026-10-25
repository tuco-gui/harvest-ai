import assert from 'node:assert/strict';
import { resolverCanalFunil } from '../../app/src/lib/canalDoFunil.ts';
import type { CanalWhatsApp } from '../../app/src/lib/whatsappCanais.ts';
const criar=(id:number,padrao=false,status='conectado'):CanalWhatsApp=>({
 id,conta_id:'workspace-figueira',nome:'Canal '+id,numero:null,
 provider:'waha',identificador_externo:'waha-'+id,status,ativo:true,padrao,
 criado_em:'2026-01-01',atualizado_em:'2026-01-01',
});
const canais=[criar(1,true),criar(2),criar(3,false,'desconectado')];
const base={modo:'fixo' as const,indice:0};
assert.equal(resolverCanalFunil(canais,{...base,canalFunilId:2})?.id,2);
assert.equal(resolverCanalFunil(canais,{...base})?.id,1);
assert.equal(resolverCanalFunil(canais,{...base,canalFunilId:3}),null);
assert.equal(resolverCanalFunil(canais,{...base,canalFunilId:999}),null);
assert.equal(resolverCanalFunil(canais,{...base,canalFunilId:2,canaisCampanhaIds:[1]})?.id,1);
assert.equal(resolverCanalFunil(canais,{...base,canalFunilId:2,canaisCampanhaIds:[1],canalSolicitadoId:2})?.id,2);
assert.equal(resolverCanalFunil(canais,{...base,canaisCampanhaIds:[3]}),null);
assert.equal(resolverCanalFunil(canais,{...base,canaisCampanhaIds:[999]}),null);
assert.equal(resolverCanalFunil(canais,{...base,canaisCampanhaIds:[1,2]})?.id,1);
assert.equal(resolverCanalFunil(canais,{modo:'rodizio',canaisCampanhaIds:[1,2],indice:0})?.id,1);
assert.equal(resolverCanalFunil(canais,{modo:'rodizio',canaisCampanhaIds:[1,2],indice:1})?.id,2);
assert.equal(resolverCanalFunil(canais,{modo:'rodizio',canaisSolicitadosIds:[2],canaisCampanhaIds:[1],indice:1})?.id,2);
console.log('Canal de funil: prioridades, rodízio e fail-closed aprovados');
