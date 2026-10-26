import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rotaPublicaSemSessao} from '../../app/src/lib/rotasPublicas.ts';
import {CANAIS_HARVEST} from '../../app/src/lib/canaisUnificados.ts';
const fonte='11111111-2222-4333-8444-555555555555';
assert(rotaPublicaSemSessao('/webchat/'+fonte));
assert(rotaPublicaSemSessao('/api/publico/webchat/'+fonte));
for(const p of ['/api/crm/atendimentos','/api/publico/webchat',
 '/api/publico/webchat/'+fonte+'/outro','/webchat/invalido','/crm/fontes',
 '/api/publico/webchat/'+fonte+'/../qualquer']){
 assert(!rotaPublicaSemSessao(p),'Rota não pode ficar pública: '+p);
}
const s=(caminho:string)=>readFileSync(caminho,'utf8');
const admin=s('app/src/app/api/funis/[id]/fontes/route.ts');
const publico=s('app/src/app/api/publico/webchat/[token]/route.ts');
const interna=s('app/src/app/api/crm/conversas-externas/[id]/route.ts');
const ui=s('app/src/componentes/FunilDetalhe.tsx');
const inbox=s('app/src/componentes/CentralAtendimentosCrm.tsx');
const sql=s('sql/045_fontes_multicanal_e_webchat.sql');
assert.match(admin,/perfilTemModulo\(admin,perfil,'crm_avancado'\)/);
assert.match(admin,/status=b\.tipo==='webchat'\?'pronto':'aguardando_autorizacao'/);
assert.match(admin,/A ativação Meta requer autorização verificada/);
assert.match(publico,/timingSafeEqual/);
assert.match(publico,/segredo_hash/);
assert.match(publico,/Aguarde antes de enviar outra mensagem/);
assert.match(publico,/\.eq\('fonte_id',fonte\.id\)/);
assert.match(interna,/fonte\.tipo!=='webchat'/);
assert.match(interna,/responsavel_id!==perfil\.id/);
assert.match(ui,/crm-kommo-fontes-grade/);
assert.match(ui,/Criar webchat/);
assert.match(ui,/Cadastrar fonte/);
assert.match(ui,/Copiar código/);
assert.match(inbox,/ConversaExternaDetalheCRM/);
assert.match(inbox,/externasFiltradas\.map/);
assert.match(sql,/FOREIGN KEY\(conta_id,fonte_id\)/);
assert.match(sql,/ENABLE ROW LEVEL SECURITY/g);
assert(CANAIS_HARVEST.some(c=>c.id==='webchat'&&c.situacao==='operacional'));
for(const canal of ['instagram_dm','facebook_messenger','whatsapp_cloud_api'])
 assert(CANAIS_HARVEST.some(c=>c.id===canal&&c.situacao==='planejado'));
console.log('Multicanal: caminhos públicos restritos, tenant, widget, Inbox e Meta pendente OK');
