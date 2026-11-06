// Estado de leitura limitado; nunca considera uma página isolada como consulta completa.
export function iniciarConsultaLeads(p,opcoes={}) {
  if(!['consultar','cadastrar'].includes(p?.acao)||p.codigo_anuncio!=='CA0653_MMOL'||typeof p.tenant_id!=='string'||
    !/^[0-9a-f-]{36}$/i.test(p.tenant_id)||!p.idempotency_key)throw Error('consulta_invalida');
  if(!/^\d{10,13}$/.test(String(p.telefone??'').replace(/\D/g,''))&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email??'')))throw Error('identidade_consulta_ausente');
  const limite=(v,padrao,max)=>Number.isSafeInteger(v)&&v>0?Math.min(v,max):padrao;
  return {pedido:{...p,acao:'consultar'},page:1,perPage:limite(opcoes.perPage,100,100),maxPages:limite(opcoes.maxPages,50,100),
    maxRecords:limite(opcoes.maxRecords,5000,10000),paginas:0,total:null,lastPage:null,ids:[],candidatos:[]};
}

export function consumirPaginaLeads(s,resposta) {
  const falhar=erro=>({fonte:'api_leads',status_http:Number.isInteger(resposta?.statusCode)?resposta.statusCode:0,
    completa:false,leads:[],paginas_lidas:s.paginas,erro});
  if(resposta?.statusCode!==200)return falhar('http_leads_indisponivel');
  const raw=resposta.body;
  const inteiro=v=>Number.isSafeInteger(v)?v:typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):NaN;
  if(!raw||!Array.isArray(raw.data))return falhar('schema_leads_invalido');
  const b={...raw,...Object.fromEntries(['total','page','perPage','lastPage'].map(k=>[k,inteiro(raw[k])]))};
  if(!['total','page','perPage','lastPage'].every(k=>Number.isSafeInteger(b[k])))return falhar('schema_leads_invalido');
  if(b.total<0||b.page!==s.page||b.perPage<1||b.perPage>s.perPage||b.lastPage<0)return falhar('paginacao_invalida');
  const ultima=Math.max(1,Math.ceil(b.total/b.perPage));
  if(b.lastPage!==ultima&&!(b.total===0&&b.lastPage===0))return falhar('total_paginas_incoerente');
  if(ultima>s.maxPages||b.total>s.maxRecords)return falhar('limite_consulta_excedido');
  if(s.total!==null&&(s.total!==b.total||s.lastPage!==b.lastPage||s.perPage!==b.perPage))return falhar('paginacao_mudou_durante_consulta');
  const quantidade=Math.min(b.perPage,Math.max(0,b.total-(b.page-1)*b.perPage));
  if(b.data.length!==quantidade)return falhar('pagina_incompleta');
  const ids=new Set(s.ids),candidatos=[...s.candidatos];
  const tel=v=>{let t=String(v??'').replace(/\D/g,'');if(t.length===10||t.length===11)t='55'+t;return /^55\d{10,11}$/.test(t)?t:null;};
  const email=v=>String(v??'').trim().toLowerCase();
  const alvoTel=tel(s.pedido.telefone),alvoEmail=email(s.pedido.email);
  for(const r of b.data){
    if(!r||!['string','number'].includes(typeof r.id)||!String(r.id).trim()||String(r.id).length>128||
      (typeof r.id==='number'&&(!Number.isSafeInteger(r.id)||r.id<1))||
      (r.imoveis!=null&&(!Array.isArray(r.imoveis)||r.imoveis.some(i=>!i||typeof i.codigo!=='string'))))return falhar('registro_leads_invalido');
    const id=String(r.id);if(ids.has(id))return falhar('registros_repetidos_entre_paginas');ids.add(id);
    if((alvoTel&&tel(r.telefone)===alvoTel)||(alvoEmail&&email(r.email)===alvoEmail)){
      const codigos=[...new Set((r.imoveis??[]).map(i=>i.codigo))];
      candidatos.push({id_superlogica:id,telefone:tel(r.telefone),email:email(r.email),
        codigo_anuncio:codigos.includes('CA0653_MMOL')?'CA0653_MMOL':codigos[0]??'',codigos_imoveis:codigos});
    }
  }
  const paginas=s.paginas+1;
  if(b.page<ultima)return {...s,page:b.page+1,perPage:b.perPage,total:b.total,lastPage:b.lastPage,
    paginas,ids:[...ids],candidatos,continuar:true};
  if(ids.size!==b.total||paginas!==ultima)return falhar('consulta_nao_completa');
  return {fonte:'api_leads',status_http:200,completa:true,leads:candidatos,total:b.total,
    page:b.page,perPage:b.perPage,lastPage:b.lastPage,paginas_lidas:paginas};
}

/** Adapter injetável usado no teste HTTP e na homologação, sem conhecer credenciais. */
export async function consultarLeadsPaginado(p,buscarPagina,opcoes={}) {
  let estado=iniciarConsultaLeads(p,opcoes);
  for(let i=0;i<estado.maxPages;i++){
    let r;try{r=await buscarPagina({page:estado.page,perPage:estado.perPage});}
    catch{r={statusCode:0};}
    const proximo=consumirPaginaLeads(estado,r);
    if(!proximo.continuar)return proximo;
    estado=proximo;
  }
  return {fonte:'api_leads',status_http:0,completa:false,leads:[],erro:'limite_consulta_excedido'};
}
