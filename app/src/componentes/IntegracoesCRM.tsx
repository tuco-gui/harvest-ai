'use client';

import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';

type Tipo='instagram_dm'|'facebook_messenger'|'whatsapp_cloud_api'|'webchat';
type Fonte={id:string;funil_id:number;tipo:Tipo;nome:string;status:string;
 autorizado:boolean;identificador_externo:string|null;dominio:string|null;token_publico?:string;
 meta_assinatura_status?:'pendente'|'inscrita'|'falha';meta_assinatura_em?:string|null;};
type Funil={id:number;nome:string;ativo:boolean;canal_padrao_id:number|null};
type Numero={id:number;nome:string;numero:string|null;provider:string;status:string;ativo:boolean};
type Dados={fontes:Fonte[];funis:Funil[];numeros:Numero[];podeGerenciar:boolean;
 appMeta:{instagram:boolean;messenger:boolean}};
const TIPOS:{id:Tipo;nome:string;ajuda:string}[]=[
 {id:'instagram_dm',nome:'Instagram Direct',ajuda:'Mensagens privadas do Instagram profissional'},
 {id:'facebook_messenger',nome:'Facebook Messenger',ajuda:'Mensagens recebidas nas páginas que você administra'},
 {id:'whatsapp_cloud_api',nome:'WhatsApp oficial',ajuda:'Integração WhatsApp Business Platform'},
 {id:'webchat',nome:'Webchat do site',ajuda:'Conversas no site, atendidas na mesma Inbox'},
];
export default function IntegracoesCRM({onVerWhatsapp}:{onVerWhatsapp:()=>void}){
 const [dados,setDados]=useState<Dados|null>(null);
 const [tipo,setTipo]=useState<Tipo>('instagram_dm');
 const [funilId,setFunilId]=useState('');
 const [carregando,setCarregando]=useState(true);
 const [ocupado,setOcupado]=useState(false);
 const [erro,setErro]=useState('');
 const [aviso,setAviso]=useState('');
 const [copiado,setCopiado]=useState('');
 const [assinando,setAssinando]=useState<string|null>(null);
 const carregar=useCallback(async(signal?:AbortSignal)=>{
  try{
   const r=await fetch('/api/integracoes',{cache:'no-store',signal});
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Falha ao listar integrações.');
   if(!signal?.aborted){setDados(d);setErro('');}
  }catch(e){
   if(!signal?.aborted)setErro(e instanceof Error?e.message:'Falha ao consultar integrações.');
  }finally{if(!signal?.aborted)setCarregando(false);}
 },[]);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  const tipoAlvo=p.get('tipo');
  if(TIPOS.some(x=>x.id===tipoAlvo))setTipo(tipoAlvo as Tipo);
  const funilAlvo=p.get('funil_id');
  if(funilAlvo&&/^\d+$/.test(funilAlvo))setFunilId(funilAlvo);
  const ctl=new AbortController();
  void carregar(ctl.signal);
  const receber=(e:MessageEvent)=>{
   if(e.origin!==window.location.origin||e.data?.tipo!=='harvest-meta-oauth')return;
   void carregar();
   setAviso(e.data?.resultado==='ok'?
    'Autorização registrada. A conexão fica pendente até a confirmação do webhook Meta.':
    'A Meta não concluiu a autorização. Confira permissões da conta.');
  };
  window.addEventListener('message',receber);
  return()=>{ctl.abort();window.removeEventListener('message',receber);};
 },[carregar]);
 useEffect(()=>{
  if(!funilId&&dados?.funis.length)setFunilId(String(dados.funis.find(x=>x.ativo)?.id??dados.funis[0].id));
 },[dados,funilId]);
 const origem=useMemo(()=>typeof window!=='undefined'?window.location.origin:'https://harvest.figueiramarketing.com.br',[]);
 function snippet(token:string){
  return '<iframe title="Atendimento" src="'+origem+'/webchat/'+token+
   '" style="position:fixed;right:18px;bottom:18px;width:360px;max-width:calc(100vw - 28px);height:530px;max-height:85vh;border:0;border-radius:12px;z-index:99999" loading="lazy"></iframe>';
 }
 async function autorizar(fonteId:string){
  const popup=window.open('','harvest-meta-oauth','popup,width=650,height=740');
  if(!popup){setErro('Permita a janela pop-up para autorizar a Meta.');return;}
  setOcupado(true);setErro('');
  try{
   const r=await fetch('/api/meta/oauth/iniciar',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({fonte_id:fonteId})});
   const d=await r.json();
   if(!r.ok||typeof d.url!=='string')throw Error(d.erro||'Não foi possível iniciar a conexão.');
   popup.location.href=d.url;
  }catch(e){popup.close();setErro(e instanceof Error?e.message:'Falha ao conectar a conta.');}
  finally{setOcupado(false);}
 }
 async function cadastrar(){
  if(!funilId||ocupado)return;
  setOcupado(true);setErro('');setAviso('');
  try{
   const r=await fetch('/api/integracoes',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo,funil_id:Number(funilId)})});
   const d=await r.json();
   if(!r.ok||!d.fonte)throw Error(d.erro||'Não foi possível cadastrar o canal.');
   await carregar();
   if(tipo==='instagram_dm'||tipo==='facebook_messenger'){
    await autorizar(d.fonte.id);
   }else{
    setAviso('Fonte adicionada a este funil. Você pode gerenciá-la logo abaixo.');
   }
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao adicionar integração.');}
  finally{setOcupado(false);}
 }
 async function retentarAssinatura(fonteId:string){
  if(assinando)return;
  setAssinando(fonteId);setErro('');setAviso('');
  try{
   const r=await fetch('/api/integracoes/meta/assinar',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({fonte_id:fonteId})});
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Não foi possível assinar mensagens.');
   await carregar();
   setAviso('Assinatura solicitada e confirmada pela Meta. Aguarde uma mensagem de teste para validar a Inbox.');
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao assinar a Page.');}
  finally{setAssinando(null);}
 }
 const ativo=TIPOS.find(x=>x.id===tipo);
 const conexoes=dados?.fontes.filter(f=>f.tipo===tipo)??[];
 const metaOk=tipo==='instagram_dm'?dados?.appMeta.instagram:
  tipo==='facebook_messenger'?dados?.appMeta.messenger:true;
 return <section className="integracoes-crm" aria-labelledby="integracoes-titulo">
  <header>
   <h2 id="integracoes-titulo">Integrações</h2>
   <p className="ajuda">Conecte contas e números nesta workspace. Depois associe a fonte
    ao funil desejado. As credenciais do aplicativo da Figueira são únicas;
    cada cliente autoriza apenas as próprias contas.</p>
  </header>
  {carregando&&<p className="ajuda">Carregando integrações…</p>}
  <div className="integracoes-crm-layout">
   <nav className="integracoes-crm-catalogo" aria-label="Canais disponíveis">
    {TIPOS.map(t=><button type="button" key={t.id}
      className={tipo===t.id?'ativo':''} aria-pressed={tipo===t.id}
      onClick={()=>{setTipo(t.id);setErro('');setAviso('');}}>
       <strong>{t.nome}</strong><small>{t.ajuda}</small>
    </button>)}
    <button type="button" onClick={onVerWhatsapp}>
      <strong>WhatsApp WAHA / Evolution</strong><small>{dados?.numeros.length??0} número(s) cadastrado(s)</small>
    </button>
   </nav>
   <div className="integracoes-crm-detalhe">
    <h3>{ativo?.nome}</h3>
    <p className="ajuda">{ativo?.ajuda}</p>
    {erro&&<p className="crm-aviso" role="alert">{erro}</p>}
    {aviso&&<p className="ajuda" role="status">{aviso}</p>}
    {!metaOk&&['instagram_dm','facebook_messenger'].includes(tipo)&&
     <p className="crm-aviso" role="status">
      O aplicativo Meta da plataforma ainda não foi configurado com credenciais
      de OAuth de mensagens neste serviço. O cadastro é preservado, mas não é possível
      concluir a conexão até essa configuração.
     </p>}
    <div className="integracoes-crm-conectar">
     <label>Funil que receberá este canal
      <select value={funilId} onChange={e=>setFunilId(e.target.value)}>
       <option value="">Selecione um funil</option>
       {(dados?.funis??[]).filter(f=>f.ativo).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
      </select>
     </label>
     <button type="button" className="btn-primario" disabled={!dados?.podeGerenciar||!funilId||ocupado||tipo==='whatsapp_cloud_api'||(!metaOk&&['instagram_dm','facebook_messenger'].includes(tipo))}
       onClick={()=>void cadastrar()}>
       {ocupado?'Conectando…':tipo==='webchat'?'Criar webchat':
        tipo==='whatsapp_cloud_api'?'WhatsApp oficial: integração pendente':'Conectar com a Meta'}
     </button>
    </div>
    <h3>Contas e fontes desta workspace</h3>
    {!conexoes.length&&<p className="ajuda">Nenhuma conta conectada desse tipo.</p>}
    <div className="integracoes-crm-conexoes">
     {conexoes.map(c=><article key={c.id} className="integracoes-crm-conexao">
       <div><strong>{c.nome}</strong>
        <small>Funil: {dados?.funis.find(f=>f.id===c.funil_id)?.nome??'Não encontrado'}</small>
        <small>{c.status==='pronto'?'Conectado / operacional':
          c.status==='pausado'?'Pausado':c.autorizado?
          'Conta autorizada; aguardando confirmação do webhook':'Não autorizado'}</small>
        {c.identificador_externo&&<small>Conta Meta: {c.identificador_externo}</small>}
        {c.tipo==='facebook_messenger'&&c.autorizado&&
          <small>Webhook da página: {c.meta_assinatura_status==='inscrita'?
           'Inscrição confirmada':c.meta_assinatura_status==='falha'?
           'Inscrição recusada (verificar permissões)':'Inscrição ainda não confirmada'}</small>}
       </div>
       <div>
        {(c.tipo==='instagram_dm'||c.tipo==='facebook_messenger')&&dados?.podeGerenciar&&
         <button type="button" disabled={ocupado} onClick={()=>void autorizar(c.id)}>
           {c.autorizado?'Reautorizar':'Autorizar conta'}
         </button>}
        {c.tipo==='facebook_messenger'&&c.autorizado&&dados?.podeGerenciar&&
         c.status!=='pausado'&&c.meta_assinatura_status!=='inscrita'&&
         <button type="button" disabled={!!assinando||ocupado}
          onClick={()=>void retentarAssinatura(c.id)}>
           {assinando===c.id?'Inscrevendo…':'Ativar webhook Messenger'}
         </button>}
        {c.tipo==='webchat'&&c.token_publico&&
         <button type="button" onClick={async()=>{
          try{await navigator.clipboard.writeText(snippet(c.token_publico!));setCopiado(c.id);}
          catch{setErro('Não foi possível copiar o código do widget.');}
         }}>{copiado===c.id?'Código copiado':'Copiar código do site'}</button>}
        <Link href={'/funis/'+c.funil_id}>Ver no funil</Link>
       </div>
      </article>)}
    </div>
    <p className="ajuda">Instagram e Messenger exigem permissões e assinatura de mensagens
     aprovadas pela Meta. Ter acesso a várias páginas no Business Manager não as conecta
     automaticamente; selecione e autorize a conta de cada cliente.</p>
   </div>
  </div>
 </section>;
}
