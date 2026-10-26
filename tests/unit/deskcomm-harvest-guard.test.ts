import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const required=[
 'app/src/app/api/disparo/route.ts',
 'app/src/componentes/CrmPipeline.tsx',
 'app/src/componentes/CentralAtendimentosCrm.tsx',
 'app/src/app/api/zernio/iniciar/route.ts',
 'app/src/app/api/webhook/zernio/[fonte]/route.ts',
 'app/src/app/api/funis/[id]/fontes/route.ts',
 'app/src/lib/crmNegocioAutomatico.ts',
];
for(const path of required)assert(existsSync(path),'A migração Deskcomm não pode eliminar: '+path);
const dispatch=readFileSync(required[0],'utf8');
assert.match(dispatch,/oportunidades/,'A prospecção precisa continuar integrada ao CRM.');
const funnels=readFileSync(required[5],'utf8');
assert.match(funnels,/conta_id/,'Fontes devem permanecer isoladas por workspace.');
const social=readFileSync(required[4],'utf8');
assert.match(social,/timingSafeEqual/,'Webhook social exige assinatura.');
console.log('Preservação Harvest: prospecção, funil, Inbox, integração Zernio e segregação OK');
