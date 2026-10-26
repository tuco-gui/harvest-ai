import {redirect} from 'next/navigation';
import {perfilAtual,supabaseAdmin} from '@/lib/supabase/server';
import {decifrarMeta} from '@/lib/crmMetaOAuth';

export default async function SelecionarPagina({searchParams}:{
 searchParams:Promise<{state?:string}>}){
 const {state}=await searchParams;
 const perfil=await perfilAtual();
 if(!perfil?.conta_id||!state||!/^[0-9a-f-]{36}$/i.test(state))redirect('/entrar');
 const admin=supabaseAdmin();
 const {data:oauth}=await admin.from('crm_meta_oauth_estados')
  .select('id,opcoes_cifradas').eq('id',state).eq('conta_id',perfil.conta_id)
  .eq('perfil_id',perfil.id).eq('estado','escolher_pagina')
  .is('consumido_em',null).gt('expira_em',new Date().toISOString()).maybeSingle();
 if(!oauth?.opcoes_cifradas)return <main className="pagina"><p>Autorização expirada ou indisponível.</p></main>;
 let paginas:Array<{id:string;nome:string}>=[];
 try{
  paginas=JSON.parse(decifrarMeta(oauth.opcoes_cifradas))
   .map((p:{id:string;nome:string})=>({id:p.id,nome:p.nome}));
 }catch{return <main className="pagina"><p>Não foi possível recuperar as páginas.</p></main>;}
 return <main className="pagina" style={{maxWidth:580,padding:24}}>
  <h1>Selecione a página para Messenger</h1>
  <p className="ajuda">Somente a página escolhida será vinculada a esta fonte e funil.
    A conexão continuará pendente até confirmar o recebimento de mensagens pelo webhook.</p>
  <form method="POST" action="/api/meta/oauth/finalizar" style={{display:'grid',gap:12}}>
   <input type="hidden" name="state" value={state}/>
   <label>Página do Facebook
    <select name="pagina_id" required style={{display:'block',width:'100%',padding:10}}>
     {paginas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
    </select>
   </label>
   <button type="submit" className="btn-primario">Vincular esta página</button>
  </form>
 </main>;
}
