import assert from 'node:assert/strict';
import { consultaCatalogo, filtroCatalogo, intervaloCatalogo } from '../../app/src/lib/crmCatalogoBusca.ts';

assert.deepEqual(consultaCatalogo(new URLSearchParams()), { pagina: 1, busca: '', estado: 'todos' });
assert.deepEqual(consultaCatalogo(new URLSearchParams('pagina=6&busca=Plano&estado=inativos')),
  { pagina: 6, busca: 'Plano', estado: 'inativos' });
for (const pagina of ['0', '-1', '2x', '1.5', '1e3', '9007199254740991']) {
  assert.throws(() => consultaCatalogo(new URLSearchParams({ pagina })));
}
assert.throws(() => consultaCatalogo(new URLSearchParams('estado=excluidos')));
assert.throws(() => consultaCatalogo(new URLSearchParams({ busca: 'a'.repeat(161) })));
assert.equal(filtroCatalogo(''), null);
assert.equal(filtroCatalogo('  Plano  mensal '), 'nome.ilike.%Plano mensal%,sku.ilike.%Plano mensal%');
assert.equal(filtroCatalogo('A_10%*'), 'nome.ilike.%A\\_10\\%%,sku.ilike.%A\\_10\\%%');
// Pontuação não pode introduzir outra condição no DSL do PostgREST.
const filtro = filtroCatalogo('x),conta_id.neq.outra("');
assert(filtro);
assert.equal(filtro.split(',').length, 2);
assert(!/[()"]/.test(filtro));
assert.equal(filtroCatalogo('\\'), 'nome.ilike.%\\\\%,sku.ilike.%\\\\%');
assert.deepEqual(intervaloCatalogo(1), [0, 49]);
assert.deepEqual(intervaloCatalogo(6), [250, 299]);

console.log('Catálogo: validação de busca e filtros seguros, páginas além dos 250 registros');
