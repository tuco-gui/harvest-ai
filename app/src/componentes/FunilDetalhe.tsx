'use client';

import Link from 'next/link';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AutomacaoEstagio from './AutomacaoEstagio';

type Funil = { id: number; nome: string; ativo: boolean; criado_em: string };
type Estagio = {
  id: number; funil_id: number; nome: string; ordem: number;
  grupo: 'pipeline' | 'encerrado'; probabilidade: number; cor: string | null;
};

const CORES_PADRAO = [
  '#8b8b8b', '#d48a1c', '#3478c7', '#7655b8', '#b94b8a',
  '#d55c2a', '#1A7A4A', '#C4191F', '#555555', '#2196F3',
];

export default function FunilDetalhe({ funil, estagios: estagiosIniciais }: { funil: Funil; estagios: Estagio[] }) {
  const router = useRouter();
  const [estagios, setEstagios] = useState(estagiosIniciais);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<number | null>(null);

  const pipeline = estagios.filter((e) => e.grupo === 'pipeline').sort((a, b) => a.ordem - b.ordem);
  const encerrados = estagios.filter((e) => e.grupo === 'encerrado').sort((a, b) => a.ordem - b.ordem);

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
      id: Date.now() * -1,
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
      id: Date.now() * -1,
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
    const grupo = estagios[from].grupo;
    const mesmaLista = estagios.filter((x) => x.grupo === grupo).sort((a, b) => a.ordem - b.ordem);
    const fromLocal = mesmaLista.findIndex((x) => x.id === estagios[from].id);
    const toLocal = mesmaLista.findIndex((x) => x.id === estagios[idx].id);
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
    setSalvando(true);
    try {
      const promises: Promise<Response>[] = [];
      for (const e of estagios) {
        if (e.id > 0) {
          promises.push(
            fetch(`/api/funis/${funil.id}/estagios/${e.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nome: e.nome, cor: e.cor, ordem: e.ordem, probabilidade: e.probabilidade, grupo: e.grupo }),
            })
          );
        } else {
          promises.push(
            fetch(`/api/funis/${funil.id}/estagios`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nome: e.nome, cor: e.cor, probabilidade: e.probabilidade, grupo: e.grupo }),
            })
          );
        }
      }

      const deletados = estagiosIniciais.filter((orig) => !estagios.some((e) => e.id === orig.id));
      for (const d of deletados) {
        promises.push(
          fetch(`/api/funis/${funil.id}/estagios/${d.id}`, { method: 'DELETE' })
        );
      }

      const results = await Promise.all(promises);
      const ok = results.every((r) => r.ok);
      if (ok) {
        setSujo(false);
        router.refresh();
      } else {
        alert('Alguns estágios não foram salvos.');
      }
    } catch {
      alert('Sem conexão.');
    } finally {
      setSalvando(false);
    }
  }

  function cancelar() {
    setEstagios(estagiosIniciais);
    setSujo(false);
  }

  return (
    <div className="pagina" style={{ maxWidth: 'none', padding: '24px 28px 40px' }}>
      <p className="ajuda"><Link href="/funis">← Funis</Link></p>

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
  );
}
