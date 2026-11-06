import assert from 'node:assert/strict';
import { test, mock } from 'node:test';

// Adapters externos substituídos ANTES de carregar o runtime real. Nenhum HTTP externo.
let enviados=0, chamadasIA=0, confirmado=true;
let resposta={resposta:'Sou o assistente virtual da Realize. Em que prazo pensa em comprar?',qualificacao:{},handoff:false,frio:false};
let duranteIA: (()=>void)|null=null;
mock.module('../../app/src/lib/conexaoIAWorkspace.ts',{namedExports:{carregarConexaoIA:async()=>({conexao:{provedor:'openai',chave:'fake',modelo:'teste'}})}});
mock.module('../../app/src/lib/ia.ts',{namedExports:{gerarComIA:async()=>{chamadasIA++;duranteIA?.();return JSON.stringify(resposta);}}});
mock.module('../../app/src/lib/whatsappEnvioCanal.ts',{namedExports:{enviarTextoCanal:async()=>{enviados++;return confirmado;}}});
const {executarSessaoBDR}=await import('../../app/src/lib/bdr.ts');

function banco() {
  const conta='11111111-1111-4111-8111-111111111111';
  const cfg:any={conta_id:conta,canal_id:1,funil_id:1,modo:'simulacao',contatos_teste:['5514999999999'],base_aprovada:''};
  const sessao:any={id:'sessao',conta_id:conta,canal_id:1,telefone:'5514999999999',lead_id:1,
    estado:'novo',qualificacao:{},resumo:'',ultima_entrada_id:1,processada_entrada_id:null,versao:0,
    envio_pendente:false,proximo_followup:null,followups:0,cadencia_inicio:null,consentimento_followup:false};
  const tables:Record<string,any[]>={bdr_config:[cfg],bdr_sessoes:[sessao],bdr_execucoes:[],
    inbound_eventos:[{id:1,conta_id:conta,canal_id:1,telefone:sessao.telefone,mensagem:'Tenho interesse no Alea',nome_contato:'Teste',recebido_em:'2026-11-06T14:59:00Z'}],
    agentes_workspace:[{conta_id:conta,tipo:'bdr',ativo:true,instrucao:'Atenda consultivamente.'}],
    opt_outs:[],conta_supressao:[],crm_atendimentos_canais:[],bdr_pausas:[],prospecta_mensagens:[],historico_contato:[],
    contas:[{id:conta,ativo:true,ambiente:'producao',modulos_habilitados:['crm','crm_avancado','agentes']}],
    whatsapp_canais:[{id:1,conta_id:conta,ativo:true,provider:'waha'}]};
  let aoLerConfig:(()=>void)|null=null;
  const admin:any={
    rpc:async(name:string,p:any)=>{
      if(name==='bdr_cancelar_saida'){
        const e=tables.bdr_execucoes.find(e=>e.id===p.p_execucao&&e.conta_id===p.p_conta&&e.status==='reservado');
        if(!e)return {data:false,error:null};e.status='cancelado';sessao.envio_pendente=false;return {data:true,error:null};
      }
      assert.equal(name,'bdr_reservar');
      if(sessao.conta_id!==p.p_conta||sessao.id!==p.p_sessao||sessao.versao!==p.p_versao||sessao.envio_pendente||sessao.bloqueado_ate)return {data:false,error:null};
      sessao.bloqueado_ate='reservado';return {data:true,error:null};
    },
    from(tabela:string){
      const filtros:Array<(r:any)=>boolean>=[];let patch:any=null,novo:any=null,unico=false;
      const q:any={select(){return q;},update(p:any){patch=p;return q;},insert(p:any){novo=p;return q;},
        eq(k:string,v:any){filtros.push(r=>r[k]===v);return q;},neq(k:string,v:any){filtros.push(r=>r[k]!==v);return q;},
        order(){return q;},limit(){return q;},single(){unico=true;return q;},maybeSingle(){unico=true;return q;},
        then(resolve:(r:any)=>void){
          if(tabela==='bdr_config')aoLerConfig?.();
          const rows=tables[tabela];assert(rows,`tabela inesperada: ${tabela}`);
          if(novo){
            if(tabela==='bdr_execucoes'&&rows.some(r=>r.chave===novo.chave&&r.sessao_id===novo.sessao_id&&r.status!=='cancelado'))return resolve({data:null,error:{code:'23505'}});
            const row={id:`${tabela}-${rows.length+1}`,...novo};rows.push(row);return resolve({data:unico?{...row}:[{...row}],error:null});
          }
          const matches=rows.filter(r=>filtros.every(f=>f(r)));
          for(const r of matches)if(patch)Object.assign(r,patch);
          resolve({data:unico?(matches[0]?{...matches[0]}:null):matches.map(r=>({...r})),error:null});
        }};return q;
    }};
  return {admin,cfg,sessao,tables,antesDoCheck:(f:()=>void)=>{aoLerConfig=f;},run:()=>executarSessaoBDR(admin,{...cfg},{...sessao})};
}
test('runtime BDR real: simulação persistida não usa transporte e tick repetido não duplica turno',async()=>{
  enviados=0;chamadasIA=0;const b=banco();await b.run();await b.run();
  assert.equal(enviados,0);assert.equal(chamadasIA,1);assert.equal(b.tables.bdr_execucoes.length,1);
  assert.equal(b.tables.bdr_execucoes[0].status,'simulado');assert.equal(b.sessao.estado,'contato_iniciado');
  assert.equal(b.sessao.turno_pendente,false);
});
test('runtime: frio, objeção, opt-out, humano e nova resposta durante IA',async()=>{
  enviados=0;
  const original=resposta;
  try {
    for(const [decision,expected] of [
      [{...original,frio:true},'nutricao'],
      [{...original,handoff:true,qualificacao:{objecao:'Condição financeira não documentada'}},'aguardando_corretor'],
      [{...original,qualificacao:{interesse:'confirmado',prazo:'3 meses',disponibilidade:'à tarde',renda_faixa:'prefere não informar'}},'aguardando_corretor'],
    ] as const){const b=banco();resposta=decision as any;await b.run();assert.equal(b.sessao.estado,expected);}
    for(const estado of ['opt_out','humano_assumiu','aguardando_corretor','transferido']){
      const b=banco();b.sessao.estado=estado;const antes=chamadasIA;await b.run();assert.equal(chamadasIA,antes);
    }
    const b=banco();duranteIA=()=>{b.sessao.versao++;b.sessao.ultima_entrada_id=2;};await b.run();
    assert.equal(b.tables.bdr_execucoes.length,0,'entrada nova invalida resposta obsoleta');
    const c=banco();duranteIA=()=>{c.sessao.estado='humano_assumiu';};await c.run();
    assert.equal(c.tables.bdr_execucoes.length,0,'humano invalida turno em elaboração');
    assert.equal(enviados,0);
  }finally{resposta=original;duranteIA=null;}
});
test('runtime: homologação envia uma vez, histórico canônico e timeout não repete mensagem',async()=>{
  mock.timers.enable({apis:['Date'],now:new Date('2026-11-06T15:00:00Z')});
  enviados=0;
  try {
    const b=banco();b.cfg.modo='homologacao';b.sessao.consentimento_followup=true;
    await Promise.all([b.run(),b.run()]);await b.run();
    assert.equal(enviados,1);assert.equal(b.tables.prospecta_mensagens.length,1);assert.equal(b.tables.historico_contato.length,1);
    assert.equal(b.tables.bdr_execucoes[0].status,'enviado');assert.equal(b.sessao.proximo_followup,'2026-11-06T19:00:00.000Z');
    const c=banco();c.cfg.modo='homologacao';confirmado=false;
    await c.run();await c.run();assert.equal(enviados,2,'resultado incerto não é repetido no tick seguinte');
    assert.equal(c.sessao.envio_pendente,true);assert.equal(c.tables.bdr_execucoes[0].status,'incerto');
    assert.equal(c.tables.prospecta_mensagens.length,0);
  }finally{confirmado=true;mock.timers.reset();}
});
test('runtime: opt-out externo, conta removida, fora da allowlist e quiet hours bloqueiam transporte',async()=>{
  mock.timers.enable({apis:['Date'],now:new Date('2026-11-06T15:00:00Z')});
  enviados=0;
  try {
    const b=banco();b.cfg.modo='homologacao';b.tables.opt_outs.push({conta_id:b.cfg.conta_id,telefone:b.sessao.telefone,status:'ativo'});await b.run();
    const c=banco();c.cfg.modo='homologacao';c.tables.contas[0].ativo=false;await c.run();
    const d=banco();d.cfg.modo='homologacao';d.cfg.contatos_teste=[];await d.run();
    mock.timers.setTime(new Date('2026-11-06T23:00:00Z').getTime());
    const e=banco();e.cfg.modo='homologacao';await e.run();assert.equal(e.tables.bdr_execucoes.length,0);
    assert.equal(enviados,0);
  }finally{mock.timers.reset();}
});
test('reserva conhecida como não enviada é cancelada e a nova entrada pode ser atendida',async()=>{
  mock.timers.enable({apis:['Date'],now:new Date('2026-11-06T15:00:00Z')});enviados=0;
  try{
    const b=banco();b.cfg.modo='homologacao';
    let mudou=false;b.antesDoCheck(()=>{if(!mudou){mudou=true;b.sessao.versao++;b.sessao.ultima_entrada_id=2;}});
    await b.run();assert.equal(enviados,0);assert.equal(b.sessao.envio_pendente,false);
    assert.equal(b.tables.bdr_execucoes[0].status,'cancelado');
    b.tables.inbound_eventos.push({...b.tables.inbound_eventos[0],id:2,mensagem:'Prazo de 6 meses'});
    await b.run();assert.equal(enviados,1);assert.equal(b.sessao.processada_entrada_id,2);
  }finally{mock.timers.reset();}
});
