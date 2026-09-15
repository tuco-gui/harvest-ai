'use client';

import { useState, useEffect, useCallback } from 'react';

type InboxVinculado = {
  id: number;
  chatwoot_inbox_id: number;
  tipo_canal: string;
  nome: string;
  ativo: boolean;
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

type Props = {
  chatwootAccountId: number | null;
};

/**
 * Configuração de canais Chatwoot (P3) — suporta múltiplos inboxes.
 * Uma conta pode ter WhatsApp + Instagram + Messenger + Telegram + outros
 * simultaneamente.
 *
 * Não cria conectores próprios — usa o Chatwoot como fonte de verdade.
 * A Inbox do Harvest é uma VISÃO do Chatwoot + contexto Harvest.
 */
export default function CanaisChatwoot({ chatwootAccountId }: Props) {
  const [inboxes, setInboxes] = useState<InboxVinculado[]>([]);
  const [disponiveis, setDisponiveis] = useState<InboxDisponivel[]>([]);
  const [configurado, setConfigurado] = useState(!!chatwootAccountId);
  const [accountId, setAccountId] = useState(chatwootAccountId?.toString() ?? '');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch('/api/canais/chatwoot');
      const d = await r.json();
      if (d.ok || d.configurado) {
        setConfigurado(d.configurado);
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
        Canais Chatwoot
      </h3>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 16px' }}>
        Inboxes do Chatwoot vinculados a esta conta. Uma conta pode ter
        múltiplos canais simultaneamente (WhatsApp, Instagram, Telegram, etc).
      </p>

      {/* Configuração do Account ID */}
      {!configurado && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Chatwoot Account ID
          </label>
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
          </div>
        </div>
      )}

      {configurado && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
          Account ID: <strong>{accountId || chatwootAccountId}</strong>
        </div>
      )}

      {carregando && (
        <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: 12 }}>
          Carregando canais…
        </div>
      )}

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
          Nenhum inbox encontrado no Chatwoot. Verifique se a instância tem canais configurados.
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
