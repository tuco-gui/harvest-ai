import assert from 'node:assert/strict';
import {idContatoConversa,canalPertenceAoVinculo,contatoConfere,atribuidoAoAgente}
 from '../../app/src/lib/crmChatwootHandoff.ts';
import {modulosDaConta} from '../../app/src/lib/autorizacao.ts';
const conversa={id:34,inbox_id:8,meta:{sender:{id:29},assignee:{id:15}}};
assert.equal(idContatoConversa(conversa),29);
assert.equal(idContatoConversa({id:34,inbox_id:8}),null);
assert(!canalPertenceAoVinculo(conversa,[7,9]),'inbox nao vinculada');
assert(canalPertenceAoVinculo(conversa,[8,9]));
assert(contatoConfere({phone_number:'+55 14 99999-9999'},'5514999999999'));
assert(!contatoConfere({phone_number:'+55 14 99999-9998'},'5514999999999'));
assert(!contatoConfere({phone_number:null},'5514999999999'));
assert(atribuidoAoAgente(conversa,15));
assert(!atribuidoAoAgente(conversa,16));
assert(!atribuidoAoAgente({id:34,inbox_id:8},15));
assert(!modulosDaConta(['crm'],'super_admin').has('crm_avancado'));
console.log('Chatwoot handoff: IDs, ownership de canal, contato, agente e gate OK');
