import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {buscarImoveisAlternativos,querOutrosImoveis,resumoImoveisAlternativos,sanitizarImoveisPublicados}
 from '../../app/src/lib/superlogicaImoveis.ts';

const fetchOriginal=globalThis.fetch;
const tokenOriginal=process.env.REALIZE_IMOVEIS_API_TOKEN;
const allowOriginal=process.env.REALIZE_SUPERLOGICA_WORKSPACES;
const workspace='11111111-1111-4111-8111-111111111111';
after(()=>{
 globalThis.fetch=fetchOriginal;
 if(tokenOriginal===undefined)delete process.env.REALIZE_IMOVEIS_API_TOKEN;
 else process.env.REALIZE_IMOVEIS_API_TOKEN=tokenOriginal;
 if(allowOriginal===undefined)delete process.env.REALIZE_SUPERLOGICA_WORKSPACES;
 else process.env.REALIZE_SUPERLOGICA_WORKSPACES=allowOriginal;
});
const retorno={data:[
 {codigo:'CA01',ativo:true,publicado:true,categoria:'Casa',finalidade:'Venda',end_cidade:'Botucatu',end_bairro:'Centro',qtd_quartos:2,valor_venda:300000,
  fotos:[{url:'https://static.arboimoveis.com.br/casa01/fachada.jpg'}]},
 {codigo:'AP02',ativo:true,publicado:true,categoria:'Apartamento',finalidade:'Venda',end_cidade:'Botucatu',qtd_quartos:2},
 {codigo:'CA03',ativo:true,publicado:false,categoria:'Casa',finalidade:'Venda',end_cidade:'Botucatu'},
 {codigo:'CA04',ativo:false,publicado:true,categoria:'Casa',finalidade:'Venda',end_cidade:'Botucatu'},
 {codigo:'CA05',ativo:true,publicado:true,categoria:'Casa',finalidade:'Venda',end_cidade:'Bauru'},
 {codigo:'CA06',ativo:true,publicado:true,categoria:'Casa',finalidade:'Locação',end_cidade:'Botucatu'},
 {codigo:'CA07',ativo:true,publicado:true,categoria:'Casa',finalidade:'Venda',end_cidade:'Botucatu',
  fotos:[{url:'https://exemplo-externo.com.br/privado.jpg'}]},
 ]};
test('somente anúncios públicos ativos de venda na cidade solicitada e com fotos confiáveis',()=>{
 const casas=sanitizarImoveisPublicados(retorno,'casa');
 assert.deepEqual(casas.map(x=>x.codigo),['CA01','CA07']);
 assert.equal(casas[0].fotoUrl,'https://static.arboimoveis.com.br/casa01/fachada.jpg');
 assert.equal(casas[1].fotoUrl,null);
 assert(!JSON.stringify(casas).includes('corretor'));
 assert.deepEqual(sanitizarImoveisPublicados(retorno,'apartamento').map(x=>x.codigo),['AP02']);
 assert.deepEqual(sanitizarImoveisPublicados({data:[]}),[]);
});
test('nenhum token de imóveis ou workspace autorizada => nenhuma chamada externa',async()=>{
 delete process.env.REALIZE_IMOVEIS_API_TOKEN;
 process.env.REALIZE_SUPERLOGICA_WORKSPACES=workspace;
 globalThis.fetch=async()=>{throw Error('não deveria chamar rede');};
 assert.equal(await buscarImoveisAlternativos(workspace,'Tem outras casas?'),null);
 process.env.REALIZE_IMOVEIS_API_TOKEN='teste';
 assert.equal(await buscarImoveisAlternativos('outra-workspace','Tem outras casas?'),null);
 assert.equal(await buscarImoveisAlternativos(workspace,'Qual o preço do Alea?'),null);
});
test('API IMÓVEIS usa URL oficial, token próprio e nunca retorna imóvel não publicado',async()=>{
 process.env.REALIZE_IMOVEIS_API_TOKEN='teste-apenas';
 process.env.REALIZE_SUPERLOGICA_WORKSPACES=workspace;
 let chamadas=0;
 globalThis.fetch=async(input,opts)=>{
  chamadas++;
  const u=new URL(String(input));
  assert.equal(u.origin,'https://app-integracao.arboimoveis.com');
  assert.equal(u.pathname,'/api/imoveis');
  assert.equal(opts?.headers?.Authorization,'teste-apenas');
  const filtro=JSON.parse(u.searchParams.get('search')||'{}');
  assert.equal(filtro.ativo,true);assert.equal(filtro.publicado,true);
  assert.equal(filtro.end_cidade,'Botucatu');
  return Response.json(retorno);
 };
 assert(querOutrosImoveis('Vocês têm outras casas?'));
 const casas=await buscarImoveisAlternativos(workspace,'Tem outras casas?');
 assert.equal(chamadas,1);
 assert.deepEqual(casas?.map(x=>x.codigo),['CA01','CA07']);
 assert(resumoImoveisAlternativos(casas).includes('CA01'));
 assert(!resumoImoveisAlternativos(null).includes('CA01'));
});
