'use client';
import {useCallback,useEffect,useState} from 'react';
import {RECURSOS,recursoLiberado,origemPermissao,aplicarConcessoes,type ContextoRecursos,type Concessao} from '@/lib/recursos';
type Estado={configurado:boolean|null;conectado:boolean|null;ativado:boolean|null;ia_autorizada:boolean|null;nota?:string};
type Dados={snapshot:ContextoRecursos&{migrada:boolean};recursos:Array<{chave:string;estado:Estado|null}>;auditoria:Array<{id:number;ator_id:string;evento:string;detalhes:Record<string,unknown>;criado_em:string}>};
const grupos=[...new Set(Object.values(RECURSOS).map(r=>r.grupo))];
export default function ServicosWorkspace({contaId}:{contaId:string}){
 const [dados,setDados]=useState<Dados|null>(null);const [mudancas,setMudancas]=useState<Record<string,Concessao>>({});
 const [motivo,setMotivo]=useState('');const [aviso,setAviso]=useState('');const [ocupado,setOcupado]=useState(false);
 const [temporario,setTemporario]=useState(false);const [horas,setHoras]=useState(2);
 const [modo,setModo]=useState('suporte');const [minutos,setMinutos]=useState(60);
 const carregar=useCallback(async(signal?:AbortSignal)=>{const r=await fetch('/api/contas/'+contaId+'/servicos',{cache:'no-store',signal});const b=await r.json();if(!r.ok)throw Error(b.erro);if(!signal?.aborted)setDados(b);},[contaId]);
 useEffect(()=>{const c=new AbortController();carregar(c.signal).catch(e=>{if(!c.signal.aborted)setAviso(e.message);});return()=>c.abort();},[carregar]);
 const snapshot=dados?aplicarConcessoes(dados.snapshot,Object.values(mudancas)):null;
 function alterar(k:string,liberado:boolean){
  const patches={...mudancas};const expira_em=temporario&&liberado?new Date(Date.now()+horas*3600_000).toISOString():null;
  const habilitar=(key:string)=>{for(const dep of RECURSOS[key].depende??[])habilitar(dep);patches[key]={recurso:key,liberado:true,expira_em};};
  const desabilitar=(key:string)=>{patches[key]={recurso:key,liberado:false,expira_em:null};for(const [filho,d]of Object.entries(RECURSOS))if(d.depende?.includes(key))desabilitar(filho);};
  if(liberado)habilitar(k);else desabilitar(k);setMudancas(patches);setAviso('');
 }
 function combinacao(tipo:string){
  const ps:Record<string,Concessao>={};for(const k of Object.keys(RECURSOS))ps[k]={recurso:k,liberado:false,expira_em:null};
  const habilitar=(key:string)=>{for(const dep of RECURSOS[key].depende??[])habilitar(dep);ps[key]={recurso:key,liberado:true,expira_em:null};};
  for(const k of ['sistema.usuarios','sistema.chamados','sistema.status'])habilitar(k);
  if(tipo.includes('prospeccao'))for(const k of ['prospeccao.base','prospeccao.pesquisas','prospeccao.enriquecimento','prospeccao.campanhas','prospeccao.importacao','prospeccao.exportacao','integracoes.serpapi','integracoes.enriquecimento'])habilitar(k);
  if(tipo.includes('crm'))for(const k of ['crm.base','crm.contatos','crm.empresas','crm.produtos','crm.oportunidades','crm.funis','crm.campos','crm.tarefas'])habilitar(k);
  if(tipo.includes('whatsapp'))for(const k of ['inbox.whatsapp','inbox.envio','inbox.transferencias','inbox.anexos','integracoes.waha'])habilitar(k);
  if(tipo.includes('instagram'))for(const k of ['inbox.instagram','inbox.envio','inbox.transferencias','inbox.anexos','integracoes.meta','integracoes.zernio'])habilitar(k);
  if(tipo.includes('messenger'))for(const k of ['inbox.facebook','inbox.envio','inbox.transferencias','inbox.anexos','integracoes.meta'])habilitar(k);
  if(tipo.includes('webchat'))for(const k of ['inbox.webchat','inbox.transferencias','inbox.anexos'])habilitar(k);
  if(tipo.includes('ia'))for(const k of ['agentes.base','agentes.atendimento','agentes.bdr','integracoes.ia','agentes.instagram'])habilitar(k);
  setTemporario(false);setMudancas(ps);setAviso('Prévia aplicada. Confira as permissões e registre o motivo antes de salvar. Nenhum canal/agente foi alterado.');
 }
 async function salvar(){if(!dados)return;setOcupado(true);setAviso('');try{
  const r=await fetch('/api/contas/'+contaId+'/servicos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao:dados.snapshot.versao,motivo,mudancas:Object.values(mudancas)})});
  const b=await r.json();if(!r.ok)throw Error(b.erro);setMudancas({});await carregar();setAviso('Serviços e auditoria salvos. Configuração, conexão e ativação operacional são etapas separadas.');
 }catch(e){setAviso(e instanceof Error?e.message:'Falha ao salvar.');}finally{setOcupado(false);}}
 async function delegar(){setOcupado(true);try{const r=await fetch('/api/acesso-delegado',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conta_id:contaId,modo,motivo,minutos})});const b=await r.json();if(!r.ok)throw Error(b.erro);window.location.assign('/configuracoes');}catch(e){setAviso(e instanceof Error?e.message:'Falha no acesso.');setOcupado(false);}}
 const status=(v:boolean|null|undefined)=>v==null?'Não verificado':v?'Sim':'Não';
 return <section className="servicos-workspace" aria-label="Serviços e Permissões">
  <h2>Serviços do cliente</h2>
  <p className="ajuda">Configure aqui quais módulos e canais o cliente terá: CRM, agentes de IA, WhatsApp, Instagram, Messenger e Webchat. Primeiro libere o serviço; depois conecte a conta em Configurações → Integrações. Nenhuma seleção ativa respostas automáticas.</p>
  {aviso&&<p role="status" className="crm-aviso">{aviso}</p>}
  {!dados||!snapshot?<p>Carregando serviços…</p>:<>
   {!dados.snapshot.migrada&&<p role="alert">Leitura em compatibilidade. A migration 055 é necessária antes de gravar alterações ou iniciar acesso delegado.</p>}
   <div className="servicos-presets"><strong>Configurações prontas para o plano do cliente</strong>{[['prospeccao','Prospecção'],['prospeccao+crm','Prospecção + CRM'],['crm+whatsapp','CRM + WhatsApp'],['crm+instagram','CRM + Instagram'],['crm+messenger','CRM + Messenger'],['crm+webchat','CRM + Webchat'],['crm+whatsapp+instagram+messenger+ia','CRM + Inbox multicanal + Agentes']].map(([k,n])=><button key={k} type="button" disabled={ocupado||!dados.snapshot.migrada} onClick={()=>combinacao(k)}>{n}</button>)}</div>
   {dados.snapshot.slug==='figueira-marketing'&&<div className="cartaocfg"><label><input type="checkbox" checked={temporario} onChange={e=>setTemporario(e.target.checked)}/> Novas liberações temporárias de homologação</label><label>Prazo em horas <input type="number" min={1} max={24} value={horas} onChange={e=>setHoras(Math.min(24,Math.max(1,Number(e.target.value))))}/></label><p className="ajuda">Expiram no backend. Permitem configurar/testar; não permitem enviar mensagens ou ativar agentes.</p></div>}
   <p className="ajuda">TikTok: conector de mensagens ainda não homologado; não pode ser ativado por este painel. O botão de resposta automática do agente continua sujeito à homologação de envio.</p>
   <p className="ajuda">Para ajustar um serviço específico, abra o grupo correspondente abaixo. As alterações só são gravadas ao clicar em Salvar e informar o motivo.</p>
   {grupos.map(grupo=><details className="servicos-grupo" key={grupo} open={grupo==='CRM'||grupo==='Inbox'||grupo==='Agentes de IA'}><summary>{grupo}</summary><div className="servicos-tabela"><table className="tabela"><thead><tr><th>Recurso contratado / liberado</th><th>Configurado</th><th>Canal conectado</th><th>Ativado</th><th>IA autorizada a responder</th></tr></thead><tbody>
    {Object.entries(RECURSOS).filter(([,r])=>r.grupo===grupo).map(([k,d])=>{const st=dados.recursos.find(r=>r.chave===k)?.estado;return <tr key={k}><td><label><input type="checkbox" checked={recursoLiberado(snapshot,k)} disabled={ocupado||!dados.snapshot.migrada} onChange={e=>alterar(k,e.target.checked)}/> {d.nome}</label><small className="ajuda" style={{display:'block'}}>{origemPermissao(snapshot,k)==='legado'?'Herdado de módulos/compatibilidade':origemPermissao(snapshot,k)==='temporario'?'Liberação temporária de teste':'Definição individual'}{d.depende?.length?' · Depende de '+d.depende.map(x=>RECURSOS[x].nome).join(', '):''}</small>{st?.nota&&<small className="ajuda">{st.nota}</small>}</td><td>{status(st?.configurado)}</td><td>{status(st?.conectado)}</td><td>{status(st?.ativado)}</td><td>{status(st?.ia_autorizada)}</td></tr>;})}
   </tbody></table></div></details>)}
   <label>Motivo administrativo <textarea value={motivo} maxLength={500} rows={2} onChange={e=>setMotivo(e.target.value)} placeholder="Descreva contrato, suporte ou homologação sem incluir credenciais."/></label>
   <button type="button" className="salvar" disabled={ocupado||!dados.snapshot.migrada||!Object.keys(mudancas).length||motivo.trim().length<10} onClick={()=>void salvar()}>{ocupado?'Salvando…':'Salvar serviços e permissões'}</button>
   <section className="cartaocfg servicos-delegacao"><h3>Acesso delegado do Super Admin</h3><p className="ajuda">Sua própria identidade, sem compartilhar credenciais do cliente. Motivo e ações registrados. Envios e ativações ficam bloqueados nesse contexto.</p>
    <label>Finalidade <select value={modo} onChange={e=>setModo(e.target.value)}><option value="suporte">Suporte</option><option value="configuracao">Configuração</option>{dados.snapshot.slug==='figueira-marketing'&&<option value="homologacao">Homologação</option>}</select></label>
    <label>Duração em minutos <input type="number" min={5} max={120} value={minutos} onChange={e=>setMinutos(Number(e.target.value))}/></label>
    <button type="button" disabled={ocupado||!dados.snapshot.migrada||motivo.trim().length<10} onClick={()=>void delegar()}>Iniciar acesso delegado</button>
   </section>
   <details className="servicos-grupo"><summary>Auditoria administrativa</summary><ol>{dados.auditoria.map(a=><li key={a.id}><strong>{a.evento}</strong> · {new Date(a.criado_em).toLocaleString('pt-BR')}<small className="ajuda" style={{display:'block'}}>Ator {a.ator_id} · {JSON.stringify(a.detalhes)}</small></li>)}</ol>{!dados.auditoria.length&&<p>Sem alterações granulares registradas.</p>}</details>
  </>}
 </section>;
}
