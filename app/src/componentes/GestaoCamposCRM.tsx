'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { ENTIDADES_CAMPOS,TIPOS_CAMPOS,type CampoDef,type EntidadeCampos,
  validarDefCampo, normalizarGrupoCampo } from '@/lib/crmCadastros';
const NOMES:Record<EntidadeCampos,string>={
 contato:'Contatos',oportunidade:'Oportunidades',empresa:'Empresas',
};
const TIPOS:Record<string,string>={
 texto:'Texto',numero:'Número',data:'Data',selecao:'Seleção',booleano:'Sim/Não',
};
export default function GestaoCamposCRM(){
 const [entidade,setEntidade]=useState<EntidadeCampos>('contato');
 const [campos,setCampos]=useState<CampoDef[]>([]);
 const [erro,setErro]=useState('');
 const [aviso,setAviso]=useState('');
 const [ocupado,setOcupado]=useState(false);
 const [form,setForm]=useState({chave:'',rotulo:'',tipo:'texto',opcoes:'',obrigatorio:false,grupo:'Principal'});
 useEffect(()=>{
  const ctl=new AbortController();
  fetch('/api/crm/campos-personalizados?entidade='+entidade,{signal:ctl.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao ler campos');return d;})
   .then(d=>{if(!ctl.signal.aborted)setCampos(d.campos??[]);})
   .catch(e=>{if(!ctl.signal.aborted)setErro(e.message)});
  return ()=>ctl.abort();
 },[entidade]);
 async function criar(e:React.FormEvent){
  e.preventDefault();
  const body={entidade,chave:form.chave,rotulo:form.rotulo,tipo:form.tipo,grupo:form.grupo,
    opcoes:form.opcoes.split(',').map(x=>x.trim()).filter(Boolean),obrigatorio:form.obrigatorio};
  if(body.tipo!=='selecao')body.opcoes=[];
  const erroValidacao=validarDefCampo(body);
  if(erroValidacao){setErro(erroValidacao);return;}
  setOcupado(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/crm/campos-personalizados',{method:'POST',
     headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Erro ao criar');
   setCampos(a=>[...a,d.campo]);setForm({chave:'',rotulo:'',tipo:'texto',opcoes:'',obrigatorio:false,grupo:'Principal'});
   setAviso('Campo criado. Registros novos podem utilizá-lo.');
  }catch(err){setErro(err instanceof Error?err.message:'Falha ao criar');}
  finally{setOcupado(false)}
 }
 async function alterar(c:CampoDef){
  if(ocupado)return;setOcupado(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/crm/campos-personalizados',{method:'PATCH',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({id:c.id,entidade:c.entidade,ativo:!c.ativo})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Erro ao alterar campo.');
   setCampos(a=>a.map(x=>x.id===c.id?d.campo:x));
   setAviso('Campo atualizado. Valores existentes não foram excluídos.');
  }catch(err){setErro(err instanceof Error?err.message:'Falha ao alterar');}
  finally{setOcupado(false)}
 }
 async function moverGrupo(c:CampoDef){
  const solicitado=window.prompt('Novo grupo para '+c.rotulo, c.grupo || 'Principal');
  if(solicitado===null)return;
  const grupo=normalizarGrupoCampo(solicitado);
  if(!grupo){setErro('Grupo deve ter entre 2 e 60 caracteres.');return;}
  if(grupo===c.grupo)return;
  setOcupado(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/crm/campos-personalizados',{method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:c.id,entidade:c.entidade,grupo})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível mudar o grupo.');
   setCampos(a=>a.map(x=>x.id===c.id?d.campo:x));
   setAviso('Campo reorganizado sem apagar os valores existentes.');
  }catch(e){setErro(e instanceof Error?e.message:'Erro na alteração.');}
  finally{setOcupado(false);}
 }
 return <main className="pagina pagina-larga crm-cadastros">
  <nav className="crm-cadastros-nav"><Link href="/crm">CRM</Link><Link href="/crm/cadastros/empresas">Empresas</Link>
   <Link href="/crm/cadastros/contatos">Contatos</Link><Link href="/crm/cadastros/produtos">Produtos</Link></nav>
  <header className="crm-tarefas-header"><div><p className="label">CRM · PERSONALIZAÇÃO</p>
   <h1>Campos personalizados</h1><p className="ajuda">Adicione campos aos contatos, oportunidades e empresas desta workspace.</p></div>
  </header>
  <label className="crm-campos-entidade">Personalizar
    <select value={entidade} onChange={e=>{setEntidade(e.target.value as EntidadeCampos);setErro('');}}>
      {ENTIDADES_CAMPOS.map(x=><option key={x} value={x}>{NOMES[x]}</option>)}
    </select>
  </label>
  {erro&&<p className="crm-aviso" role="alert">{erro}</p>}
  {aviso&&<p className="ajuda" role="status">{aviso}</p>}
  <section className="crm-cadastros-grade">
   {campos.map(c=><article key={c.id} className="crm-cadastro-card">
     <strong>{c.rotulo}</strong><p>Grupo: {c.grupo || 'Principal'} · Chave: {c.chave} · {TIPOS[c.tipo]} · {c.obrigatorio?'Obrigatório':'Opcional'}</p>
     <p>{c.ativo?'Ativo':'Inativo'}{c.opcoes.length?' · '+c.opcoes.join(', '):''}</p>
     <button type="button" disabled={ocupado} onClick={()=>void alterar(c)}>
       {c.ativo?'Desativar campo':'Reativar campo'}</button>
     <button type="button" disabled={ocupado} onClick={()=>void moverGrupo(c)}>Alterar grupo</button>
   </article>)}
   {!campos.length&&<p className="ajuda">Ainda não há campos personalizados nesta categoria.</p>}
  </section>
  <form className="crm-cadastros-form" onSubmit={criar}>
    <h2>Adicionar campo a {NOMES[entidade]}</h2>
    <label>Chave técnica * <input required placeholder="ex.: segmento_mercado"
      value={form.chave} onChange={e=>setForm(x=>({...x,chave:e.target.value.toLowerCase()}))}/></label>
    <label>Nome de exibição * <input required value={form.rotulo} maxLength={80}
      placeholder="Ex.: Segmento de mercado" onChange={e=>setForm(x=>({...x,rotulo:e.target.value}))}/></label>
    <label>Grupo / aba<input required maxLength={60} value={form.grupo}
      placeholder="Ex.: Ambiente ou Produção" onChange={e=>setForm(x=>({...x,grupo:e.target.value}))}/></label>
    <label>Tipo de campo <select value={form.tipo} onChange={e=>setForm(x=>({...x,tipo:e.target.value}))}>
      {TIPOS_CAMPOS.map(t=><option key={t} value={t}>{TIPOS[t]}</option>)}
    </select></label>
    {form.tipo==='selecao'&&<label>Opções (separadas por vírgula)
      <input value={form.opcoes} onChange={e=>setForm(x=>({...x,opcoes:e.target.value}))}
        placeholder="Varejo, Serviços, Indústria"/></label>}
    <label className="crm-checkbox"><input type="checkbox" checked={form.obrigatorio}
      onChange={e=>setForm(x=>({...x,obrigatorio:e.target.checked}))}/> Obrigatório</label>
    <div className="crm-cadastros-botoes">
      <button className="btn-primario" disabled={ocupado}>{ocupado?'Salvando…':'Criar campo'}</button>
    </div>
    <p className="ajuda">Tipos e chaves não podem ser alterados após a criação para preservar dados já preenchidos.
      Desativar um campo não apaga valores históricos.</p>
  </form>
 </main>;
}
