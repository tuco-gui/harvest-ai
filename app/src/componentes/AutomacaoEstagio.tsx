'use client';

import { useState, useEffect, useCallback } from 'react';

type Automacao = {
  id: number;
  nome: string;
  ativo: boolean;
  gatilho: string;
  acao: string;
  acao_parametros: Record<string, unknown>;
  estagio_id?: number;
  motor?: 'harvest' | 'twenty' | 'chatwoot';
};

type Estagio = {
  id: number;
  nome: string;
};

const GATILHOS: Record<string, string> = {
  mensagem_recebida: 'Mensagem recebida',
  mensagem_enviada: 'Mensagem enviada',
  resposta_positiva: 'Resposta positiva',
  resposta_negativa: 'Resposta negativa',
  opt_out: 'Opt-out',
  oportunidade_entrando_estagio: 'Entrando no estágio',
  oportunidade_saindo_estagio: 'Saindo do estágio',
};

const ACOES: Record<string, string> = {
  mover_estagio: 'Mover para estágio',
  atribuir_responsavel: 'Atribuir responsável',
  atribuir_equipe: 'Atribuir equipe',
  adicionar_etiqueta: 'Adicionar etiqueta',
  registrar_atividade: 'Registrar atividade',
  notificar_usuario: 'Notificar usuário',
  iniciar_bot: 'Iniciar bot',
  encerrar_oportunidade: 'Encerrar oportunidade',
};

const MOTORES: Record<string, { label: string; color: string }> = {
  harvest: { label: 'Harvest (Legacy)', color: '#f59e0b' },
  twenty: { label: 'Twenty', color: '#3b82f6' },
  chatwoot: { label: 'Chatwoot', color: '#8b5cf6' },
};

const GATILHOS_DEFAULT = [
  'mensagem_recebida', 'mensagem_enviada', 'resposta_positiva', 'resposta_negativa', 'opt_out',
];

const ACOES_DEFAULT = [
  'mover_estagio', 'adicionar_etiqueta', 'registrar_atividade', 'encerrar_oportunidade',
];

type Props = {
  funilId: number;
  estagio: Estagio;
  estagios: Estagio[];
};

/**
 * Configuração de automações por estágio do funil.
 * Carrega, cria, edita, duplica, ativa/desativa e remove automações.
 * Mostra motor (Harvest/Twenty/Chatwoot) quando disponível.
 */
