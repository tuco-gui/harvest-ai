import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {registerHooks} from 'node:module';
import {servicosDb} from '../helpers/servicos-db.ts';

const f=servicosDb({funis:[{id:'13',conta_id:'a'}],funil_estagios:[{id:1,funil_id:'13'},{id:2,funil_id:'20'}],
 funil_automacoes:[{id:'7',funil_id:'20',conta_id:'b',nome:'Cliente B'},{id:'8',funil_id:'13',conta_id:'a',nome:'Cliente A'}]});
(globalThis as any).__automacoesServicos={db:f.db,perfil:{id:'root',papel:'super_admin',conta_id:'a'}};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__automacoesServicos.perfil;export const supabaseAdmin=()=>globalThis.__automacoesServicos.db;');
 return next(specifier,context);
}});
const lista=await import('../../app/src/app/api/funis/[id]/automacoes/route.ts');
const item=await import('../../app/src/app/api/funis/[id]/automacoes/[automacaoId]/route.ts');
const ctx=(id:string,automacaoId:string)=>({params:Promise.resolve({id,automacaoId})});
const patch=(b:unknown)=>new Request('https://harvest.test',{method:'PATCH',body:JSON.stringify(b)});
after(()=>{h.deregister();delete (globalThis as any).__automacoesServicos;});
test('super admin em workspace selecionada não lê nem altera automação de outro tenant',async()=>{
 assert.equal((await lista.GET(new Request('https://harvest.test'),ctx('20','7'))).status,404);
 assert.equal((await item.GET(new Request('https://harvest.test'),ctx('20','7'))).status,404);
 assert.equal((await item.PATCH(patch({nome:'Inválido'}),ctx('20','7'))).status,404);
 assert.equal(f.tabelas.funil_automacoes[0].nome,'Cliente B');
});
test('estágio de outra conta/funil é recusado antes de gravar parâmetros da automação',async()=>{
 assert.equal((await item.PATCH(patch({estagio_id:2}),ctx('13','8'))).status,400);
 assert.equal((await item.PATCH(patch({acao_parametros:{estagio_destino_id:2}}),ctx('13','8'))).status,400);
 assert.equal((await item.PATCH(patch({nome:'Atualizada',estagio_id:1}),ctx('13','8'))).status,200);
 assert.equal(f.tabelas.funil_automacoes[1].nome,'Atualizada');
});
