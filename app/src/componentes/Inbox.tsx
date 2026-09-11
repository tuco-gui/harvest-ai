'use client';

import { useState, useEffect, useCallback } from 'react';

type Contato = {
  telefone: string;
  nome: string | null;
  ultimaMensagem: string;
  ultimaRecebida: string;
  total: number;
  leadId: number | null;
};

type Mensagem = {
  id: string;
  direcao: 'entrada' | 'saida';
  texto: string;
  status: string;
  data: string;
  nome: string | null;
};

type Detalhe = {
  telefone: string;
  nome: string | null;
  leadId: number | null;
  oportunidade: { id: number; estagio: string } | null;
  total: number;
  timeline: Mensagem[];
};

function formatarData(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (d.toDateString() === ontem.toDateString()) {
    return 'Ontem ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarTel(tel: string) {
  const d = tel.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    const num = d.slice(4);
    if (num.length === 9) return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    if (num.length === 8) return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  return tel;
}

export default function Inbox() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch('/api/inbox');
      const d = await r.json();
      setContatos(d.contatos ?? []);
    } catch { /* ok */ }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Poll for new messages
  useEffect(() => {
    const timer = setInterval(carregar, 15000);
    return () => clearInterval(timer);
  }, [carregar]);

  useEffect(() => {
    if (!selecionado) { setDetalhe(null); return; }
    let cancelado = false;
    setCarregandoDetalhe(true);
    fetch(`/api/inbox/${encodeURIComponent(selecionado)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelado) setDetalhe(d); })
      .catch(() => { if (!cancelado) setDetalhe(null); })
      .finally(() => { if (!cancelado) setCarregandoDetalhe(false); });
    return () => { cancelado = true; };
  }, [selecionado]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', gap: 0 }}>
      {/* Contact list */}
      <div style={{
        width: 340, flexShrink: 0, borderRight: '1px solid var(--rule)',
        display: 'flex', flexDirection: 'column', background: 'var(--surface)',
      }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--rule)' }}>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 16, margin: 0 }}>
            Inbox
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>
            {contatos.length} contato(s) com mensagens recebidas
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {carregando && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Carregando…</div>
          )}
          {!carregando && contatos.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Nenhuma mensagem recebida ainda.
            </div>
          )}
          {contatos.map((c) => (
            <button
              key={c.telefone}
              onClick={() => setSelecionado(c.telefone)}
              style={{
                display: 'flex', width: '100%', textAlign: 'left', gap: 10,
                padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--rule)',
                background: selecionado === c.telefone ? 'var(--sel)' : 'transparent',
                cursor: 'pointer', transition: 'background .1s',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}>
                {(c.nome ?? c.telefone).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nome ?? formatarTel(c.telefone)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, marginLeft: 6 }}>
                    {formatarData(c.ultimaRecebida)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {c.ultimaMensagem || '[mensagem]'}
                  </span>
                  {c.total > 1 && (
                    <span style={{
                      fontSize: 10, color: '#fff', background: 'var(--accent)', borderRadius: 10,
                      padding: '1px 6px', fontWeight: 600, flexShrink: 0, marginLeft: 6,
                    }}>
                      {c.total}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--sunken)' }}>
        {!selecionado && (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
            <div style={{ textAlign: 'center' }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .3, marginBottom: 8 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Selecione uma conversa</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Mensagens recebidas via WhatsApp aparecem aqui</div>
            </div>
          </div>
        )}

        {selecionado && carregandoDetalhe && (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            Carregando conversa…
          </div>
        )}

        {selecionado && detalhe && !carregandoDetalhe && (
          <>
            {/* Header */}
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid var(--rule)', background: 'var(--surface)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700,
              }}>
                {(detalhe.nome ?? detalhe.telefone).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{detalhe.nome ?? formatarTel(detalhe.telefone)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {formatarTel(detalhe.telefone)}
                  {detalhe.oportunidade && ` · ${detalhe.oportunidade.estagio}`}
                  {detalhe.leadId && ` · Lead #${detalhe.leadId}`}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {detalhe.timeline.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: 24 }}>
                  Nenhuma mensagem nesta conversa.
                </div>
              )}
              {detalhe.timeline.map((m) => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: m.direcao === 'saida' ? 'flex-end' : 'flex-start',
                  marginBottom: 8,
                }}>
                  <div style={{
                    maxWidth: '70%', padding: '8px 12px', borderRadius: 12, fontSize: 13,
                    background: m.direcao === 'saida' ? 'var(--accent)' : 'var(--surface)',
                    color: m.direcao === 'saida' ? '#fff' : 'var(--ink)',
                    borderBottomRightRadius: m.direcao === 'saida' ? 2 : 12,
                    borderBottomLeftRadius: m.direcao === 'entrada' ? 2 : 12,
                    border: m.direcao === 'entrada' ? '1px solid var(--rule)' : 'none',
                  }}>
                    <div style={{ wordBreak: 'break-word' }}>{m.texto || '[mensagem sem conteúdo]'}</div>
                    <div style={{
                      fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right',
                    }}>
                      {formatarData(m.data)}
                      {m.direcao === 'saida' && m.status && ` · ${m.status}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
