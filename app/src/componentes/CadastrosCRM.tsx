'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { contatosDasOportunidades } from '@/lib/crmContatos';
import type { Oportunidade } from '@/lib/twenty';
import CamposDinamicosCRM from '@/componentes/CamposDinamicosCRM';
import type { CampoDef, EntidadeCadastro } from '@/lib/crmCadastros';
import { PRODUTOS_POR_PAGINA, type EstadoCatalogo } from '@/lib/crmCatalogoBusca';

type Registro = {
 id:number;nome:string;email?:string|null;telefone?:string|null;
 cnpj?:string|null;site?:string|null;setor?:string|null;cargo?:string|null;
 empresa_id?:number|null;sku?:string|null;descricao?:string|null;
 preco?:number;ativo?:boolean;campos_extras?:Record<string,unknown>;
};
type Empresa = {id:number;nome:string};
const NOMES:Record<EntidadeCadastro,string> = {
 empresas:'Empresas',contatos:'Contatos',produtos:'Produtos',
};
const REGISTRO_INICIAL:Record<EntidadeCadastro,()=>Record<string,any>>={
 empresas:()=>({nome:'',cnpj:'',email:'',telefone:'',site:'',setor:'',campos_extras:{}}),
 contatos:()=>({nome:'',email:'',telefone:'',cargo:'',empresa_id:null,campos_extras:{}}),
 produtos:()=>({nome:'',sku:'',descricao:'',preco:0,ativo:true}),
};
const CAMPOS_COMUNS:Record<EntidadeCadastro,Array<{key:string;rotulo:string;tipo?:string}>>={
 empresas:[
  {key:'cnpj',rotulo:'CNPJ'},{key:'email',rotulo:'E-mail',tipo:'email'},
  {key:'telefone',rotulo:'Telefone',tipo:'tel'},{key:'site',rotulo:'Site',tipo:'url'},
  {key:'setor',rotulo:'Setor'}],
 contatos:[
  {key:'email',rotulo:'E-mail',tipo:'email'},
  {key:'telefone',rotulo:'Telefone',tipo:'tel'},{key:'cargo',rotulo:'Cargo'}],
 produtos:[{key:'sku',rotulo:'SKU / Código'},{key:'descricao',rotulo:'Descrição'}],
};
const ENTIDADE_CAMPO:Record<EntidadeCadastro,string|null>={
 empresas:'empresa',contatos:'contato',produtos:null,
};
export default function CadastrosCRM({ entidade, oportunidadesRelacionadas = [] }: { entidade:EntidadeCadastro; oportunidadesRelacionadas?: Oportunidade[] }) {
 const [registros,setRegistros]=useState<Registro[]>([]);
 const [empresas,setEmpresas]=useState<Empresa[]>([]);
 const [campos,setCampos]=useState<CampoDef[]>([]);
 const [busca,setBusca]=useState('');
 const [pagina,setPagina]=useState(1);
 const [estado,setEstado]=useState<EstadoCatalogo>('todos');
 const [total,setTotal]=useState(0);
 const [temMais,setTemMais]=useState(false);
 const [form,setForm]=useState<Record<string,any>>(()=>REGISTRO_INICIAL[entidade]());
 const [aberto,setAberto]=useState(false);
 const [id,setId]=useState<number|null>(null);
 const [carregando,setCarregando]=useState(true);
 const [salvando,setSalvando]=useState(false);
 const [erro,setErro]=useState('');
 const [importando,setImportando]=useState(false);
 const [sucesso,setSucesso]=useState('');
 const buscaRemota=entidade==='produtos'?busca:'';
 const carregar=useCallback(async(signal?:AbortSignal)=>{
  setCarregando(true);setErro('');
  try{
    const uris=['/api/crm/cadastros/'+entidade];
    if(entidade==='produtos')uris[0]+='?'+new URLSearchParams({pagina:String(pagina),busca:buscaRemota,estado});
   if(entidade==='contatos')uris.push('/api/crm/cadastros/empresas');
   if(ENTIDADE_CAMPO[entidade])uris.push('/api/crm/campos-personalizados?entidade='+ENTIDADE_CAMPO[entidade]);
   const res=await Promise.all(uris.map(async u=>{
     const r=await fetch(u,{cache:'no-store',signal});const d=await r.json();
    if(!r.ok)throw Error(d.erro||'Falha ao carregar registros.');return d;
   }));
    if(signal?.aborted)return;
    if(entidade==='produtos'){
     const encontrados=res[0].meta.total;
     const ultima=Math.max(1,Math.ceil(encontrados/PRODUTOS_POR_PAGINA));
     if(pagina>ultima){setPagina(ultima);return;}
     setTotal(encontrados);setTemMais(res[0].meta.tem_mais);
    }
    setRegistros(res[0].registros??[]);
   let at=1;
   if(entidade==='contatos')setEmpresas(res[at++].registros??[]);
   if(ENTIDADE_CAMPO[entidade])setCampos(res[at].campos??[]);
   }catch(e){if(!signal?.aborted){
    setErro(e instanceof Error?e.message:'Falha de conexão.');
    if(entidade==='produtos'){setRegistros([]);setTemMais(false);}
   }}
   finally{if(!signal?.aborted)setCarregando(false);}
 },[entidade,pagina,buscaRemota,estado]);
  useEffect(()=>{
  const controller=new AbortController();
  setCarregando(true);
  const timer=setTimeout(()=>void carregar(controller.signal),entidade==='produtos'?250:0);
  return ()=>{clearTimeout(timer);controller.abort();};
  },[carregar,entidade]);
 useEffect(()=>{
  if(entidade==='contatos'&&!carregando&&/^#cadastro-\d+$/.test(window.location.hash))
   document.getElementById(window.location.hash.slice(1))?.scrollIntoView({block:'center'});
 },[entidade,carregando]);
 const filtrados=entidade==='produtos'?registros:registros.filter(r=>
  [r.nome,r.email??'',r.telefone??'',r.sku??'',r.cnpj??'']
   .some(v=>v.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))));
 async function importarCSV(file:File){
  setImportando(true);setErro('');setSucesso('');
  try{
   const form=new FormData();form.append('file',file);
   const r=await fetch('/api/crm/cadastros/produtos/importar',{method:'POST',body:form});
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Falha na importação.');
   setSucesso(String(d.criados)+' produto(s) criado(s), '+String(d.atualizados)+
    ' atualizado(s).'+(d.erros?.length?' '+d.erros.length+' linha(s) com erro.':''));
   if(d.erros?.length)setErro(d.erros.slice(0,8).map((x:{linha:number;erro:string})=>
    'Linha '+x.linha+': '+x.erro).join(' | '));
   await carregar();
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao importar.');}
  finally{setImportando(false);}
 }
 function mudar(chave:string,val:unknown){setForm(v=>({...v,[chave]:val}));}
 const pessoasDosNegocios = useMemo(
   () => entidade==='contatos' ? contatosDasOportunidades(oportunidadesRelacionadas) : [],
   [entidade,oportunidadesRelacionadas],
 );
 const normal = (v:string|null|undefined) => (v||'').trim().toLocaleLowerCase('pt-BR');
  const pendentes = pessoasDosNegocios.filter(p => !registros.some(r => p.cadastroId===r.id ||
   normal(r.nome)===normal(p.nome) &&
   ((p.email && normal(r.email)===normal(p.email)) ||
    (p.telefone && p.telefone.replace(/\D/g,'')===r.telefone?.replace(/\D/g,'')))));
 async function retirarProduto(registro:Registro){
  if(entidade!=='produtos'||!registro.ativo)return;
  if(!window.confirm('Retirar '+registro.nome+' do catálogo? O histórico de negócios será preservado.'))return;
  setSalvando(true);setErro('');setSucesso('');
  try{
   const response=await fetch('/api/crm/cadastros/produtos',{
    method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:registro.id})
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.erro||'Falha ao retirar produto.');
   setSucesso('Produto retirado do catálogo. Para reativar, use Editar cadastro.');
   await carregar();
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao retirar produto.');}
  finally{setSalvando(false);}
 }
 function cadastrarPessoaDoNegocio(p:{nome:string;telefone:string|null;email:string|null}) {
  setId(null);setForm({...REGISTRO_INICIAL.contatos(),nome:p.nome,
    telefone:p.telefone??'',email:p.email??''});
  setAberto(true);setSucesso('');setErro('');
  window.scrollTo({top:0,behavior:'smooth'});
 }
 
 function novo(){setId(null);setForm(REGISTRO_INICIAL[entidade]());setAberto(true);setSucesso('');setErro('');}
 function editar(r:Registro){
  setId(r.id);setForm({...REGISTRO_INICIAL[entidade](),...r,campos_extras:r.campos_extras??{}});
  setAberto(true);setErro('');setSucesso('');
 }
 async function salvar(e:React.FormEvent){
  e.preventDefault();setSalvando(true);setErro('');setSucesso('');
  try{
   const r=await fetch('/api/crm/cadastros/'+entidade,{
    method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...form,...(id?{id}:{})}),
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Erro ao salvar registro.');
   setAberto(false);setId(null);setSucesso('Registro salvo nesta workspace.');
   await carregar();
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.');}
  finally{setSalvando(false);}
 }
 return <main className="pagina pagina-larga crm-cadastros">
  <nav className="crm-cadastros-nav">
    <Link href="/crm">CRM</Link>
    <Link href="/crm/cadastros/empresas">Empresas</Link>
    <Link href="/crm/contatos">Contatos</Link>
    <Link href="/crm/cadastros/produtos">Produtos</Link>
    <Link href="/crm/campos-personalizados">Campos personalizados</Link>
  </nav>
  {entidade==='produtos'&&<label style={{display:'inline-flex',gap:8,alignItems:'center',marginBottom:12}}>
   <span>{importando?'Importando…':'Importar produtos (CSV)'}</span>
   <input type="file" accept=".csv,text/csv" disabled={importando}
    onChange={e=>{const f=e.target.files?.[0];if(f)void importarCSV(f);e.target.value='';}}/>
  </label>}
  <div className="crm-tarefas-header">
   <div><p className="label">CRM · CADASTROS</p>
    <h1>{NOMES[entidade]}</h1>
    <p className="ajuda">{entidade==='contatos'
      ? 'Cadastro único de pessoas. Negócios ainda sem vínculo podem ser revisados abaixo, sem mesclagem automática.'
      : entidade==='produtos'?'Catálogo comercial para propostas e oportunidades.'
      :'Pessoas jurídicas e organizações relacionadas às oportunidades.'}</p>
   </div>
   <button type="button" className="btn-primario" onClick={novo}>+ Novo registro</button>
  </div>
  {erro&&<p className="crm-aviso" role="alert">{erro}</p>}
  {sucesso&&<p className="ajuda" role="status">{sucesso}</p>}
  {aberto&&<form className="crm-cadastros-form" onSubmit={salvar}>
   <h2>{id?'Editar '+NOMES[entidade]:'Novo cadastro'}</h2>
   <label>Nome *<input required value={form.nome??''} maxLength={160}
     onChange={e=>mudar('nome',e.target.value)}/></label>
   {CAMPOS_COMUNS[entidade].map(c=><label key={c.key}>{c.rotulo}
     <input type={c.tipo??'text'} value={form[c.key]??''}
       onChange={e=>mudar(c.key,e.target.value)}/></label>)}
   {entidade==='contatos'&&<label>Empresa vinculada
    <select value={form.empresa_id??''}
      onChange={e=>mudar('empresa_id',e.target.value?Number(e.target.value):null)}>
     <option value="">Nenhuma empresa</option>
     {empresas.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}
    </select>
   </label>}
   {entidade==='produtos'&&<>
     <label>Preço (BRL)<input type="number" min={0} step="0.01" required
       value={form.preco??0} onChange={e=>mudar('preco',Number(e.target.value))}/></label>
     <label className="crm-checkbox"><input type="checkbox" checked={form.ativo===true}
       onChange={e=>mudar('ativo',e.target.checked)}/> Produto ativo</label>
   </>}
   {ENTIDADE_CAMPO[entidade]&&<div className="crm-cadastro-extras">
    <h3>Campos personalizados</h3>
    {campos.length?<CamposDinamicosCRM definicoes={campos}
      valores={form.campos_extras??{}} onChange={x=>mudar('campos_extras',x)}/>
      :<p className="ajuda">Nenhum campo extra configurado.</p>}
    <Link href="/crm/campos-personalizados">Configurar campos</Link>
   </div>}
   <div className="crm-cadastros-botoes">
    <button className="btn-primario" disabled={salvando}>{salvando?'Salvando…':'Salvar'}</button>
    <button type="button" onClick={()=>setAberto(false)}>Cancelar</button>
   </div>
  </form>}
  <div className="crm-cadastros-filtros">
   <input aria-label="Buscar cadastro" placeholder={'Buscar '+NOMES[entidade].toLowerCase()}
      value={busca} maxLength={160} onChange={e=>{setBusca(e.target.value);setPagina(1);}}/>
    {entidade==='produtos'&&<label>Estado do catálogo
     <select value={estado} onChange={e=>{setEstado(e.target.value as EstadoCatalogo);setPagina(1);}}>
      <option value="todos">Todos os produtos</option>
      <option value="ativos">Ativos</option>
      <option value="inativos">Retirados do catálogo</option>
     </select>
    </label>}
    <span>{carregando?'Buscando…':entidade==='produtos'?total+' resultado(s)':filtrados.length+' resultado(s) · até 250 registros'}</span>
    <button type="button" disabled={carregando} onClick={()=>void carregar()}>Atualizar</button>
  </div>
  <section className="crm-cadastros-grade">
    {carregando&&<p>Carregando…</p>}
    {!carregando&&filtrados.length===0&&<p className="ajuda">Nenhum registro encontrado.</p>}
     {!carregando&&filtrados.map(x=><article key={x.id} id={'cadastro-'+x.id} className="crm-cadastro-card">
      <strong>{x.nome}</strong>
      {entidade==='produtos'?<p>R$ {Number(x.preco??0).toLocaleString('pt-BR',{minimumFractionDigits:2})} · {x.sku||'Sem SKU'}</p>
       :<p>{x.email||x.telefone||'Sem contato informado'}</p>}
       {entidade==='contatos'&&x.empresa_id&&<p>Empresa: {empresas.find(a=>a.id===x.empresa_id)?.nome||'Empresa vinculada'}</p>}
       {entidade==='contatos'&&oportunidadesRelacionadas.filter(o=>o.contato_id===x.id).map(o=>
        <Link key={o.id} href={'/crm?oportunidade='+encodeURIComponent(String(o.id))}>Abrir negócio #{o.id} · {o.empresa||o.contato}</Link>)}
       {entidade==='produtos'&&<p>{x.ativo?'Ativo':'Retirado do catálogo'}</p>}
      <button type="button" onClick={()=>editar(x)}>Editar cadastro</button>
      {entidade==='produtos'&&x.ativo&&<button type="button" disabled={salvando}
       onClick={()=>void retirarProduto(x)}>Retirar do catálogo</button>}
    </article>)}
   </section>
   {entidade==='produtos'&&!erro&&<nav aria-label="Páginas do catálogo" className="crm-cadastros-filtros">
    <button type="button" disabled={carregando||pagina<=1} onClick={()=>setPagina(p=>p-1)}>Anterior</button>
    <span>Página {pagina} de {Math.max(1,Math.ceil(total/PRODUTOS_POR_PAGINA))}</span>
    <button type="button" disabled={carregando||!temMais} onClick={()=>setPagina(p=>p+1)}>Próxima</button>
   </nav>}
  {entidade==='contatos' && pendentes.length > 0 && <section className="crm-contatos-pendentes">
   <h2>Contatos identificados em negócios · conferir</h2>
   <p className="ajuda">São pessoas encontradas nos negócios e ainda não vinculadas com segurança
    ao cadastro acima. O Harvest não mescla nem altera identidades automaticamente.</p>
   <div className="crm-cadastros-grade">
    {pendentes.map(p=><article className="crm-cadastro-card" key={p.chave}>
      <strong>{p.nome}</strong>
      <p>{p.telefone || p.email || 'Sem telefone ou e-mail'}</p>
      <p>{p.negocios.length} negócio(s)</p>
      {p.negocios.slice(0,3).map(n=><Link key={n.id}
        href={'/crm?oportunidade='+encodeURIComponent(String(n.id))}>
          {n.empresa || 'Oportunidade'} · {n.estagio}
      </Link>)}
      <button type="button" onClick={()=>cadastrarPessoaDoNegocio(p)}>
        Cadastrar como contato (sem mesclagem automática)
      </button>
    </article>)}
   </div>
  </section>}
 </main>;
}
