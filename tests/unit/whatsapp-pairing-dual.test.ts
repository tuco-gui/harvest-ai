import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {statusEvolution,qrEvolution,codigoEvolution,credencialEvolution} from '../../app/src/lib/evolutionPareamento.ts';
import {solicitarCodigoWaha} from '../../app/src/lib/waha.ts';

const prevFetch=globalThis.fetch, envUrl=process.env.WAHA_API_URL, envKey=process.env.WAHA_API_KEY;
after(()=>{globalThis.fetch=prevFetch;if(envUrl===undefined)delete process.env.WAHA_API_URL;else process.env.WAHA_API_URL=envUrl;
if(envKey===undefined)delete process.env.WAHA_API_KEY;else process.env.WAHA_API_KEY=envKey;});
test('Evolution: extrai status e apenas QR data URI válido',()=>{
 assert.equal(statusEvolution({instance:{state:'open'}}),true);
 assert.equal(statusEvolution({instance:{state:'close'}}),false);
 assert.equal(qrEvolution({base64:'data:image/png;base64,Zm9v'}),'data:image/png;base64,Zm9v');
 assert.equal(qrEvolution({base64:'javascript:alert(1)'}),null);
});
test('Evolution: chave/canal devem pertencer exatamente à mesma conta',async()=>{
 const canal={id:3,conta_id:'realize',ativo:true,provider:'evolution',identificador_externo:'instancia-exata'};
 const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{
  evolution_url:'https://evo.example.com',evolution_instancia:'instancia-exata',evolution_key:'test-key'},error:null})})})})};
 await assert.rejects(credencialEvolution(db,'outra-conta',canal),/Canal Evolution/);
 const c=await credencialEvolution(db,'realize',canal);
 assert.equal(c.instancia,'instancia-exata');assert.equal(c.url,'https://evo.example.com');
});
test('Evolution: solicitar pairing code usando somente instância autenticada',async()=>{
 let chamadas=0;
 globalThis.fetch=async(input,opts)=>{
  chamadas++;
  const u=String(input);
  assert.equal(opts?.headers?.apikey,'test-key');
  if(u.includes('/connectionState/'))return Response.json({instance:{state:'close'}});
  assert(u.includes('/instance/connect/instancia-exata?number=5514997754659'));
  return Response.json({pairingCode:'ABCD1234'});
 };
 const codigo=await codigoEvolution({url:'https://evo.example.com',instancia:'instancia-exata',key:'test-key'},'55 (14) 99775-4659');
 assert.equal(codigo,'ABCD1234');assert.equal(chamadas,2);
});
test('WAHA: solicita código por phoneNumber e sem enviar qualquer mensagem',async()=>{
 process.env.WAHA_API_URL='https://waha.example';process.env.WAHA_API_KEY='test-key';
 const chamadas=[];
 globalThis.fetch=async(input,opts)=>{
  const path=new URL(String(input)).pathname;chamadas.push([opts?.method??'GET',path]);
  assert.equal(opts?.headers?.['X-Api-Key'],'test-key');
  if(path==='/api/sessions/session-test')return Response.json({status:'SCAN_QR_CODE'});
  assert.equal(path,'/api/session-test/auth/request-code');
  assert.equal(JSON.parse(opts.body).phoneNumber,'5514997754659');
  return Response.json({code:'ABCD-1234'});
 };
 const code=await solicitarCodigoWaha('session-test','55 (14) 99775-4659');
 assert.equal(code,'ABCD-1234');
 assert(!chamadas.some(([verb,path])=>/send(Text|Image|File)/.test(path)));
});
