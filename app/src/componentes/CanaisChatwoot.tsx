'use client';

import { useState, useEffect, useCallback } from 'react';

type InboxVinculado = {
  id: number;
  chatwoot_inbox_id: number;
  tipo_canal: string;
  nome: string;
  ativo: boolean;
  whatsapp_canal_id?:number|null;
};

type InboxDisponivel = {
  id: number;
  nome: string;
  tipo: string;
};

const TIPOS_CANAL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook/Messenger',
  telegram: 'Telegram',
  sms: 'SMS',
  email: 'E-mail',
  widget: 'Chat Widget',
  api: 'API',
  line: 'LINE',
  outro: 'Outro',
};

const TIPOS_CHATWOOT: Record<string, string> = {
  'Channel::Whatsapp': 'whatsapp',
  'Channel::Facebook': 'facebook',
  'Channel::Instagram': 'instagram',
  'Channel::Telegram': 'telegram',
  'Channel::Sms': 'sms',
  'Channel::Email': 'email',
  'Channel::WebWidget': 'widget',
  'Channel::Api': 'api',
  'Channel::Line': 'line',
};

type CanalWhatsapp = {id:number;nome:string;provider:string;status:string;numero:string|null};
type Preparo = {canal_id:number;inbox_id:number|null;estado:'reservado'|'preparado'|'incerto'};
type Props = {
  chatwootAccountId: number | null;
  superAdmin?:boolean;
};

/**
 * Configuração de canais Chatwoot (P3) — suporta múltiplos inboxes.
 * Uma conta pode ter WhatsApp + Instagram + Messenger + Telegram + outros
 * simultaneamente.
 *
 * Não cria conectores próprios — usa o Chatwoot como fonte de verdade.
 * A Inbox do Harvest é uma VISÃO do Chatwoot + contexto Harvest.
 */
