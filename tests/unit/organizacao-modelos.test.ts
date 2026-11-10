import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MODELOS_AGENTES,configuracaoPadrao,validarConfigAgente} from '../../app/src/lib/agenteModelos.ts';
import {promptsDoLaboratorio} from '../../app/src/lib/agentes.ts';
import {distribuicaoRealizeValidada,origemImutavel} from '../../app/src/lib/superlogica.ts';
test('modelos são genéricos e BDR imobiliário especializa BDR sem instanciar um sexto papel',()=>{
 assert.equal(Object.keys(MODELOS_AGENTES).length,6);assert.equal(MODELOS_AGENTES.bdr_imobiliario.tipo,'bdr');
 assert(!/Figueira|Realize|Alea/.test(JSON.stringify(MODELOS_AGENTES)));
 const c=configuracaoPadrao('bdr');assert(validarConfigAgente('bdr',c));assert(!validarConfigAgente('suporte',c));
 assert(!validarConfigAgente('bdr',{...c,horario_fim:8}));assert(!validarConfigAgente('bdr',{...c,canais:[-1]}));
 const prompt=promptsDoLaboratorio({nome:'Agente A',instrucao:'Instrução aprovada',configuracao:{conhecimento:'Base A',transferencia:'Encaminhar ao gestor'}},'Olá');
 assert(prompt.system.includes('Base A'));assert(prompt.system.includes('Encaminhar ao gestor'));assert(prompt.system.includes('NÃO há autorização'));
});
test('flag cadastral antiga e comentário não comprovam regra Fixo nem elegibilidade de Sylvio',()=>{
 assert(!distribuicaoRealizeValidada({responsavel_crm_confirmado:true,comentarioLead:'Responsável Sylvio'}));
 const c={nome:'SYLVIO GUILHERME FRANÇA JUNIOR',usuario_id:'ficticio',time_id:'time-ficticio',ativo:true,recebe_leads:true,elegivel:true,regra:'fixo',codigo_anuncio:'CA0653_MMOL',evidencia:'Evidência fictícia para testes, sem comprovação real',verificado_em:new Date().toISOString()};
 assert(distribuicaoRealizeValidada(c));assert(!distribuicaoRealizeValidada({...c,regra:'rodizio'}));assert(!distribuicaoRealizeValidada({...c,ativo:false}));assert(!distribuicaoRealizeValidada({...c,time_id:''}));
 const origem={source_channel:'lp',renda_familiar:'Faixa declarada',utm_source:'google',utm_medium:'cpc',utm_campaign:'campanha',utm_content:'grupo',utm_term:'termo',gclid:'gclid-ficticio',protocolo:'AB-TESTE'};
 assert.deepEqual(origemImutavel({...origem,senha:'nunca persistir'}),origem);
});
