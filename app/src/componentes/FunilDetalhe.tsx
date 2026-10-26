'use client';

import Link from 'next/link';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AutomacaoEstagio from './AutomacaoEstagio';
import { CANAIS_HARVEST } from '@/lib/canaisUnificados';

type Funil = { id: number; nome: string; ativo: boolean; criado_em: string; canal_padrao_id: number|null; auto_criar_negocio_inbound:boolean };
type Canal = {id:number;nome:string;numero:string|null;status:string;provider:string;padrao:boolean};
type FonteExterna = {
 id:string;funil_id:number;tipo:string;nome:string;status:'pronto'|'pausado'|'aguardando_autorizacao';
 dominio:string|null;identificador_externo:string|null;token_publico?:string;meta_autorizado?:boolean;zernio_account_id?:string|null;
};
type Estagio = {
  id: number; funil_id: number; nome: string; ordem: number;
  grupo: 'pipeline' | 'encerrado'; probabilidade: number; cor: string | null;
};

const CORES_PADRAO = [
  '#8b8b8b', '#d48a1c', '#3478c7', '#7655b8', '#b94b8a',
  '#d55c2a', '#1A7A4A', '#C4191F', '#555555', '#2196F3',
];

export default function FunilDetalhe({
 funil, estagios: estagiosIniciais, canais, autoPermitido=false,
 embutido=false, aoVoltar, aoSalvar,
}: {
 funil:Funil;estagios:Estagio[];canais:Canal[];autoPermitido?:boolean;
 embutido?:boolean;aoVoltar?:()=>void;aoSalvar?:()=>void;
}) {
  const router = useRouter();
  const [estagios, setEstagios] = useState(estagiosIniciais);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);
  // Ao salvar no editor embutido, o CRM carrega as IDs reais dos estágios
  // recém-criados; atualizar a ficha sem sobrescrever edições não salvas.
  useEffect(()=>{
    if(!sujo)setEstagios(estagiosIniciais);
  },[estagiosIniciais,sujo]);
  const [canalFunil, setCanalFunil] = useState<number|null>(funil.canal_padrao_id);
  const [canalPersistido,setCanalPersistido]=useState<number|null>(funil.canal_padrao_id);
  const [salvandoCanal,setSalvandoCanal] = useState(false);
  const [avisoCanal,setAvisoCanal] = useState('');
  const [fontesAbertas,setFontesAbertas]=useState(false);
  const [fontesExternas,setFontesExternas]=useState<FonteExterna[]>([]);
  const [carregandoFontes,setCarregandoFontes]=useState(false);
  const [salvandoFonte,setSalvandoFonte]=useState<string|null>(null);
  const [erroFontes,setErroFontes]=useState('');
  const [dominioSite,setDominioSite]=useState('');
  const [fonteCopiada,setFonteCopiada]=useState('');
  const [iniciandoOAuth,setIniciandoOAuth]=useState<string|null>(null);
  const [instagramUsuario,setInstagramUsuario]=useState('');
  async function conectarFonte(id:string,tipo:string){
    if(iniciandoOAuth)return;
    setIniciandoOAuth(id);setErroFontes('');
    try{
      const r=await fetch('/api/zernio/iniciar',{method:'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({fonte_id:id,username:tipo==='instagram_dm'?instagramUsuario.trim():undefined})});
      const d=await r.json();
      if(!r.ok||typeof d.url!=='string')throw Error(d.erro||'Falha ao conectar a conta.');
      const url=new URL(d.url);
      if(url.protocol!=='https:'||!['zernio.com','www.zernio.com','www.instagram.com','instagram.com','www.facebook.com','facebook.com'].includes(url.hostname))
       throw Error('URL de autenticação inválida.');
      window.location.assign(url.toString());
    }catch(e){setErroFontes(e instanceof Error?e.message:'Falha ao conectar.');setIniciandoOAuth(null);}
  }
  const carregarFontes=useCallback(async()=>{
    if(!autoPermitido)return;
    setCarregandoFontes(true);
    try{
      const r=await fetch('/api/funis/'+funil.id+'/fontes',{cache:'no-store'});
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Falha ao carregar fontes.');
      setFontesExternas(d.fontes??[]);setErroFontes('');
    }catch(e){setErroFontes(e instanceof Error?e.message:'Falha ao carregar fontes.');}
    finally{setCarregandoFontes(false);}
  },[funil.id,autoPermitido]);
  useEffect(()=>{void carregarFontes();},[carregarFontes]);
  useEffect(()=>{
    const receber=(evento:MessageEvent)=>{
      if(evento.origin!==window.location.origin||evento.data?.tipo!=='harvest-meta-oauth')return;
      void carregarFontes();
      if(evento.data?.resultado==='erro')
        setErroFontes('A autorização Meta não foi concluída. Confira permissões e app review.');
      else setErroFontes('');
    };
    window.addEventListener('message',receber);
    return()=>window.removeEventListener('message',receber);
  },[carregarFontes]);

  async function adicionarFonte(tipo:string){
    if(salvandoFonte)return;
    setSalvandoFonte(tipo);setErroFontes('');
    try{
      const r=await fetch('/api/funis/'+funil.id+'/fontes',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({tipo,dominio:tipo==='webchat'?dominioSite:null}),
      });
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Não foi possível adicionar a fonte.');
      await carregarFontes();
      if(tipo==='webchat')setDominioSite('');
    }catch(e){setErroFontes(e instanceof Error?e.message:'Falha ao adicionar fonte.');}
    finally{setSalvandoFonte(null);}
  }
  async function mudarFonte(id:string,status:'pausado'|'pronto'){
    if(salvandoFonte)return;
    setSalvandoFonte(id);setErroFontes('');
    try{
      const r=await fetch('/api/funis/'+funil.id+'/fontes',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id,status}),
      });
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Não foi possível alterar a fonte.');
      await carregarFontes();
    }catch(e){setErroFontes(e instanceof Error?e.message:'Falha ao salvar fonte.');}
    finally{setSalvandoFonte(null);}
  }
  function codigoWebchat(token:string):string{
    const origem=typeof window==='undefined'?'https://harvest.figueiramarketing.com.br':window.location.origin;
    const url=origem+'/webchat/'+token;
    return '<iframe title="Atendimento" src="'+url+
     '" style="position:fixed;right:18px;bottom:18px;width:360px;max-width:calc(100vw - 28px);height:530px;max-height:85vh;border:0;border-radius:12px;z-index:99999;box-shadow:0 10px 40px #0003" loading="lazy"></iframe>';
  }
  async function copiarWebchat(f:FonteExterna){
    if(!f.token_publico)return;
    try{await navigator.clipboard.writeText(codigoWebchat(f.token_publico));setFonteCopiada(f.id);}
    catch{setErroFontes('O navegador não permitiu copiar. Use a seleção manual do código.');}
  }
  const [autoCriar,setAutoCriar] = useState(funil.auto_criar_negocio_inbound);
  const [salvandoAutomacao,setSalvandoAutomacao] = useState(false);
  const [avisoAutomacao,setAvisoAutomacao] = useState('');
  async function alterarAutomacao(){
    if(!autoPermitido || salvandoAutomacao)return;
    const proximo=!autoCriar;
    if(proximo && !window.confirm(
      'Ativar criação de negócios no PRIMEIRO contato recebido pelo WhatsApp deste funil? '+
      'Não envia mensagens. Funciona apenas para canal exclusivo conectado, sem duplicar contatos.'))return;
    setSalvandoAutomacao(true);setAvisoAutomacao('');
    try{
      const r=await fetch('/api/funis/'+funil.id,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({auto_criar_negocio_inbound:proximo}),
      });
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Não foi possível alterar automação.');
      setAutoCriar(proximo);
      setAvisoAutomacao(proximo?'Automação ativada para novas conversas elegíveis.':
        'Criação automática desligada. Negócios existentes foram preservados.');
      router.refresh();
      aoSalvar?.();
    }catch(e){setAvisoAutomacao(e instanceof Error?e.message:'Falha ao salvar automação.');}
    finally{setSalvandoAutomacao(false);}
  }
  async function salvarCanalPadrao() {
    if(salvandoCanal)return;
    setSalvandoCanal(true);setAvisoCanal('');
    try {
      const resposta=await fetch('/api/funis/'+funil.id,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({canal_padrao_id:canalFunil}),
      });
      const d=await resposta.json();
      if(!resposta.ok)throw Error(d.erro||'Não consegui salvar o canal.');
      setCanalPersistido(canalFunil);
      setAvisoCanal('Canal deste funil salvo. Campanhas com seleção manual não foram alteradas.');
      router.refresh();
      aoSalvar?.();
    } catch(e) {
      setAvisoCanal(e instanceof Error?e.message:'Falha ao salvar vínculo.');
    } finally {setSalvandoCanal(false);}
  }

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<number | null>(null);
  const proximoIdLocal=useRef(-1);

  const pipeline = estagios.filter((e) => e.grupo === 'pipeline').sort((a, b) => a.ordem - b.ordem);
  const encerrados = estagios.filter((e) => e.grupo === 'encerrado').sort((a, b) => a.ordem - b.ordem);
  const ordemVisual=[...pipeline,...encerrados];

  function marcarSujo() { setSujo(true); }

  function atualizarLocal(updater: (lista: Estagio[]) => Estagio[]) {
    setEstagios((prev) => updater(prev));
    marcarSujo();
  }

  function atualizarCampo(id: number, campo: string, valor: string | number) {
    atualizarLocal((lista) => lista.map((e) => e.id === id ? { ...e, [campo]: valor } : e));
  }

  function removerEstagioLocal(id: number) {
    if (!confirm('Remover este estágio?')) return;
    atualizarLocal((lista) => lista.filter((e) => e.id !== id));
  }

  function adicionarEstagioLocal(grupo: 'pipeline' | 'encerrado') {
    const doGrupo = estagios.filter((e) => e.grupo === grupo);
    const maxOrdem = doGrupo.length > 0 ? Math.max(...doGrupo.map((e) => e.ordem)) : 0;
    const novo: Estagio = {
      id:proximoIdLocal.current--,
      funil_id: funil.id,
      nome: 'Novo estágio',
      ordem: maxOrdem + 1,
      grupo,
      probabilidade: grupo === 'pipeline' ? 10 : 0,
      cor: '#8b8b8b',
    };
    atualizarLocal((lista) => [...lista, novo]);
  }

  function duplicarEstagio(e: Estagio) {
    const doGrupo = estagios.filter((x) => x.grupo === e.grupo);
    const maxOrdem = doGrupo.length > 0 ? Math.max(...doGrupo.map((x) => x.ordem)) : 0;
    const copia: Estagio = {
      ...e,
      id:proximoIdLocal.current--,
      nome: `${e.nome} (cópia)`,
      ordem: maxOrdem + 1,
    };
    atualizarLocal((lista) => [...lista, copia]);
  }

  // --- Drag & Drop ---
  function onDragStart(e: React.DragEvent, idx: number) {
    dragNode.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }

  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragNode.current;
    if (from === null || from === idx) { setDragIdx(null); setOverIdx(null); return; }
    const origem=ordemVisual[from];
    const destino=ordemVisual[idx];
    if(!origem||!destino||origem.grupo!==destino.grupo){
      setDragIdx(null);setOverIdx(null);dragNode.current=null;return;
    }
    const mesmaLista=estagios.filter(x=>x.grupo===origem.grupo).sort((a,b)=>a.ordem-b.ordem);
    const fromLocal=mesmaLista.findIndex(x=>x.id===origem.id);
    const toLocal=mesmaLista.findIndex(x=>x.id===destino.id);
    if (fromLocal < 0 || toLocal < 0 || fromLocal === toLocal) { setDragIdx(null); setOverIdx(null); return; }

    const nova = [...mesmaLista];
    const [movido] = nova.splice(fromLocal, 1);
    nova.splice(toLocal, 0, movido);

    const reordenado = nova.map((e, i) => ({ ...e, ordem: i + 1 }));
    const idsNovos = new Set(reordenado.map((e) => e.id));

    atualizarLocal((lista) => {
      const resto = lista.filter((e) => !idsNovos.has(e.id));
      return [...resto, ...reordenado];
    });

    setDragIdx(null);
    setOverIdx(null);
  }

  function onDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
    dragNode.current = null;
  }

  // --- Persistir ---
  async function salvarTudo() {
    if(salvando)return;
    if(!estagios.length||!estagios.some(e=>e.grupo==='pipeline')){
      alert('O pipeline precisa de pelo menos uma etapa.');return;
    }
    if(estagios.some(e=>!e.nome.trim())){
      alert('Preencha o nome de todas as etapas antes de salvar.');return;
    }
    setSalvando(true);
    const requisitar=async (url:string,init:RequestInit)=>{
      const resposta=await fetch(url,init);
      const dados=await resposta.json().catch(()=>({}));
      if(!resposta.ok)throw Error(dados.erro||'A operação no funil não foi concluída.');
      return dados;
    };
    try{
      const base='/api/funis/'+funil.id+'/estagios';
      const removidos=estagiosIniciais.filter(e=>e.id>0&&!estagios.some(x=>x.id===e.id));
      // Exclusões bloqueadas pelo servidor se a etapa contém negócios.
      // São processadas antes dos demais campos para não editar parcialmente
      // o pipeline caso alguma exclusão importante não seja permitida.
      for(const e of removidos)await requisitar(base+'/'+e.id,{method:'DELETE'});
      const criados=new Map<number,number>();
      const desejados=[...estagios].sort((a,b)=>{
        const ga=a.grupo==='pipeline'?0:1, gb=b.grupo==='pipeline'?0:1;
        return ga-gb||a.ordem-b.ordem;
      });
      for(const e of desejados.filter(e=>e.id<0)){
        const d=await requisitar(base,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({nome:e.nome.trim(),cor:e.cor,probabilidade:e.probabilidade,
            grupo:e.grupo,ordem:e.ordem}),
        });
        if(!Number.isSafeInteger(d.estagio?.id)||d.estagio.id<=0)
          throw Error('O servidor não confirmou o ID da nova etapa.');
        criados.set(e.id,d.estagio.id);
      }
      // PATCH sequencial: o endpoint recalcula as ordens por grupo.
      // Promise.all causava disputas entre patches simultâneos no mesmo funil.
      for(const e of desejados){
        const id=e.id>0?e.id:criados.get(e.id);
        if(!id)throw Error('Etapa sem ID confirmado pelo servidor.');
        await requisitar(base+'/'+id,{
          method:'PATCH',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({nome:e.nome.trim(),cor:e.cor,ordem:e.ordem,
            probabilidade:e.probabilidade,grupo:e.grupo}),
        });
      }
      setSujo(false);
      router.refresh();
      aoSalvar?.();
    }catch(err){
      // Operações anteriores podem ter sido persistidas; não afirmar rollback.
      alert((err instanceof Error?err.message:'Falha ao salvar alterações.')+
        ' Confira as etapas antes de tentar novamente. Nenhuma mensagem foi enviada.');
      aoSalvar?.();
    }finally{
      setSalvando(false);
    }
  }

  function voltar() {
    if(sujo && !window.confirm('Descartar as alterações não salvas do pipeline?'))return;
    aoVoltar?.();
  }

  function cancelar() {
    setEstagios(estagiosIniciais);
    setSujo(false);
  }

  return (
    <div className={embutido?'crm-editor-funil-embutido':'pagina'} style={{ maxWidth:'none', padding: embutido?'10px 8px 36px':'24px 28px 40px' }}>
      <p className="ajuda">{embutido
   ? <button type="button" className="crm-editor-voltar" onClick={voltar}>← Voltar ao pipeline</button>
   : <Link href="/funis">← Funis</Link>}</p>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22, margin: 0 }}>
          {funil.nome}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sujo && (
            <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>Alterações não salvas</span>
          )}
          <button onClick={cancelar} disabled={!sujo || salvando}
            style={{ height: 36, padding: '0 14px', fontSize: 13, color: 'var(--ink-3)', border: '1px solid var(--rule)', borderRadius: 2, background: 'var(--surface)', cursor: sujo ? 'pointer' : 'default', opacity: sujo ? 1 : 0.4 }}>
            Cancelar
          </button>
          <button onClick={salvarTudo} disabled={!sujo || salvando}
            className="btn-primario" style={{ height: 36, padding: '0 18px', fontSize: 13 }}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      <p style={{ margin: '-16px 0 20px', color: 'var(--ink-3)', fontSize: 13 }}>
        {funil.ativo ? 'Ativo' : 'Inativo'} · {pipeline.length} estágio(s) no pipeline · {encerrados.length} encerrado(s)
      </p>

      <div className="crm-kommo-editor-grid">
        <aside className="crm-kommo-fontes">
          <h3>FONTES DE LEAD</h3>
          <p className="ajuda">Números e canais de entrada deste pipeline.</p>
          <div className="crm-kommo-fontes-lista">
            {canais.map(c=><button type="button" key={c.id}
              aria-pressed={canalFunil===c.id}
              className={'crm-kommo-fonte-linha'+(canalFunil===c.id?' selecionada':'')}
              onClick={()=>{setCanalFunil(c.id);
                setAvisoCanal('Fonte selecionada. Confirme em Salvar canal do funil.');}}> 
              <span className="crm-kommo-fonte-icone">W</span>
              <div><strong>{c.nome}</strong><small>{c.provider.toUpperCase()}
                {c.numero?' · '+c.numero:''}</small>
                <small>{c.id===canalFunil?'Selecionado neste funil · ':''}
                  {c.status==='conectado'?'Conectado':'Desconectado'}</small></div>
            </button>)}
            {!canais.length&&<p className="ajuda">Nenhum WhatsApp cadastrado nesta workspace.</p>}
            {fontesExternas.filter(f=>f.status!=='pausado').map(f=>
              <div className="crm-kommo-fonte-linha crm-fonte-ativa" key={f.id}>
                <span className="crm-kommo-fonte-icone">{f.tipo==='instagram_dm'?'IG':
                  f.tipo==='facebook_messenger'?'FB':f.tipo==='webchat'?'WEB':'API'}</span>
                <div><strong>{f.nome}</strong><small>{f.tipo==='webchat'?'Site':
                  f.tipo==='instagram_dm'?'Instagram':
                  f.tipo==='facebook_messenger'?'Messenger': 'Integração'}</small>
                  <small>{f.status==='pronto'?'Disponível':
                    'Aguardando autorização e webhook'}</small></div>
              </div>)}
          </div>
          <button className="crm-kommo-adicionar-fonte" type="button"
            onClick={()=>setFontesAbertas(true)}>+ Adicionar fonte</button>
          {/* Canal pertence à configuração lateral de fontes, não a um painel novo. */}
      <section className="secao crm-funil-canal" aria-label="Canal de WhatsApp do funil">
        <h3>Canal de WhatsApp deste funil</h3>
        <p className="ajuda">
          Use um número diferente para cada funil, reaproveitando canais já cadastrados em
          Configurações → Conexões. Campanhas podem herdar este número ou escolher outro.
          Um canal desconectado nunca é substituído silenciosamente por outro número.
        </p>
        <div className="crm-funil-canal-acoes">
          <label>Canal padrão do funil
            <select value={canalFunil??''} onChange={e=>{
              setCanalFunil(e.target.value?Number(e.target.value):null);setAvisoCanal('');
            }}>
              <option value="">Usar o padrão geral da workspace</option>
              {canais.map(c=><option key={c.id} value={c.id}>
                {c.nome} · {c.numero||'sem número'} · {c.provider.toUpperCase()} · {c.status==='conectado'?'Conectado':'Desconectado'}
              </option>)}
            </select>
          </label>
          <button type="button" className="btn-primario"
            disabled={salvandoCanal || canalFunil===canalPersistido}
            onClick={()=>void salvarCanalPadrao()}>
              {salvandoCanal?'Salvando…':'Salvar canal do funil'}
          </button>
        </div>
        {canalFunil!==null && canais.find(c=>c.id===canalFunil)?.status!=='conectado' &&
          <p className="crm-aviso" role="status">Este canal ainda não está conectado. A vinculação pode ser salva,
            mas nenhum disparo usará outro número automaticamente.</p>}
        {avisoCanal && <p role="status" className="ajuda">{avisoCanal}</p>}
        {!canais.length && <p className="ajuda">
          Nenhum canal cadastrado nesta workspace. Cadastre o canal em Configurações → Conexões,
          sem desconectar números de outras workspaces.
        </p>}
      </section>
      {autoPermitido && <section className="secao crm-funil-canal" aria-label="Criação de negócios por mensagens recebidas">
        <h3>Quando chegar uma nova conversa</h3>
        <p className="ajuda">Opcional: criar automaticamente um negócio na primeira etapa
          deste funil após a primeira mensagem de texto recebida pelo número exclusivo.
          Não responde, não dispara campanhas, não une contatos e não cria negócios
          para mensagens antigas, negativas ou de opt-out.</p>
        <p><strong>Criação automática: {autoCriar?'Ativada':'Desligada'}</strong></p>
        <button type="button" disabled={salvandoAutomacao || (!autoCriar && (
          !canalFunil || canais.find(c=>c.id===canalFunil)?.status!=='conectado'))}
          onClick={()=>void alterarAutomacao()}>
          {salvandoAutomacao?'Salvando…':autoCriar?'Desativar criação automática':'Ativar criação automática'}
        </button>
        {avisoAutomacao&&<p role="status" className="ajuda">{avisoAutomacao}</p>}
      </section>}
        </aside>
        <div className="crm-kommo-editor-estagios">
      {/* Pipeline stages — horizontal */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Pipeline
        </h3>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {pipeline.map((e, i) => (
            <div
              key={e.id}
              draggable
              onDragStart={(ev) => onDragStart(ev, i)}
              onDragOver={(ev) => onDragOver(ev, i)}
              onDrop={(ev) => onDrop(ev, i)}
              onDragEnd={onDragEnd}
              style={{
                flex: '0 0 220px',
                border: '1px solid var(--rule)',
                borderRight: 'none',
                borderTop: `3px solid ${e.cor || '#8b8b8b'}`,
                background: dragIdx === i ? 'var(--sel)' : overIdx === i ? 'rgba(0,0,0,.03)' : 'var(--surface)',
                opacity: dragIdx === i ? 0.5 : 1,
                transition: 'background .1s, opacity .1s',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Drag handle + stage name */}
              <div style={{ padding: '10px 12px 8px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                  <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                </svg>
                <input
                  value={e.nome}
                  onChange={(ev) => atualizarCampo(e.id, 'nome', ev.target.value)}
                  style={{
                    border: 'none', background: 'none', fontSize: 13, fontWeight: 700,
                    fontFamily: 'var(--display)', width: '100%', outline: 'none', padding: 0,
                  }}
                />
              </div>

              {/* Color */}
              <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: e.cor || '#8b8b8b', border: '1px solid var(--rule)', cursor: 'pointer' }} />
                  <input
                    type="color"
                    value={e.cor || '#8b8b8b'}
                    onChange={(ev) => atualizarCampo(e.id, 'cor', ev.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: 20, height: 20 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {CORES_PADRAO.slice(0, 6).map((c) => (
                    <button key={c} type="button" onClick={() => atualizarCampo(e.id, 'cor', c)}
                      style={{
                        width: 14, height: 14, borderRadius: '50%', background: c, padding: 0, border: 'none',
                        outline: e.cor === c ? '2px solid var(--ink)' : 'none', outlineOffset: 1, cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Probability */}
              <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Prob.</span>
                <input type="number" min={0} max={100} value={e.probabilidade}
                  onChange={(ev) => atualizarCampo(e.id, 'probabilidade', Number(ev.target.value))}
                  style={{ width: 48, height: 26, padding: '0 6px', fontSize: 12, border: '1px solid var(--rule)', borderRadius: 2, textAlign: 'right' }}
                />
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>%</span>
              </div>

              {/* Automations config */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--rule)', flex: 1, minHeight: 80 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 600 }}>Automações</div>
                <AutomacaoEstagio funilId={funil.id} estagio={e} estagios={estagios} />
              </div>

              {/* Actions */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--rule)', display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => duplicarEstagio(e)}
                  style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 2, background: 'var(--surface)' }}>
                  Duplicar
                </button>
                <button type="button" onClick={() => removerEstagioLocal(e.id)}
                  style={{ fontSize: 11, color: 'var(--red)', padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 2, background: 'var(--surface)' }}>
                  Excluir
                </button>
              </div>
            </div>
          ))}

          {/* Add pipeline stage */}
          <div
            style={{
              flex: '0 0 220px',
              border: '1px dashed var(--rule)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 200, cursor: 'pointer', borderRadius: 3,
            }}
            onClick={() => adicionarEstagioLocal('pipeline')}
          >
            <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>+</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Adicionar etapa</div>
            </div>
          </div>
        </div>
      </section>

      {/* Encerrados stages — horizontal */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Encerrados
        </h3>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {encerrados.map((e, i) => (
            <div
              key={e.id}
              draggable
              onDragStart={(ev) => onDragStart(ev, pipeline.length + i)}
              onDragOver={(ev) => onDragOver(ev, pipeline.length + i)}
              onDrop={(ev) => onDrop(ev, pipeline.length + i)}
              onDragEnd={onDragEnd}
              style={{
                flex: '0 0 220px',
                border: '1px solid var(--rule)',
                borderRight: 'none',
                borderTop: `3px solid ${e.cor || '#8b8b8b'}`,
                background: dragIdx === pipeline.length + i ? 'var(--sel)' : 'var(--surface)',
                opacity: dragIdx === pipeline.length + i ? 0.5 : 1,
                display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ padding: '10px 12px 8px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                  <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                </svg>
                <input value={e.nome} onChange={(ev) => atualizarCampo(e.id, 'nome', ev.target.value)}
                  style={{ border: 'none', background: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'var(--display)', width: '100%', outline: 'none', padding: 0 }} />
              </div>
              <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: e.cor || '#8b8b8b', border: '1px solid var(--rule)', cursor: 'pointer' }} />
                  <input type="color" value={e.cor || '#8b8b8b'}
                    onChange={(ev) => atualizarCampo(e.id, 'cor', ev.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: 20, height: 20 }} />
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {CORES_PADRAO.slice(0, 6).map((c) => (
                    <button key={c} type="button" onClick={() => atualizarCampo(e.id, 'cor', c)}
                      style={{ width: 14, height: 14, borderRadius: '50%', background: c, padding: 0, border: 'none', outline: e.cor === c ? '2px solid var(--ink)' : 'none', outlineOffset: 1, cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--rule)', flex: 1, minHeight: 60 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 600 }}>Automações</div>
                <AutomacaoEstagio funilId={funil.id} estagio={e} estagios={estagios} />
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--rule)', display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => duplicarEstagio(e)}
                  style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 2, background: 'var(--surface)' }}>
                  Duplicar
                </button>
                <button type="button" onClick={() => removerEstagioLocal(e.id)}
                  style={{ fontSize: 11, color: 'var(--red)', padding: '4px 8px', border: '1px solid var(--rule)', borderRadius: 2, background: 'var(--surface)' }}>
                  Excluir
                </button>
              </div>
            </div>
          ))}

          <div style={{ flex: '0 0 220px', border: '1px dashed var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, cursor: 'pointer', borderRadius: 3 }}
            onClick={() => adicionarEstagioLocal('encerrado')}>
            <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>+</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Adicionar encerramento</div>
            </div>
          </div>
        </div>
      </section>
        </div>
      </div>
      {fontesAbertas&&<div className="crm-kommo-fontes-overlay"
        onMouseDown={()=>setFontesAbertas(false)}>
        <section className="crm-kommo-fontes-dialogo" role="dialog" aria-modal="true"
          aria-labelledby="crm-fontes-titulo" onMouseDown={e=>e.stopPropagation()}>
          <header><h2 id="crm-fontes-titulo">Fontes de lead</h2>
            <button type="button" aria-label="Fechar fontes"
              onClick={()=>setFontesAbertas(false)}>×</button></header>
          <p className="ajuda">Selecione a fonte deste funil. Instagram, Messenger e WhatsApp
            oficial podem ser adicionados ao funil. Escolha a conta e conecte diretamente aqui.</p>
          {erroFontes&&<p className="crm-aviso" role="alert">{erroFontes}</p>}
          {carregandoFontes&&<p className="ajuda">Carregando fontes…</p>}
          <label className="crm-fonte-dominio">
            Domínio do site para o webchat (opcional)
            <input value={dominioSite} onChange={e=>setDominioSite(e.target.value)}
              placeholder="www.seusite.com.br" maxLength={253}/>
          </label>
          <label>Instagram desejado (opcional)<input value={instagramUsuario}
            onChange={e=>setInstagramUsuario(e.target.value)} placeholder="@perfil_profissional"/></label>
          <div className="crm-kommo-fontes-grade">
            {CANAIS_HARVEST.filter(c=>c.id!=='google_business_messages').map(c=>
              <div className="crm-kommo-fonte-tile" key={c.id}>
                <strong>{c.nome}</strong>
                <small>{c.id==='google_business_reviews'?
                  'Avaliações do Google; não é canal de chat':
                  c.id==='webchat'?'Chat incorporável ao site':
                  c.situacao==='operacional'?'Conector WhatsApp existente':
                  'Conecte a conta escolhida'}</small>
                {c.id==='whatsapp_waha'||c.id==='whatsapp_evolution'
                  ?<Link href="/configuracoes" onClick={()=>setFontesAbertas(false)}>
                    Gerenciar números</Link>
                  :c.id==='webchat'
                    ?<button type="button" disabled={!autoPermitido||!!salvandoFonte}
                      onClick={()=>void adicionarFonte(c.id)}>
                      {salvandoFonte===c.id?'Adicionando…':'Criar webchat'}</button>
                    :<button type="button" disabled={!!salvandoFonte}
                      onClick={()=>void adicionarFonte(c.id)}>
                      Adicionar fonte</button>}
              </div>)}
          </div>
          <h3 style={{marginTop:22}}>Fontes deste funil</h3>
          {!fontesExternas.length&&<p className="ajuda">Nenhuma fonte externa cadastrada.</p>}
          {fontesExternas.map(f=><div key={f.id} className="crm-fonte-registro">
            <div><strong>{f.nome}</strong>
              <small>{f.status==='pronto'?'Webhook de mensagens validado':
                f.status==='pausado'?'Pausado':
                f.meta_autorizado?'Conta autorizada. Aguardando assinatura/primeira mensagem do webhook':
                'Aguardando autorização oficial'}</small>
              {f.identificador_externo&&f.tipo!=='webchat'&&
                <small>ID da conta: {f.identificador_externo}</small>}
              {f.tipo==='webchat'&&f.status==='pronto'&&f.token_publico&&<>
                <p className="ajuda">Cole este código no HTML do seu site:</p>
                <code className="crm-fonte-snippet">{codigoWebchat(f.token_publico)}</code>
                <button type="button" onClick={()=>void copiarWebchat(f)}>
                  {fonteCopiada===f.id?'Copiado':'Copiar código'}</button>
              </>}
            </div>
            {(f.tipo==='instagram_dm'||f.tipo==='facebook_messenger')&&f.status!=='pausado'&&
              <button type="button" disabled={!!iniciandoOAuth} onClick={()=>void conectarFonte(f.id,f.tipo)}>
                {iniciandoOAuth===f.id?'Conectando…':f.identificador_externo?'Reconectar':'Conectar'}
              </button>}
            {f.status!=='pausado'&&<button type="button" disabled={!!salvandoFonte}
              onClick={()=>void mudarFonte(f.id,'pausado')}>Remover do funil</button>}
            {f.tipo==='webchat'&&<button type="button"
              disabled={!!salvandoFonte} onClick={()=>void mudarFonte(f.id,f.status==='pronto'?'pausado':'pronto')}>
              {f.status==='pronto'?'Pausar':'Reativar'}</button>}
          </div>)}
        </section>
      </div>}
    </div>
  );
}
