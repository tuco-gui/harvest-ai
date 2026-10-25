import assert from 'node:assert/strict';
import { podeCriarNegocioAutomatico, criarNegocioDoPrimeiroInbound }
 from '../../app/src/lib/crmNegocioAutomatico.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
const base={canalId:7,funilId:30,classificacao:'resposta' as const,tipoMensagem:'texto' as const};
assert(podeCriarNegocioAutomatico(base));
assert(!podeCriarNegocioAutomatico({...base,canalId:null}));
assert(!podeCriarNegocioAutomatico({...base,funilId:null}));
assert(!podeCriarNegocioAutomatico({...base,classificacao:'optout'}));
assert(!podeCriarNegocioAutomatico({...base,classificacao:'negativa'}));
assert(!podeCriarNegocioAutomatico({...base,tipoMensagem:'midia'}));

function fake(ativo:boolean,aoRpc:(data:unknown)=>void):SupabaseClient {
 return {
  from(t:string){
   const chain={
    select(_:string){return chain;},eq(_:string,__:unknown){return chain;},
    async maybeSingle(){return {data:{id:30,auto_criar_negocio_inbound:ativo},error:null};},
    order(_:string,__:unknown){return chain;},
    async limit(_:number){return {data:[{id:51,nome:'Novo',probabilidade:5}],error:null};}
   };
   assert(['funis','funil_estagios'].includes(t));
   return chain;
  },
  async rpc(nome:string,args:unknown) {
    assert.equal(nome,'crm_criar_negocio_primeiro_inbound');
    aoRpc(args);return {data:81,error:null};
  }
 } as unknown as SupabaseClient;
}
const input={contaId:'workspace',canalId:7,funilId:30,telefone:'5514999991111',nomeContato:'Contato'};
let chamadas=0;
assert.equal(await criarNegocioDoPrimeiroInbound(fake(false,()=>chamadas++),input),null);
assert.equal(chamadas,0,'padrão desligado nunca chama RPC');
assert.equal(await criarNegocioDoPrimeiroInbound(fake(true,args=>{
 chamadas++;const a=args as Record<string,unknown>;
 assert.equal(a.p_canal,7);assert.equal(a.p_funil,30);
 assert.equal(a.p_estagio_slug,'novo');
}),input),81);
assert.equal(chamadas,1);
console.log('Criação inbound opt-in: não executa por padrão, bloqueia opt-out e mantém funil/canal');