export default function AutomacaoEstagio({ funilId, estagio, estagios }: Props) {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [novoGatilho, setNovoGatilho] = useState('mensagem_recebida');
  const [novaAcao, setNovaAcao] = useState('mover_estagio');
  const [novoEstagioDestino, setNovoEstagioDestino] = useState<number>(0);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/funis/${funilId}/automacoes`);
      const d = await r.json();
      setAutomacoes(d.automacoes ?? []);
    } catch { /* ok */ }
    setCarregando(false);
  }, [funilId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function criar() {
    if (!novoNome.trim()) {
      setErro('Dê um nome à automação.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        nome: novoNome.trim(),
        gatilho: novoGatilho,
        acao: novaAcao,
        estagio_id: estagio.id,
      };
      if (novaAcao === 'mover_estagio' && novoEstagioDestino) {
        body.acao_parametros = { estagio_destino_id: novoEstagioDestino };
      }
      const r = await fetch(`/api/funis/${funilId}/automacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setCriando(false);
        setNovoNome('');
        await carregar();
      } else {
        const d = await r.json();
        setErro(d.erro ?? 'Erro ao criar.');
      }
    } catch {
      setErro('Falha ao criar.');
    }
    setSalvando(false);
  }

  async function salvarEdicao(id: number) {
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        nome: novoNome.trim(),
        gatilho: novoGatilho,
        acao: novaAcao,
      };
      if (novaAcao === 'mover_estagio' && novoEstagioDestino) {
        body.acao_parametros = { estagio_destino_id: novoEstagioDestino };
      }
      const r = await fetch(`/api/funis/${funilId}/automacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setEditando(null);
        setNovoNome('');
        await carregar();
      } else {
        const d = await r.json();
        setErro(d.erro ?? 'Erro ao salvar.');
      }
    } catch {
      setErro('Falha ao salvar.');
    }
    setSalvando(false);
  }

  async function duplicar(a: Automacao) {
    setSalvando(true);
    try {
      const body: Record<string, unknown> = {
        nome: `${a.nome} (cópia)`,
        gatilho: a.gatilho,
        acao: a.acao,
        estagio_id: a.estagio_id ?? estagio.id,
        acao_parametros: a.acao_parametros,
      };
      await fetch(`/api/funis/${funilId}/automacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await carregar();
    } catch { /* ok */ }
    setSalvando(false);
  }

  function iniciarEdicao(a: Automacao) {
    setEditando(a.id);
    setNovoNome(a.nome);
    setNovoGatilho(a.gatilho);
    setNovaAcao(a.acao);
    setNovoEstagioDestino((a.acao_parametros?.estagio_destino_id as number) ?? 0);
    setCriando(false);
  }

  async function toggleAtivo(id: number, ativoAtual: boolean) {
    setSalvando(true);
    try {
      await fetch(`/api/funis/${funilId}/automacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !ativoAtual }),
      });
      await carregar();
    } catch { /* ok */ }
    setSalvando(false);
  }

  async function excluir(id: number) {
    if (!confirm('Excluir esta automação?')) return;
    setSalvando(true);
    try {
      await fetch(`/api/funis/${funilId}/automacoes/${id}`, { method: 'DELETE' });
      await carregar();
    } catch { /* ok */ }
    setSalvando(false);
  }

  function motorBadge(a: Automacao) {
    const m = MOTORES[a.motor ?? 'harvest'];
    if (!m) return null;
    return (
      <span style={{
        fontSize: 9, padding: '1px 4px', borderRadius: 3,
        background: `${m.color}15`, color: m.color, fontWeight: 600,
        border: `1px solid ${m.color}30`,
      }}>
        {m.label}
      </span>
    );
  }

  if (carregando) {
    return (
      <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 0' }}>
        Carregando…
      </div>
    );
  }

  return (
    <div>
      {/* Lista de automações existentes */}
      {automacoes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {automacoes.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 6px', borderRadius: 4,
                background: a.ativo ? 'rgba(34,197,94,.08)' : 'rgba(0,0,0,.03)',
                border: `1px solid ${a.ativo ? 'rgba(34,197,94,.2)' : 'var(--rule)'}`,
              }}
            >
              <button
                onClick={() => toggleAtivo(a.id, a.ativo)}
                title={a.ativo ? 'Desativar' : 'Ativar'}
                style={{
                  width: 14, height: 14, borderRadius: '50%', padding: 0, border: 'none',
                  background: a.ativo ? '#22c55e' : '#ccc', cursor: 'pointer', flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  opacity: a.ativo ? 1 : 0.5,
                }}>
                  {a.nome}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', opacity: a.ativo ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {GATILHOS[a.gatilho] ?? a.gatilho} → {ACOES[a.acao] ?? a.acao}
                  {motorBadge(a)}
                </div>
              </div>
              <button
                onClick={() => iniciarEdicao(a)}
                disabled={salvando}
                style={{
                  fontSize: 10, color: 'var(--accent)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
                }}
                title="Editar"
              >
                ✎
              </button>
              <button
                onClick={() => duplicar(a)}
                disabled={salvando}
                style={{
                  fontSize: 10, color: 'var(--ink-3)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
                }}
                title="Duplicar"
              >
                ⧉
              </button>
              <button
                onClick={() => excluir(a.id)}
                disabled={salvando}
                style={{
                  fontSize: 10, color: 'var(--ink-3)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
                }}
                title="Excluir"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {automacoes.length === 0 && !criando && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          Nenhuma automação
        </div>
      )}

      {/* Criar nova / Editar */}
      {!criando && !editando && (
        <button
          onClick={() => setCriando(true)}
          style={{
            fontSize: 11, color: 'var(--accent)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4,
          }}
        >
          + Adicionar automação
        </button>
      )}

      {(criando || editando) && (
        <div style={{
          marginTop: 6, padding: 6, borderRadius: 4,
          border: '1px solid var(--rule)', background: 'var(--sunken)',
        }}>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome da automação"
            style={{
              width: '100%', padding: '4px 6px', fontSize: 11,
              border: '1px solid var(--rule)', borderRadius: 3, marginBottom: 4,
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <select
              value={novoGatilho}
              onChange={(e) => setNovoGatilho(e.target.value)}
              style={{ flex: 1, fontSize: 11, padding: '3px 4px', border: '1px solid var(--rule)', borderRadius: 3 }}
            >
              {GATILHOS_DEFAULT.map((g) => (
                <option key={g} value={g}>{GATILHOS[g]}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', alignSelf: 'center' }}>→</span>
            <select
              value={novaAcao}
              onChange={(e) => setNovaAcao(e.target.value)}
              style={{ flex: 1, fontSize: 11, padding: '3px 4px', border: '1px solid var(--rule)', borderRadius: 3 }}
            >
              {ACOES_DEFAULT.map((a) => (
                <option key={a} value={a}>{ACOES[a]}</option>
              ))}
            </select>
          </div>
          {novaAcao === 'mover_estagio' && (
            <select
              value={novoEstagioDestino}
              onChange={(e) => setNovoEstagioDestino(Number(e.target.value))}
              style={{ width: '100%', fontSize: 11, padding: '3px 4px', border: '1px solid var(--rule)', borderRadius: 3, marginBottom: 4 }}
            >
              <option value={0}>Selecionar estágio destino…</option>
              {estagios.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={editando ? () => salvarEdicao(editando) : criar}
              disabled={salvando || !novoNome.trim()}
              style={{
                flex: 1, fontSize: 11, fontWeight: 600, padding: '4px 8px',
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 3, cursor: salvando ? 'wait' : 'pointer',
                opacity: salvando || !novoNome.trim() ? 0.5 : 1,
              }}
            >
              {salvando ? '…' : editando ? 'Salvar' : 'Criar'}
            </button>
            <button
              onClick={() => { setCriando(false); setEditando(null); setErro(null); setNovoNome(''); }}
              style={{
                fontSize: 11, padding: '4px 8px',
                border: '1px solid var(--rule)', borderRadius: 3,
                background: 'var(--surface)', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
          {erro && (
            <div style={{ fontSize: 10, color: '#991b1b', marginTop: 4 }}>{erro}</div>
          )}
        </div>
      )}
    </div>
  );
}
