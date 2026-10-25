import assert from 'node:assert/strict';
import { CANAIS_HARVEST, chaveConversaCanal, validarEventoCanal } from '../../app/src/lib/canaisUnificados.ts';
assert(CANAIS_HARVEST.some(c=>c.id==='whatsapp_waha' && c.situacao==='operacional'));
for(const id of ['instagram_dm','facebook_messenger','webchat','whatsapp_cloud_api'])
 assert(CANAIS_HARVEST.some(c=>c.id===id && c.situacao==='planejado' && !c.saida));
assert(CANAIS_HARVEST.some(c=>c.id==='google_business_messages' && c.situacao==='indisponivel'));
const evento={contaId:'workspace-1',canalId:'whatsapp_waha' as const,
 conexaoId:'waha-1',conversaExternaId:'5511999999999',
 mensagemExternaId:'msg-1',remetenteExternoId:'5511999999999',
 recebidoEm:'2026-10-25T10:00:00Z',tipo:'texto' as const,texto:'Oi'};
assert(validarEventoCanal(evento));
assert(!validarEventoCanal({...evento,canalId:'webchat'} as never));
assert.notEqual(chaveConversaCanal(evento),chaveConversaCanal({...evento,contaId:'workspace-2'}));
assert.notEqual(chaveConversaCanal(evento),chaveConversaCanal({...evento,conexaoId:'waha-2'}));
assert.throws(()=>chaveConversaCanal({...evento,contaId:''}));
console.log('Contrato multicanal: estados reais, isolamento e validação OK');