import assert from 'node:assert/strict';
import { montarConversas } from '../../app/src/lib/crmAtendimentos.ts';
import { resolverDestinoInbound } from '../../app/src/lib/inboundDestino.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

// Stub imita somente leitura encadeada do Supabase, sem rede e sem mutações.
function banco(canais:Array<{id:number;conta_id:string;provider:string;identificador_externo:string}>,
 funis:Array<{id:number;conta_id:string;canal_padrao_id:number;ativo:boolean}>) {
  return {
    from(tabela:string) {
      const filtros:Record<string,unknown>={};
      const q={
        select(_cols:string){return q;},
        eq(campo:string,valor:unknown){filtros[campo]=valor;return q;},
        limit(n:number){
          const base=tabela==='whatsapp_canais'?canais:tabela==='funis'?funis:[];
          return Promise.resolve({data:base.filter(row=>Object.entries(filtros)
            .every(([key,v])=>(row as Record<string,unknown>)[key]===v)).slice(0,n),error:null});
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
}
const c='11111111-1111-1111-1111-111111111111';
const outro='22222222-2222-2222-2222-222222222222';
const canais=[{id:7,conta_id:c,provider:'waha',identificador_externo:'harvest_canal_7'},
 {id:8,conta_id:outro,provider:'waha',identificador_externo:'harvest_canal_8'}];
const funis=[{id:30,conta_id:c,canal_padrao_id:7,ativo:true}];
let destino=await resolverDestinoInbound(banco(canais,funis),'waha','harvest_canal_7');
assert.deepEqual({conta:destino.contaId,canal:destino.canalId,funil:destino.funilId},
 {conta:c,canal:7,funil:30});
destino=await resolverDestinoInbound(banco(canais,[...funis,{id:31,conta_id:c,canal_padrao_id:7,ativo:true}]),'waha','harvest_canal_7');
assert.equal(destino.funilId,null,'um número compartilhado por dois funis não tem destino automático');
destino=await resolverDestinoInbound(banco([...canais,{id:77,conta_id:outro,provider:'waha',identificador_externo:'harvest_canal_7'}],funis),'waha','harvest_canal_7');
assert.equal(destino.contaId,null,'sessões duplicadas falham fechadas');
const raws=[
 {telefone:'5514999991111',nome_contato:'Teste',mensagem:'No canal 7',recebido_em:'2026-10-25T13:00:00Z',lead_id:1,canal_id:7,funil_id:30},
 {telefone:'5514999991111',nome_contato:'Teste',mensagem:'No canal 8',recebido_em:'2026-10-25T12:00:00Z',lead_id:1,canal_id:8,funil_id:null},
];
const conv=montarConversas(raws,[],{id:'adm',papel:'admin'});
assert.equal(conv.length,1);
assert.equal(conv[0].canalAmbiguo,true);
assert.deepEqual(conv[0].canaisObservados,[7,8]);
assert.equal(conv[0].funilSugeridoId,null,'não sugerir funil quando há vários canais');
const unicas=montarConversas(raws.slice(0,1),[],{id:'adm',papel:'admin'});
assert.equal(unicas[0].canalId,7);
assert.equal(unicas[0].funilSugeridoId,30);
console.log('Inbound: sessão, isolamento, destino ambíguo e Inbox aprovados');
