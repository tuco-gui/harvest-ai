import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
const workspace='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
let papel='super_admin';const chamadas:any[]=[];const cookies:any[]=[];
(globalThis as any).__delegacaoApi={perfil:()=>({id:'ator-root',papel,conta_id:workspace}),db:{rpc:async(nome:string,args:any)=>{chamadas.push({nome,args});return {data:nome==='servicos_delegar'?id:true,error:null};}},cookies};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(s,c,n){
 if(s==='next/server')return data('export const NextResponse={json:(v,o)=>{const r=Response.json(v,o);r.cookies={set:(...a)=>globalThis.__delegacaoApi.cookies.push(a),delete:(k)=>globalThis.__delegacaoApi.cookies.push([k,"delete"])};return r;}};');
 if(s==='next/headers')return data('export const cookies=async()=>({get:()=>({value:"'+id+'"})});');
 if(s==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__delegacaoApi.perfil();export const supabaseAdmin=()=>globalThis.__delegacaoApi.db;export const COOKIE_CONTA="harvest_conta";');
 if(s.startsWith('@/lib/'))return n(new URL('../../app/src/lib/'+s.slice(6)+'.ts',import.meta.url).href,c);
 return n(s,c);
}});
const {POST,DELETE}=await import('../../app/src/app/api/acesso-delegado/route.ts');
const request=(b:any)=>new Request('https://harvest.test/api/acesso-delegado',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
test('delegação usa a identidade própria do super admin e cookie seguro vinculado à workspace',async()=>{
 const r=await POST(request({conta_id:workspace,modo:'suporte',motivo:'Configuração de suporte auditada',minutos:60,ator_id:'outro'}));
 assert.equal(r.status,200);assert.equal(chamadas[0].args.p_ator,'ator-root');assert.equal(chamadas[0].args.p_conta,workspace);
 const c=cookies.find(x=>x[0]==='harvest_delegacao');assert.equal(c[1],id);assert(c[2].httpOnly);assert(c[2].secure);assert.equal(c[2].sameSite,'lax');
 assert(c[2].maxAge>60*60,'cookie mantém marcador de sessão expirada até encerramento explícito');
});
test('cliente não inicia/revoga delegação e prazos inválidos não chegam ao banco',async()=>{
 const antes=chamadas.length;papel='admin';assert.equal((await POST(request({}))).status,403);assert.equal((await DELETE()).status,403);papel='super_admin';
 assert.equal((await POST(request({conta_id:workspace,modo:'suporte',motivo:'Motivo administrativo',minutos:121}))).status,400);assert.equal(chamadas.length,antes);
});
test('encerramento revoga e audita atomicamente no banco antes de limpar cookie',async()=>{
 assert.equal((await DELETE()).status,200);assert.deepEqual(chamadas.at(-1),{nome:'servicos_encerrar_delegacao',args:{p_id:id,p_ator:'ator-root'}});
 assert(cookies.some(x=>x[0]==='harvest_delegacao'&&x[1]==='delete'));h.deregister();delete (globalThis as any).__delegacaoApi;
});
