import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {registerHooks} from 'node:module';
import {servicosDb} from '../helpers/servicos-db.ts';
let papel='admin',chamadasAuth=0;
const f=servicosDb({contas:[{id:'a',nome:'Cliente A'}],conta_usuarios:[{id:1,user_id:'membro',conta_id:'a',papel:'operador',ativo:true},{id:2,user_id:'membro',conta_id:'b',papel:'admin',ativo:true},{id:3,user_id:'root',conta_id:'a',papel:'admin',ativo:true}],perfis:[{id:'membro',papel:'operador',email:'membro@teste.invalid'},{id:'root',papel:'super_admin',email:'root@teste.invalid'}]});
f.db.auth={admin:{listUsers:async()=>({data:{users:[{id:'convidado',email:'convidado@teste.invalid'}]}}),updateUserById:async()=>{chamadasAuth++;return {error:null};},deleteUser:async()=>{chamadasAuth++;}}};
(globalThis as any).__usuariosOrganizacao={db:f.db,perfil:()=>({id:'admin',papel,conta_id:'a',conta_propria:'b'})};
const data=(s:string)=>({shortCircuit:true as const,url:'data:text/javascript,'+encodeURIComponent(s)});
const h=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return data('export const NextResponse={json:(v,o)=>Response.json(v,o)};');
 if(specifier==='@/lib/supabase/server')return data('export const perfilAtual=async()=>globalThis.__usuariosOrganizacao.perfil();export const supabaseAdmin=()=>globalThis.__usuariosOrganizacao.db;');
 if(specifier==='@/lib/email')return data('export const enviarEmail=async()=>false;');
 if(specifier==='@/lib/senha')return data('export const senhaProvisoria=()=>"senha-ficticia";');
 return next(specifier,context);
}});
const route=await import('../../app/src/app/api/usuarios/route.ts');
const req=(b:unknown,method='PATCH')=>new Request('https://harvest.test',{method,body:JSON.stringify(b)});
after(()=>{h.deregister();delete (globalThis as any).__usuariosOrganizacao;});
test('admin administra papel da workspace ativa, sem elevar papel global nem alterar outra empresa',async()=>{
 assert.equal((await route.PATCH(req({id:'membro',acao:'papel',papel:'admin',conta_id:'b'}))).status,200);
 assert.equal(f.tabelas.conta_usuarios[0].papel,'admin');assert.equal(f.tabelas.conta_usuarios[1].papel,'admin');assert.equal(f.tabelas.perfis[0].papel,'operador');
 assert.equal((await route.PATCH(req({id:'membro',acao:'papel',papel:'super_admin'}))).status,400);
 assert.equal((await route.PATCH(req({id:'root',acao:'papel',papel:'operador'}))).status,403);
});
test('reset de usuário global/multicliente não chega ao Auth; remoção não apaga identidade ou outros acessos',async()=>{
 assert.equal((await route.PATCH(req({id:'membro'}))).status,403);assert.equal((await route.PATCH(req({id:'root'}))).status,403);assert.equal(chamadasAuth,0);
 assert.equal((await route.DELETE(req({id:'membro',conta_id:'b'},'DELETE'))).status,200);
 assert.equal(f.tabelas.conta_usuarios[0].ativo,false);assert.equal(f.tabelas.conta_usuarios[1].ativo,true);assert.equal(chamadasAuth,0);
});
test('convite de usuário existente usa workspace ativa, mesmo quando conta_propria é outra',async()=>{
 const r=await route.POST(req({email:'convidado@teste.invalid',nome:'Convidado',papel:'operador',conta_id:'b'},'POST'));assert.equal(r.status,200);
 assert.equal(f.tabelas.conta_usuarios.find(x=>x.user_id==='convidado')!.conta_id,'a');
 papel='operador';assert.equal((await route.PATCH(req({id:'membro',acao:'papel',papel:'admin'}))).status,403);papel='admin';
});
