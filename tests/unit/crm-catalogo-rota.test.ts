import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

type Produto={id:number;conta_id:string;nome:string;sku:string;ativo:boolean};
const produtos:Produto[]=Array.from({length:301},(_,i)=>({id:i+1,conta_id:'workspace-a',
  nome:'Produto '+String(i+1).padStart(3,'0'),sku:'SKU-'+(i+1),ativo:i!==300}));
produtos.push({id:999,conta_id:'workspace-b',nome:'Produto alheio',sku:'SKU-999',ativo:true});
let perfil:{conta_id:string;papel:string}|null={conta_id:'workspace-a',papel:'admin'};
let habilitado=true,erroBanco=false,erroContagem=false,consultas=0;
const filtros:string[]=[];
function from(tabela:string){
  assert.equal(tabela,'crm_produtos');consultas++;
  let linhas=produtos.slice(),contar=false,inicio=0,fim=249;
  const q={
    select(_cols:string,opts?:{head?:boolean}){contar=opts?.head===true;return q;},
    eq(campo:keyof Produto,valor:unknown){linhas=linhas.filter(p=>p[campo]===valor);return q;},
    or(filtro:string){
      filtros.push(filtro);
      const termo=filtro.split(',')[0].slice('nome.ilike.%'.length,-1).toLowerCase();
      linhas=linhas.filter(p=>p.nome.toLowerCase().includes(termo)||p.sku.toLowerCase().includes(termo));
      return q;
    },
    order(){return q;},
    range(de:number,ate:number){inicio=de;fim=ate;return q;},
    limit(n:number){fim=n-1;return q;},
    then(resolve:(v:unknown)=>unknown){
      const error=erroBanco||(contar&&erroContagem)?{code:'XX000'}:
        !contar&&inicio>linhas.length?{code:'PGRST103'}:null;
      return Promise.resolve(resolve({data:contar?null:linhas.slice(inicio,fim+1),count:linhas.length,error}));
    },
  };
  return q;
}
// Exercitar os handlers reais com as dependências externas substituídas.
const fixture={perfil:()=>perfil,db:{from},modulo:()=>habilitado};
(globalThis as any).__catalogoTeste=fixture;
const modulo=(source:string)=>'data:text/javascript,'+encodeURIComponent(source);
const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier==='next/server')return {shortCircuit:true,url:modulo('export const NextResponse={json:(v,o)=>Response.json(v,o)};')};
  if(specifier==='@/lib/supabase/server')return {shortCircuit:true,url:modulo('export const perfilAtual=async()=>globalThis.__catalogoTeste.perfil(); export const supabaseAdmin=()=>globalThis.__catalogoTeste.db;')};
  if(specifier==='@/lib/autorizacao')return {shortCircuit:true,url:modulo('export const perfilTemModulo=async()=>globalThis.__catalogoTeste.modulo();')};
  if(specifier==='@/lib/crmControleAcesso')return {shortCircuit:true,url:modulo("export const isAdmin=p=>p==='admin';")};
  if(specifier.startsWith('@/lib/'))return next(new URL('../../app/src/lib/'+specifier.slice('@/lib/'.length)+'.ts',import.meta.url).href,context);
  return next(specifier,context);
}});
try{
  const {GET}=await import('../../app/src/app/api/crm/cadastros/[entidade]/route.ts');
  const get=(query='')=>GET(new Request('https://harvest.test/api/crm/cadastros/produtos'+query),
    {params:Promise.resolve({entidade:'produtos'})});
  const pagina=await (await get('?pagina=6')).json();
  assert.equal(pagina.registros.length,50);
  assert.equal(pagina.registros[0].id,251);
  assert.equal(pagina.meta.total,301);
  assert.equal(pagina.meta.tem_mais,true);
  assert(pagina.registros.every((p:Produto)=>p.conta_id==='workspace-a'));
  const busca=await (await get('?pagina=1&busca=SKU-301')).json();
  assert.equal(busca.registros[0].id,301);
  assert.equal(busca.meta.total,1);
  assert.equal(filtros.at(-1),'nome.ilike.%SKU-301%,sku.ilike.%SKU-301%');
  const inativos=await (await get('?pagina=1&estado=inativos')).json();
  assert.equal(inativos.registros.length,1);
  assert.equal(inativos.registros[0].ativo,false);
  const ativos=await (await get('?pagina=1&estado=ativos')).json();
  assert.equal(ativos.meta.total,300);
  for(const numero of [8,100]){
    const vazia=await (await get('?pagina='+numero)).json();
    assert.deepEqual(vazia.registros,[]);
    assert.equal(vazia.meta.total,301);
    assert.equal(vazia.meta.tem_mais,false);
  }
  const legado=await (await get()).json();
  assert.equal(legado.registros.length,250);
  assert.equal(legado.meta,undefined);
  const antes=consultas;
  assert.equal((await get('?pagina=0')).status,400);
  assert.equal((await get('?estado=outro')).status,400);
  const pontuacao=await (await get('?pagina=1&busca=(),')).json();
  assert.deepEqual(pontuacao.registros,[]);
  assert.equal(consultas,antes);
  erroBanco=true;assert.equal((await get('?pagina=1')).status,503);erroBanco=false;
  erroContagem=true;assert.equal((await get('?pagina=100')).status,503);erroContagem=false;
  habilitado=false;assert.equal((await get('?pagina=1')).status,403);habilitado=true;
  perfil={conta_id:'workspace-a',papel:'atendente'};assert.equal((await get('?pagina=1')).status,403);
  perfil=null;assert.equal((await get('?pagina=1')).status,401);
  console.log('Rota catálogo: busca após 250, paginação, retirada, legado, isolamento, autorização e erros OK');
}finally{hooks.deregister();delete (globalThis as any).__catalogoTeste;}
