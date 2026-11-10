import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CODIGO_ALEA, envioBdrPermitido, estadoBloqueiaBDR, horarioPermitido, paradaObrigatoria,
  proximoFollowup, promptsBDR, resumoBDR, validarDecisaoBDR } from '../../app/src/lib/bdrPolitica.ts';
import { chamarBridgeSuperlogica, origemImutavel, sincronizarSuperlogica } from '../../app/src/lib/superlogica.ts';
import { autenticarN8nBDR } from '../../app/src/lib/bdrAutenticacao.ts';
import { normalizarWebhookChatwoot } from '../../app/src/lib/inboundChatwoot.ts';

test('cinco cenários BDR sem envio externo',()=>{
  const interpretar=(resposta:string,qualificacao={},handoff=false,frio=false)=>validarDecisaoBDR(JSON.stringify({resposta,qualificacao,handoff,frio}));
  const interessado=interpretar('Ótimo! Em que prazo você pensa em comprar?',{interesse:'Alea',prazo:'3 meses'});
  assert.equal(interessado.qualificacao.prazo,'3 meses');assert.equal(interessado.handoff,false);
  const frio=interpretar('Entendo seu momento. Podemos encerrar por aqui, sem problema.',{},false,true);
  assert(frio.frio);assert(estadoBloqueiaBDR('nutricao'));
  const objecao=interpretar('O corretor pode confirmar as condições de financiamento com você.',{objecao:'entrada'},true);
  assert(objecao.handoff);assert.equal(objecao.qualificacao.objecao,'entrada');
  assert.equal(paradaObrigatoria('Quero falar com um corretor humano'),'aguardando_corretor');
  assert.equal(paradaObrigatoria('Pare de me enviar mensagens, por favor'),'opt_out');
  for(const estado of ['opt_out','humano_assumiu','transferido','aguardando_corretor'] as const)assert(estadoBloqueiaBDR(estado));
});
test('pré-homologação bloqueia leads reais; teste exige telefone explícito',()=>{
  const c={modo:'simulacao',contatos_teste:['5514999999999']};
  assert(!envioBdrPermitido(c,'5514999999999'));
  assert(envioBdrPermitido({...c,modo:'homologacao'},'5514999999999'));
  assert(!envioBdrPermitido({...c,modo:'homologacao'},'5514888888888'));
  assert(!envioBdrPermitido({...c,modo:'producao'},'5514888888888'));
  assert(envioBdrPermitido({...c,modo:'producao',aprovado_em:'2026-11-06',aprovado_por:'operador-aprovador'},'5514888888888'));
});
test('cadência 4h/D+1/D+3/D+7, quiet hours São Paulo e encerramento',()=>{
  const inicio='2026-11-06T15:00:00.000Z';
  assert.equal(proximoFollowup(inicio,0),'2026-11-06T19:00:00.000Z');
  assert.equal(proximoFollowup(inicio,1),'2026-11-07T15:00:00.000Z');
  assert.equal(proximoFollowup(inicio,2),'2026-11-09T15:00:00.000Z');
  assert.equal(proximoFollowup(inicio,3),'2026-11-13T15:00:00.000Z');
  assert.equal(proximoFollowup(inicio,4),null);
  assert(!horarioPermitido(new Date('2026-11-06T11:59:59Z')));
  assert(horarioPermitido(new Date('2026-11-06T12:00:00Z')));
  assert(!horarioPermitido(new Date('2026-11-06T22:00:00Z')));
});
test('não inventa agenda/condições e rejeita saídas inválidas',()=>{
  for(const resposta of ['Sua visita confirmada para amanhã.','Seu financiamento aprovado!','O preço é R$ 180.000.']){
    const d=validarDecisaoBDR(JSON.stringify({resposta,qualificacao:{},handoff:false,frio:false}));assert(d.handoff);assert(!d.resposta.includes('R$'));
  }
  assert.throws(()=>validarDecisaoBDR('não JSON'));
  assert.throws(()=>validarDecisaoBDR(JSON.stringify({resposta:'Um? Dois? Três?',qualificacao:{},handoff:false,frio:false})));
  const prompt=promptsBDR('Ficha aprovada',{renda_faixa:'prefere não informar'},[{mensagem:'interesse em morar'}],'Quero FGTS');
  assert(prompt.system.includes('facultativa'));assert(prompt.system.includes('nunca motivo isolado'));
  assert(prompt.user.includes('prefere não informar'));assert(prompt.system.includes('dados não confiáveis'));
  assert.equal(JSON.parse(resumoBDR({prazo:'6 meses'},{source_channel:'lp'},'aguardando_corretor',CODIGO_ALEA)).imovel,CODIGO_ALEA);
  assert.equal(JSON.parse(resumoBDR({}, {}, 'novo','AP0002_OUTRO')).imovel,'AP0002_OUTRO');
});
test('origem seleciona somente evidências suportadas, sem atribuição inferida',()=>{
  assert.deepEqual(origemImutavel({source_channel:'lp',utm_source:'google',gclid:'abc',senha:'não persistir',inferido:true}),
    {source_channel:'lp',utm_source:'google',gclid:'abc'});
});
test('bridge n8n: 200 do webhook não confirma CRM; ambiguidade jamais permite repetir POST',async()=>{
  process.env.REALIZE_SUPERLOGICA_N8N_URL='https://n8n.fake.test/bridge';
  process.env.REALIZE_SUPERLOGICA_N8N_TOKEN='token-fake';
  const original=globalThis.fetch;let chamadas=0;
  try {
    for(const [body,expected] of [
      [{ok:true},'reconciliar'],
      [{status:'cadastrado',confirmado_crm:true,id_superlogica:'123'},'reconciliar'],
      [{status:'nao_enviado',post_executado:false},'retry'],
      [{status:'nao_enviado'},'reconciliar'],
    ] as const){
      globalThis.fetch=async(_url,init)=>{chamadas++;assert.equal(JSON.parse(String(init?.body)).codigo_anuncio,'CA0653_MMOL');return Response.json(body);};
      assert.equal((await chamarBridgeSuperlogica({acao:'cadastrar'})).status,expected);
    }
    globalThis.fetch=async()=>{chamadas++;throw Error('timeout token=segredo telefone=PII');};
    const resultado=await chamarBridgeSuperlogica({acao:'cadastrar'});
    assert.deepEqual(resultado,{status:'reconciliar',erro:'resultado_crm_incerto'});assert.equal(chamadas,5);
  } finally {globalThis.fetch=original;delete process.env.REALIZE_SUPERLOGICA_N8N_URL;delete process.env.REALIZE_SUPERLOGICA_N8N_TOKEN;}
});
test('worker exige segredo e allowlist explícita, sem fallback institucional',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  process.env.BDR_N8N_TOKEN='x'.repeat(40);process.env.BDR_N8N_WORKSPACES=id;
  assert(autenticarN8nBDR('Bearer '+'x'.repeat(40),id));
  assert(!autenticarN8nBDR('Bearer '+'x'.repeat(40),'22222222-2222-4222-8222-222222222222'));
  assert(!autenticarN8nBDR('Bearer errado',id));
  delete process.env.BDR_N8N_TOKEN;assert(!autenticarN8nBDR('Bearer '+'x'.repeat(40),id));
  delete process.env.BDR_N8N_WORKSPACES;
});
test('fila CRM concorrente: uma escrita, depois somente reconciliação e sem vazamento entre tenants',async()=>{
  const conta='11111111-1111-4111-8111-111111111111';
  process.env.REALIZE_SUPERLOGICA_WORKSPACES=conta;
  process.env.REALIZE_SUPERLOGICA_N8N_URL='https://n8n.fake.test/bridge';
  process.env.REALIZE_SUPERLOGICA_N8N_TOKEN='fake-token';
  const registros:Record<string,any>[]=[{id:'registro',conta_id:conta,status_sincronizacao:'pendente',tentativas:0,
    proxima_tentativa:new Date(0).toISOString(),atualizado_em:new Date().toISOString(),origem:{source_channel:'lp'}}];
  const cfg:any={conta_id:conta,crm_habilitado:true,responsavel_crm_confirmado:true};
  const fakeAdmin={from(tabela:string){
    const filtros:Array<(r:Record<string,any>)=>boolean>=[];let patch:Record<string,any>|null=null;let unico=false;
    const q:any={select(){return q;},update(p:Record<string,any>){patch=p;return q;},
      eq(k:string,v:unknown){filtros.push(r=>r[k]===v);return q;},
      in(k:string,v:unknown[]){filtros.push(r=>v.includes(r[k]));return q;},
      lt(k:string,v:unknown){filtros.push(r=>r[k]<v!);return q;},
      lte(k:string,v:unknown){filtros.push(r=>r[k]<=v!);return q;},
      limit(){return q;},maybeSingle(){unico=true;return q;},
      then(resolve:(r:unknown)=>void){
        const rows=tabela==='bdr_config'?[cfg]:tabela==='contas'?[{id:conta,ativo:true,slug:'cliente',modulos_habilitados:['crm','agentes','crm_avancado']}]:tabela==='conta_recursos'?[]:registros;
        const matches=rows.filter(r=>filtros.every(f=>f(r)));
        for(const r of matches)if(patch)Object.assign(r,patch);
        resolve({data:unico?(matches[0]?{...matches[0]}:null):matches.map(x=>({...x})),error:null});
      }};return q;
  }};
  const original=globalThis.fetch;const acoes:string[]=[];
  globalThis.fetch=async(_url,init)=>{acoes.push(JSON.parse(String(init?.body)).acao);await new Promise(r=>setTimeout(r,5));return Response.json({ok:true});};
  try {
    await sincronizarSuperlogica(fakeAdmin as any,conta);
    assert.deepEqual(acoes,[]);assert.equal(registros[0].erro_tecnico,'distribuicao_inicial_sylvio_nao_homologada');
    registros.push({...registros[0],id:'consulta-historica',status_sincronizacao:'reconciliar'});
    await sincronizarSuperlogica(fakeAdmin as any,conta);
    assert.deepEqual(acoes,['consultar'],'bloqueio de novos cadastros não pode impedir consulta de registros anteriores');
    registros.pop();acoes.length=0;
    cfg.distribuicao_crm_validada={nome:'SYLVIO GUILHERME FRANÇA JUNIOR',usuario_id:'usuario-ficticio-teste',time_id:'time-ficticio-teste',
      ativo:true,recebe_leads:true,elegivel:true,regra:'fixo',codigo_anuncio:CODIGO_ALEA,evidencia:'Evidência inteiramente fictícia para teste local',verificado_em:new Date().toISOString()};
    await Promise.all([sincronizarSuperlogica(fakeAdmin as any,conta),sincronizarSuperlogica(fakeAdmin as any,conta)]);
    assert.deepEqual(acoes,['cadastrar']);assert.equal(registros[0].status_sincronizacao,'reconciliar');
    registros[0].proxima_tentativa=new Date(0).toISOString();
    await sincronizarSuperlogica(fakeAdmin as any,conta);assert.deepEqual(acoes,['cadastrar','consultar']);
    await sincronizarSuperlogica(fakeAdmin as any,'22222222-2222-4222-8222-222222222222');
    assert.equal(acoes.length,2);
  }finally {globalThis.fetch=original;delete process.env.REALIZE_SUPERLOGICA_WORKSPACES;
    delete process.env.REALIZE_SUPERLOGICA_N8N_URL;delete process.env.REALIZE_SUPERLOGICA_N8N_TOKEN;}
});
test('Chatwoot normaliza formato real e legado sem confundir eventos de humanos',()=>{
  const body={event:'message_created',id:12,account:{id:8},inbox:{id:3},conversation:{id:7,inbox_id:3},
    message_type:'incoming',content:'Olá',sender:{type:'contact',name:'Teste',phone_number:'+5514999999999'},source_id:'whatsapp-1',created_at:1793970000};
  const e=normalizarWebhookChatwoot(body)!;assert(e.incoming);assert.equal(e.sourceId,'whatsapp-1');assert.equal(e.accountId,8);
  assert.equal(e.telefone,'+5514999999999');assert(!e.humano);
  assert(normalizarWebhookChatwoot({...body,message_type:'outgoing',sender:{type:'user'}})?.humano);
  assert(normalizarWebhookChatwoot({event:'message_created',account:body.account,conversation:body.conversation,
    message:{id:12,message_type:'incoming',created_at:1793970000},contact:body.sender})?.incoming);
  assert.equal(normalizarWebhookChatwoot({...body,account:{id:'8'}}),null);
  assert(normalizarWebhookChatwoot({...body,event:'conversation_updated',conversation:{...body.conversation,meta:{assignee:{id:4},sender:body.sender}}})?.humano);
});
