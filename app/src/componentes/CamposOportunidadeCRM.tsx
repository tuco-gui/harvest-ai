'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import CamposDinamicosCRM from '@/componentes/CamposDinamicosCRM';
import type {CampoDef} from '@/lib/crmCadastros';
type Empresa={id:number;nome:string};
type Contato={id:number;nome:string;empresa_id:number|null};
type Produto={id:number;nome:string;sku:string|null;preco:number;ativo:boolean};
type Item={produto_id:number;quantidade:number;preco_unitario:number};
export default function CamposOportunidadeCRM({id}:{id:number}){
 const [campos,setCampos]=useState<CampoDef[]>([]);
 const [valores,setValores]=useState<Record<string,unknown>>({});
 const [empresas,setEmpresas]=useState<Empresa[]>([]);
 const [contatos,setContatos]=useState<Contato[]>([]);
 const [empresaId,setEmpresaId]=useState('');
 const [contatoId,setContatoId]=useState('');
 const [produtos,setProdutos]=useState<Produto[]>([]);
 const [itens,setItens]=useState<Item[]>([]);
 const [produtoId,setProdutoId]=useState('');
 const [qtd,setQtd]=useState(1);
 const [carregando,setCarregando]=useState(true);
 const [salvando,setSalvando]=useState(false);
 const [erro,setErro]=useState('');
 const [aviso,setAviso]=useState('');
 async function carregar(){
  setCarregando(true);setErro('');
  try{
   const res=await Promise.all([
    fetch('/api/crm/oportunidades/'+id+'/campos',{cache:'no-store'}),
    fetch('/api/crm/oportunidades/'+id+'/itens',{cache:'no-store'}),
   ]);
   const [a,b]=await Promise.all(res.map(async r=>{
    const d=await r.json();if(!r.ok)throw Error(d.erro||'Erro ao carregar dados.');
    return d;
   }));
   setCampos(a.campos??[]);setValores(a.valores??{});setEmpresas(a.empresas??[]);
   setContatos(a.contatos??[]);setEmpresaId(a.empresa_id?String(a.empresa_id):'');
   setContatoId(a.contato_id?String(a.contato_id):'');
   setProdutos(b.produtos??[]);setItens(b.itens??[]);
  }catch(e){setErro(e instanceof Error?e.message:'Falha de conexão.');}
  finally{setCarregando(false);}
 }
 useEffect(()=>{void carregar();},[id]);
 async function salvar(e:React.FormEvent){
  e.preventDefault();setSalvando(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/crm/oportunidades/'+id+'/campos',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({empresa_id:empresaId?Number(empresaId):null,
      contato_id:contatoId?Number(contatoId):null,campos_extras:valores}),
   });
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao salvar.');
   setAviso('Campos e vínculos do negócio atualizados.');
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.');}
  finally{setSalvando(false);}
 }
 async function adicionarProduto(){
  if(!produtoId)return;setSalvando(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/crm/oportunidades/'+id+'/itens',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({produto_id:Number(produtoId),quantidade:qtd})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao vincular produto.');
   const existentes=itens.filter(i=>i.produto_id!==d.item.produto_id);
   setItens([...existentes,d.item]);setProdutoId('');setQtd(1);
   setAviso('Produto adicionado à oportunidade (sem alterar valor original do negócio).');
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao adicionar produto.');}
  finally{setSalvando(false);}
 }
 async function removerProduto(produtoId:number){
  if(!window.confirm('Remover este produto da oportunidade?'))return;
  setSalvando(true);setErro('');
  try{
   const r=await fetch('/api/crm/oportunidades/'+id+'/itens',{method:'DELETE',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({produto_id:produtoId})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao remover.');
   setItens(a=>a.filter(i=>i.produto_id!==produtoId));setAviso('Item removido da oportunidade.');
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao remover.');}
  finally{setSalvando(false);}
 }
 return <div className="crm-oportunidade-extras">
  {carregando&&<p className="ajuda">Carregando informações comerciais…</p>}
  {erro&&<p role="alert" className="crm-aviso">{erro}</p>}
  {aviso&&<p role="status" className="ajuda">{aviso}</p>}
  {!carregando&&<>
   <form onSubmit={salvar}>
    <h3>Relacionamentos e campos</h3>
    <label>Empresa
     <select value={empresaId} onChange={e=>setEmpresaId(e.target.value)}>
      <option value="">Sem empresa cadastrada</option>
      {empresas.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}
     </select></label>
    <label>Contato
     <select value={contatoId} onChange={e=>setContatoId(e.target.value)}>
      <option value="">Sem contato cadastrado</option>
      {contatos.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}
     </select></label>
    <CamposDinamicosCRM definicoes={campos} valores={valores} onChange={setValores}/>
    <button type="submit" className="btn-primario" disabled={salvando}>Salvar dados comerciais</button>
   </form>
   <section className="crm-oportunidade-itens">
    <h3>Produtos deste negócio</h3>
    <p className="ajuda">Valores de itens são históricos. Não mudam automaticamente o valor principal do negócio.</p>
    {itens.map(i=><div key={i.produto_id}>
     <span>{produtos.find(p=>p.id===i.produto_id)?.nome||'Produto'} · {i.quantidade} ×
       R$ {Number(i.preco_unitario).toFixed(2)}</span>
     <button type="button" disabled={salvando} onClick={()=>void removerProduto(i.produto_id)}>Remover</button>
    </div>)}
    <div className="crm-oportunidade-add-produto">
      <select aria-label="Produto a adicionar" value={produtoId} onChange={e=>setProdutoId(e.target.value)}>
        <option value="">Selecionar produto</option>
        {produtos.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
      <input aria-label="Quantidade" type="number" min={0.001} step={0.001} value={qtd}
        onChange={e=>setQtd(Number(e.target.value))}/>
      <button type="button" disabled={salvando||!produtoId||qtd<=0}
        onClick={()=>void adicionarProduto()}>Adicionar</button>
    </div>
    <Link href="/crm/cadastros/produtos">Gerenciar produtos</Link>
   </section>
  </>}
 </div>;
}