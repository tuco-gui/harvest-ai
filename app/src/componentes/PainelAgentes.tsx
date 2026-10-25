'use client';

import { useEffect, useState } from 'react';
import {
  CATALOGO_AGENTES, TIPOS_AGENTE, type TipoAgente,
  validarConfiguracaoAgente,
} from '@/lib/agentes';

type AgenteTela = {
  id: number | null;
  tipo: TipoAgente;
  nome: string;
  instrucao: string;
  ativo: boolean;
  atualizado_em: string | null;
};

export default function PainelAgentes({ editavel }: { editavel: boolean }) {
  const [agentes, setAgentes] = useState<AgenteTela[]>([]);
  const [tipo, setTipo] = useState<TipoAgente>('recepcao');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [resposta, setResposta] = useState('');

  useEffect(() => {
    let ativo = true;
    fetch('/api/agentes', { cache: 'no-store' })
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro ?? 'Não foi possível carregar os agentes.');
        return j.agentes as AgenteTela[];
      })
      .then(lista => { if (ativo) setAgentes(lista); })
      .catch(e => { if (ativo) setErro(e.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const atual = agentes.find(a => a.tipo === tipo);
  function editar(patch: Partial<AgenteTela>) {
    setAgentes(lista => lista.map(a => a.tipo === tipo ? { ...a, ...patch } : a));
    setErro('');
    setAviso('');
    setResposta('');
  }

  async function salvar() {
    if (!atual) return;
    setErro(''); setAviso('');
    const falha = validarConfiguracaoAgente(atual.nome, atual.instrucao);
    if (falha) { setErro(falha); return; }
    setSalvando(true);
    try {
      const r = await fetch('/api/agentes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nome: atual.nome, instrucao: atual.instrucao, ativo: atual.ativo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? 'Não foi possível salvar.');
      setAgentes(lista => lista.map(a => a.tipo === tipo ? j.agente : a));
      setAviso('Configuração salva nesta workspace. Nenhuma mensagem foi enviada.');
    } catch (e: any) { setErro(e.message); }
    finally { setSalvando(false); }
  }

  async function testar() {
    if (!atual || !mensagem.trim()) return;
    setErro(''); setAviso(''); setResposta(''); setTestando(true);
    try {
      const r = await fetch('/api/agentes/testar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, mensagem: mensagem.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? 'Não foi possível testar.');
      setResposta(j.resposta);
      setAviso('Resposta simulada. Nenhum WhatsApp, agendamento ou ação foi executado.');
    } catch (e: any) { setErro(e.message); }
    finally { setTestando(false); }
  }

  const campo: React.CSSProperties = {
    width: '100%', background: 'var(--surface)', color: 'var(--ink)',
    border: '1px solid var(--rule-2)', borderRadius: 5, padding: '12px 14px',
    font: 'inherit', lineHeight: 1.5,
  };
  const btn: React.CSSProperties = {
    borderRadius: 5, padding: '10px 16px', border: '1px solid var(--rule-2)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  };
  const card: React.CSSProperties = {
    border: '1px solid var(--rule)', borderRadius: 7,
    background: 'var(--surface)', padding: 18,
  };

  return (
    <div className="pagina pagina-larga" style={{ maxWidth: 1120, paddingBottom: 50 }}>
      <header className="cabecalho-pagina" style={{ marginBottom: 26 }}>
        <p className="label">HARVEST AI · LABORATÓRIO</p>
        <h1>Agentes de IA</h1>
        <p className="ajuda">
          Configure e experimente cinco agentes nesta workspace. A simulação é manual:
          nenhum agente envia mensagens ou altera o CRM.
        </p>
      </header>

      {carregando && <p className="ajuda">Carregando agentes…</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {aviso && <p role="status" style={{ color: 'var(--ink-2)', marginBottom: 14 }}>{aviso}</p>}

      {!carregando && atual && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
          <section aria-label="Tipos de agentes" style={{ ...card, alignSelf: 'start' }}>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>Catálogo</h2>
            {TIPOS_AGENTE.map(t => {
              const a = agentes.find(x => x.tipo === t);
              return (
                <button key={t} onClick={() => {
                  setTipo(t); setMensagem(''); setResposta(''); setAviso(''); setErro('');
                }}
                  aria-pressed={tipo === t}
                  style={{
                    width: '100%', display: 'block', textAlign: 'left',
                    padding: '13px 12px', borderRadius: 5, marginBottom: 7,
                    border: tipo === t ? '1px solid var(--red)' : '1px solid var(--rule)',
                    background: tipo === t ? 'var(--hover)' : 'transparent', color: 'var(--ink)',
                  }}>
                  <strong style={{ display: 'block', marginBottom: 3 }}>{a?.nome ?? CATALOGO_AGENTES[t].nome}</strong>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    {CATALOGO_AGENTES[t].resumo}
                  </span>
                  <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--ink-2)' }}>
                    {a?.ativo ? 'Ativo no catálogo' : 'Inativo · apenas testes manuais'}
                  </span>
                </button>
              );
            })}
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section style={card} aria-label="Configuração">
              <h2 style={{ fontSize: 16, marginBottom: 14 }}>Configuração</h2>
              <label htmlFor="agente-nome" style={{ display: 'block', marginBottom: 6 }}>Nome do agente</label>
              <input id="agente-nome" style={campo} maxLength={80} value={atual.nome}
                disabled={!editavel} onChange={e => editar({ nome: e.target.value })}/>
              <label htmlFor="agente-instrucao" style={{ display: 'block', marginTop: 14, marginBottom: 6 }}>
                Instruções e comportamento
              </label>
              <textarea id="agente-instrucao" style={{ ...campo, minHeight: 190, resize: 'vertical' }}
                maxLength={5000} value={atual.instrucao} disabled={!editavel}
                onChange={e => editar({ instrucao: e.target.value })}/>
              <p className="ajuda" style={{ marginTop: 6 }}>As instruções são usadas somente nas simulações desta workspace.</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                <input type="checkbox" checked={atual.ativo} disabled={!editavel}
                  onChange={e => editar({ ativo: e.target.checked })}/>
                Marcar como ativo no catálogo (não inicia automação)
              </label>
              {editavel && <button style={{ ...btn, background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }}
                onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar agente'}</button>}
            </section>

            {editavel && <section style={card} aria-label="Teste manual">
              <h2 style={{ fontSize: 16, marginBottom: 6 }}>Simular conversa</h2>
              <p className="ajuda" style={{ marginBottom: 14 }}>
                Digite uma mensagem de exemplo, sem senhas nem dados pessoais de clientes.
                Usa a chave de IA configurada para a workspace.
              </p>
              <label htmlFor="agente-mensagem" style={{ display: 'block', marginBottom: 6 }}>Mensagem simulada</label>
              <textarea id="agente-mensagem" style={{ ...campo, minHeight: 90, resize: 'vertical' }}
                value={mensagem} maxLength={1000}
                placeholder="Olá! Gostaria de entender como vocês podem me ajudar."
                onChange={e => setMensagem(e.target.value)}/>
              <button style={{ ...btn, marginTop: 12 }} disabled={testando || !mensagem.trim() || !atual.id}
                onClick={testar}>{testando ? 'Consultando IA…' : 'Gerar resposta de teste'}</button>
              {!atual.id && <p className="ajuda" style={{ marginTop: 9 }}>Salve o agente antes de testar.</p>}
              {resposta && <div style={{ marginTop: 16, padding: 14, borderLeft: '3px solid var(--red)', background: 'var(--hover)', whiteSpace: 'pre-wrap' }}>
                <strong style={{ display: 'block', marginBottom: 8 }}>Resposta sugerida</strong>
                {resposta}
              </div>}
            </section>}
          </div>
        </div>
      )}
    </div>
  );
}
