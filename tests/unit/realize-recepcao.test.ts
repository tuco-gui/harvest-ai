import assert from 'node:assert/strict';
import {test} from 'node:test';
import {jornadaRealize,intencaoRealize,mensagemRecepcao,origemAleaVerificada,preTriagemRealize} from '../../app/src/lib/realizeRecepcao.ts';

test('WhatsApp geral: saudação sem origem não vira Alea',()=>{
 assert.equal(jornadaRealize('Olá',null,false),'recepcao');
 assert.equal(jornadaRealize('Quero comprar uma casa',null,false),'recepcao');
 assert.equal(jornadaRealize('Quero saber do Aleia Botucatu',null,false),'alea');
 assert.equal(jornadaRealize('Quero saber do Alea Botucatu',null,false),'alea');
});
test('origem comercial comprovada, não alegação do visitante',()=>{
 assert(origemAleaVerificada({source_channel:'lp',utm_campaign:'alea_botucatu'}));
 assert(origemAleaVerificada({source_channel:'minichat',utm_campaign:'alea-botucatu'}));
 assert(!origemAleaVerificada({source_channel:'whatsapp',utm_campaign:'alea'}));
 assert(!origemAleaVerificada({source_channel:'lp',utm_campaign:'outro'}));
 assert(!origemAleaVerificada({source_channel:'lp'}));
 assert.equal(jornadaRealize('Olá',null,true),'alea');
 assert.equal(jornadaRealize('Olá','recepcao',true),'recepcao');
});
test('demanda geral prevalece sobre campanha e contexto anterior',()=>{
 for(const texto of ['Quero alugar uma casa','Quero vender meu imóvel','Quero colocar meu imóvel para alugar','Quero outro imóvel','Não tenho interesse no Alea']){
  assert.equal(jornadaRealize(texto,'alea',true),'recepcao',texto);
 }
 assert.equal(jornadaRealize('Quero saber do ONE Terramaris',null,false),'recepcao');
 assert.equal(jornadaRealize('Quero saber do Alea','recepcao',false),'alea');
});
test('quatro intenções e transferência somente após dados mínimos',()=>{
 assert.equal(intencaoRealize('Quero comprar'),'comprar');
 assert.equal(intencaoRealize('Quero alugar'),'alugar');
 assert.equal(intencaoRealize('Quero vender minha casa'),'vender_proprio');
 assert.equal(intencaoRealize('Quero colocar meu apartamento para alugar'),'disponibilizar_locacao');
 assert(!mensagemRecepcao('',null,null).handoff);
 assert(!mensagemRecepcao('Teste',null,null).handoff);
 assert(!mensagemRecepcao('Teste','alugar',null).handoff);
 assert(mensagemRecepcao('Teste','alugar','apartamento').handoff);
 assert(mensagemRecepcao('Teste','outro',null).handoff);
});
test('MCMV orientativo, recusa e à vista não impedem atendimento',()=>{
 for(const [renda_faixa,faixa] of [['ate_3200','faixa_1'],['3200_01_a_5000','faixa_2'],['5000_01_a_9600','faixa_3'],['9600_01_a_13000','classe_media'],['acima_13000','fora_do_limite_mcmv_urbano']]){
  const t=preTriagemRealize({renda_faixa,financiamento:'financiar',fgts_entrada:'não tem'});
  assert.equal(t.faixa_renda,faixa);assert.equal(t.status,'coletada');
  assert.equal(t.aprovacao_credito,false);assert.equal(t.parcela_estimada,null);
 }
 assert.equal(preTriagemRealize({renda_faixa:'prefere_nao_informar'}).status,'recusada');
 assert.equal(preTriagemRealize({financiamento:'à vista'}).status,'nao_aplicavel');
 assert.equal(preTriagemRealize({renda_faixa:'4000'}).status,'dados_insuficientes');
});