export default function CanaisChatwoot({ chatwootAccountId,superAdmin=false }: Props) {
  const [inboxes, setInboxes] = useState<InboxVinculado[]>([]);
  const [disponiveis, setDisponiveis] = useState<InboxDisponivel[]>([]);
  const [configurado, setConfigurado] = useState(!!chatwootAccountId);
  const [accountId, setAccountId] = useState(chatwootAccountId?.toString() ?? '');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [provisionavel,setProvisionavel]=useState(false);
  const [preparosDisponiveis,setPreparosDisponiveis]=useState(false);
  const [canaisWhatsapp,setCanaisWhatsapp]=useState<CanalWhatsapp[]>([]);
  const [preparos,setPreparos]=useState<Preparo[]>([]);
  const [urlConfiguracao,setUrlConfiguracao]=useState<string|null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch('/api/canais/chatwoot');
      const d = await r.json();
      setProvisionavel(d.provisionamento_disponivel===true);
      setPreparosDisponiveis(d.preparos_disponiveis===true);
      setCanaisWhatsapp(d.canais_whatsapp??[]);
      setPreparos(d.preparos??[]);
      setUrlConfiguracao(typeof d.url_configuracao_canais==='string'?d.url_configuracao_canais:null);
      if(!r.ok)setErro(d.erro??'Integração indisponível.');
      if (d.ok || d.configurado) {
        setConfigurado(d.configurado);
        if(d.chatwootAccountId)setAccountId(String(d.chatwootAccountId));
        setInboxes(d.inboxes ?? []);
        setDisponiveis(d.disponiveis ?? []);
      } else {
        setErro(d.erro ?? 'Erro ao carregar canais.');
      }
    } catch {
      setErro('Falha ao conectar com o servidor.');
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  async function provisionar(){
    setSalvando(true);setErro(null);setMensagem(null);
    try{
      const r=await fetch('/api/canais/chatwoot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'provisionar'})});
      const d=await r.json();if(!r.ok)throw Error(d.erro);
      setAccountId(String(d.chatwootAccountId));await carregar();setMensagem('Conta provisionada e vinculada. Conecte agora os canais autorizados. Nenhuma IA foi ativada.');
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao provisionar.');}finally{setSalvando(false);}
  }

  async function prepararWhatsapp(canalId:number){
    setSalvando(true);setErro(null);setMensagem(null);
    try{
      const r=await fetch('/api/canais/chatwoot',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({acao:'preparar_inbox_whatsapp',canalId})});
      const d=await r.json();if(!r.ok)throw Error(d.erro??'Falha ao preparar caixa.');
      await carregar();setMensagem('Caixa criada, aguardando homologação do transporte. Nenhum envio foi habilitado.');
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao preparar caixa.');}
    finally{setSalvando(false);}
  }

  async function configurarAccount() {
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    try {
      const r = await fetch('/api/canais/chatwoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'configurar', chatwootAccountId: Number(accountId) }),
      });
      const d = await r.json();
      if (r.ok) {
        setMensagem('Account ID configurado. Agora vincule os inboxes.');
        setConfigurado(true);
        await carregar();
      } else {
        setErro(d.erro ?? 'Erro ao salvar.');
      }
    } catch {
      setErro('Falha ao salvar.');
    }
    setSalvando(false);
  }

  async function vincular(inbox: InboxDisponivel) {
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    const tipoCanal = TIPOS_CHATWOOT[inbox.tipo] ?? 'outro';
    try {
      const r = await fetch('/api/canais/chatwoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'vincular',
          chatwootInboxId: inbox.id,
          tipoCanal,
          nome: inbox.nome,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setMensagem(`${inbox.nome} vinculado.`);
        await carregar();
      } else {
        setErro(d.erro ?? 'Erro ao vincular.');
      }
    } catch {
      setErro('Falha ao vincular.');
    }
    setSalvando(false);
  }

  async function desvincular(inboxId: number, nome: string) {
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    try {
      const r = await fetch('/api/canais/chatwoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'desvincular', chatwootInboxId: inboxId }),
      });
      const d = await r.json();
      if (r.ok) {
        setMensagem(`${nome} desvinculado.`);
        await carregar();
      } else {
        setErro(d.erro ?? 'Erro ao desvincular.');
      }
    } catch {
      setErro('Falha ao desvincular.');
    }
    setSalvando(false);
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
        Conta de atendimento
      </h3>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 16px' }}>
        Uma conta Chatwoot por workspace. As caixas de entrada são administradas a partir daqui; os transportes WhatsApp existentes são preservados.
      </p>

      {/* Configuração do Account ID */}
      {!configurado&&<div><button type="button" disabled={carregando||salvando||!provisionavel} onClick={()=>void provisionar()}>{salvando?'Provisionando…':'Criar conta de atendimento'}</button>
        {!provisionavel&&<p className="ajuda">Provisionamento pela API administrativa aguardando credencial Platform App e usuário técnico da Figueira. Uma licença Inbox não comprova conta provisionada.</p>}</div>}
      {!configurado && superAdmin && (
        <div style={{ marginBottom: 16 }}>
          <details><summary>Vincular conta existente (administração global)</summary>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Ex: 1"
              style={{
                flex: 1, padding: '6px 10px', fontSize: 13, border: '1px solid var(--rule)',
                borderRadius: 6, background: 'var(--surface)',
              }}
            />
            <button
              onClick={configurarAccount}
              disabled={salvando || !accountId}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 6, cursor: salvando ? 'wait' : 'pointer',
                opacity: salvando || !accountId ? 0.5 : 1,
              }}
            >
              {salvando ? 'Salvando…' : 'Conectar'}
            </button>
          </div></details>
        </div>
      )}

      {configurado && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
          Conta vinculada{superAdmin&&<> · ID <strong>{accountId || chatwootAccountId}</strong></>}
        </div>
      )}

      {carregando && (
        <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: 12 }}>
          Carregando canais…
        </div>
      )}

      {configurado&&!carregando&&<div style={{margin:'16px 0'}}>
        <h3 style={{fontSize:14}}>WhatsApp via QR Code (WAHA / Evolution)</h3>
        <p className="ajuda">Use o canal já conectado. Preparar a caixa não cria outro pareamento, não altera a rota atual e não ativa mensagens.</p>
        {!preparosDisponiveis&&<p className="ajuda">Preparação de caixas ainda indisponível. Preserve as conexões existentes.</p>}
        {preparosDisponiveis&&canaisWhatsapp.length===0&&<p className="ajuda">Conecte um número na área de transportes WhatsApp abaixo.</p>}
        {canaisWhatsapp.map(c=>{
          const p=preparos.find(x=>x.canal_id===c.id);
          const vinculada=inboxes.find(x=>x.whatsapp_canal_id===c.id);
          return <div key={c.id} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--rule)'}}>
            <div><strong>{c.nome}</strong><p className="ajuda">{c.numero??'Número pendente'} · {c.provider.toUpperCase()} · {c.status}</p>
              {vinculada?<small>Caixa vinculada · {vinculada.ativo?'ativa':'pausada'}</small>:
                p?<small>{p.estado==='preparado'?'Caixa preparada; transporte a homologar':'Preparação em revisão; não repetir'}</small>:null}</div>
            {!vinculada&&!p&&<button type="button" className="btn-teste" disabled={salvando||!preparosDisponiveis||c.status!=='conectado'} onClick={()=>void prepararWhatsapp(c.id)}>Preparar caixa</button>}
          </div>;
        })}
        <h3 style={{fontSize:14,marginTop:16}}>Canais oficiais e sociais</h3>
        <p className="ajuda">Instagram, Messenger, WhatsApp oficial e outros canais usam a autorização nativa do Chatwoot. A autorização do titular continua necessária. Não conecte a mesma identidade por dois provedores.</p>
        {urlConfiguracao&&<a href={urlConfiguracao} target="_blank" rel="noreferrer">Abrir autorização de canais no Chatwoot (admin)</a>}
        <button type="button" className="btn-teste" disabled={salvando} onClick={()=>void carregar()}>Atualizar caixas</button>
      </div>}

      {/* Inboxes vinculados */}
      {!carregando && inboxes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Canais vinculados
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {inboxes.map((i) => (
              <div
                key={i.chatwoot_inbox_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--rule)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i.ativo ? '#22c55e' : '#ef4444',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{i.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {TIPOS_CANAL[i.tipo_canal] ?? i.tipo_canal} · ID {i.chatwoot_inbox_id}
                  </div>
                </div>
                <button
                  onClick={() => desvincular(i.chatwoot_inbox_id, i.nome)}
                  disabled={salvando}
                  style={{
                    fontSize: 11, color: '#991b1b', background: 'none',
                    border: 'none', cursor: 'pointer', padding: '4px 8px',
                    textDecoration: 'underline',
                  }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inboxes disponíveis no Chatwoot (não vinculados) */}
      {!carregando && disponiveis.length > 0 && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Inboxes disponíveis no Chatwoot
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {disponiveis.map((i) => (
              <div
                key={i.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  border: '1px dashed var(--rule)',
                  background: 'transparent',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{i.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {TIPOS_CANAL[i.tipo] ?? i.tipo} · ID {i.id}
                  </div>
                </div>
                <button
                  onClick={() => vincular(i)}
                  disabled={salvando}
                  style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 8px', textDecoration: 'underline',
                  }}
                >
                  Vincular
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!carregando && configurado && inboxes.length === 0 && disponiveis.length === 0 && !erro && (
        <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: 12 }}>
          Nenhuma caixa vinculada ou disponível para vínculo. Caixas preparadas ainda precisam da homologação do transporte.
        </div>
      )}

      {mensagem && (
        <div style={{
          marginTop: 8, padding: '8px 12px', fontSize: 12, borderRadius: 6,
          background: '#e6f9e6', color: '#1a7a1a', border: '1px solid #b3e6b3',
        }}>
          {mensagem}
        </div>
      )}

      {erro && (
        <div style={{
          marginTop: 8, padding: '8px 12px', fontSize: 12, borderRadius: 6,
          background: '#fde8e8', color: '#991b1b', border: '1px solid #f5c6c6',
        }}>
          {erro}
        </div>
      )}
    </div>
  );
}
