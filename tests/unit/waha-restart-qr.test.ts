import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {getOrCreateSession} from '../../app/src/lib/waha.ts';

const fetchAnterior=globalThis.fetch;
const urlAnterior=process.env.WAHA_API_URL;
const chaveAnterior=process.env.WAHA_API_KEY;
process.env.WAHA_API_URL='https://waha.invalid';
process.env.WAHA_API_KEY='fixture';
after(()=>{
 globalThis.fetch=fetchAnterior;
 if(urlAnterior===undefined)delete process.env.WAHA_API_URL;else process.env.WAHA_API_URL=urlAnterior;
 if(chaveAnterior===undefined)delete process.env.WAHA_API_KEY;else process.env.WAHA_API_KEY=chaveAnterior;
});

test('WAHA FAILED usa /restart e espera SCAN_QR_CODE antes de devolver status ao painel',async()=>{
 const chamadas:string[]=[];
 let getCount=0;
 globalThis.fetch=async (input,opts)=>{
  const url=String(input);const method=opts?.method??'GET';chamadas.push(method+' '+url);
  if(method==='POST'&&url.endsWith('/restart'))return Response.json({}, {status:201});
  if(method==='GET'&&url.includes('/api/sessions/')){
   getCount++;
   return Response.json({status:getCount<=2?'FAILED':'SCAN_QR_CODE'}, {status:200});
  }
  throw Error('unexpected endpoint '+method+' '+url);
 };
 const r=await getOrCreateSession('realize-teste');
 assert.equal(r.status,'SCAN_QR_CODE');
 assert(chamadas.some(x=>x.includes('POST ')&&x.endsWith('/restart')));
 assert(!chamadas.some(x=>x.endsWith('/start')),'não usar /start em sessão FAILED');
});

test('WAHA STOPPED continua usando /start sem reiniciar sessão válida',async()=>{
 const chamadas:string[]=[];
 let getCount=0;
 globalThis.fetch=async (input,opts)=>{
  const url=String(input),method=opts?.method??'GET';chamadas.push(method+' '+url);
  if(method==='POST'&&url.endsWith('/start'))return Response.json({}, {status:201});
  if(method==='GET')return Response.json({status:++getCount===1?'STOPPED':'STARTING'});
  throw Error('unexpected request');
 };
 const r=await getOrCreateSession('outro-canal-teste');
 assert.equal(r.status,'STARTING');
 assert(chamadas.some(x=>x.endsWith('/start')));
 assert(!chamadas.some(x=>x.endsWith('/restart')));
});

test('falha HTTP ao reiniciar não é tratada como QR ou sessão conectada',async()=>{
 globalThis.fetch=async (input,opts)=>{
  if(opts?.method==='POST')return Response.json({message:'unavailable'},{status:503});
  return Response.json({status:'FAILED'});
 };
 assert.equal((await getOrCreateSession('terceiro-canal-teste')).status,'ERRO');
});
