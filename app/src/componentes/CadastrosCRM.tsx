'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { contatosDasOportunidades } from '@/lib/crmContatos';
import type { Oportunidade } from '@/lib/twenty';
import CamposDinamicosCRM from '@/componentes/CamposDinamicosCRM';
import type { CampoDef, EntidadeCadastro } from '@/lib/crmCadastros';

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
 const [form,setForm]=useState<Record<string,any>>(()=>REGISTRO_INICIAL[entidade]());
 const [aberto,setAberto]=useState(false);
 const [id,setId]=useState<number|null>(null);
 const [carregando,setCarregando]=useState(true);
 const [salvando,setSalvando]=useState(false);
 const [erro,setErro]=useState('');
 const [sucesso,setSucesso]=useState('');
 const carregar=useCallback(async()=>{
  setCarregando(true);setErro('');
  try{
   const uris=['/api/crm/cadastros/'+entidade];
   if(entidade==='contatos')uris.push('/api/crm/cadastros/empresas');
   if(ENTIDADE_CAMPO[entidade])uris.push('/api/crm/campos-personalizados?entidade='+ENTIDADE_CAMPO[entidade]);
   const res=await Promise.all(uris.map(async u=>{
    const r=await fetch(u,{cache:'no-store'});const d=await r.json();
    if(!r.ok)throw Error(d.erro||'Falha ao carregar registros.');return d;
   }));
   setRegistros(res[0].registros??[]);
   let at=1;
   if(entidade==='contatos')setEmpresas(res[at++].registros??[]);
   if(ENTIDADE_CAMPO[entidade])setCampos(res[at].campos??[]);
  }catch(e){setErro(e instanceof Error?e.message:'Falha de conexão.');}
  finally{setCarregando(false);}
 },[entidade]);
 useEffect(()=>{void carregar();},[carregar]);
 const filtrados=registros.filter(r=>
  [r.nome,r.email??'',r.telefone??'',r.sku??'',r.cnpj??'']
   .some(v=>v.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))));
 function mudar(chave:string,val:unknown){setForm(v=>({...v,[chave]:val}));}
 const pessoasDosNegocios = useMemo(
   () => entidade==='contatos' ? contatosDasOportunidades(oportunidadesRelacionadas) : [],
   [entidade,oportunidadesRelacionadas],
 );
 const normal = (v:string|null|undefined) => (v||'').trim().toLocaleLowerCase('pt-BR');
 const pendentes = pessoasDosNegocios.filter(p => !registros.some(r =>
   normal(r.nome)===normal(p.nome) &&
   ((p.email && normal(r.email)===normal(p.email)) ||
    (p.telefone && p.telefone.replace(/\D/g,'')===r.telefone?.replace(/\D/g,'')))));
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
     value={busca} onChange={e=>setBusca(e.target.value)}/>
   <span>{filtrados.length} resultado(s) · até 250 registros</span>
   <button type="button" onClick={()=>void carregar()}>Atualizar</button>
  </div>
  <section className="crm-cadastros-grade">
    {carregando&&<p>Carregando…</p>}
    {!carregando&&filtrados.length===0&&<p className="ajuda">Nenhum registro encontrado.</p>}
    {filtrados.map(x=><article key={x.id} className="crm-cadastro-card">
      <strong>{x.nome}</strong>
      {entidade==='produtos'?<p>R$ {Number(x.preco??0).toLocaleString('pt-BR',{minimumFractionDigits:2})} · {x.sku||'Sem SKU'}</p>
       :<p>{x.email||x.telefone||'Sem contato informado'}</p>}
      {entidade==='contatos'&&x.empresa_id&&<p>Empresa: {empresas.find(a=>a.id===x.empresa_id)?.nome||'Empresa vinculada'}</p>}
      <button type="button" onClick={()=>editar(x)}>Editar cadastro</button>
    </article>)}
  </section>
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
