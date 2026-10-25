'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filtrarTimeline, type EventoTimeline } from '@/lib/crmTimeline';

type Filtro = 'todos' | 'mensagens' | 'atividades';

export default function LinhaDoTempoCrm({ oportunidadeId, telefone }: {
  oportunidadeId: number | string; telefone: string | null;
}) {
  const [eventos, setEventos] = useState<EventoTimeline[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const recarregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch(`/api/crm/oportunidades/${encodeURIComponent(String(oportunidadeId))}/timeline`, {
        cache: 'no-store', signal,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Não foi possível carregar o histórico.');
      if (!signal?.aborted) {
        setEventos(d.eventos ?? []);
        setAviso(d.aviso ?? '');
      }
    } catch (e) {
      if (!signal?.aborted) setErro(e instanceof Error ? e.message : 'Falha ao consultar o histórico.');
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, [oportunidadeId]);

  useEffect(() => {
    const ctrl = new AbortController();
    void recarregar(ctrl.signal);
    return () => ctrl.abort();
  }, [recarregar]);

  const exibidos = useMemo(() => filtrarTimeline(eventos, filtro), [eventos, filtro]);
  const msgCount = eventos.filter(e => e.origem !== 'atividade').length;
  const actCount = eventos.length - msgCount;

  function dataFmt(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <section className="crm-timeline" aria-label="Linha do tempo da oportunidade">
      <div className="crm-timeline-toolbar">
        <div className="crm-timeline-filtros" role="group" aria-label="Filtrar histórico">
          {([
            ['todos', `Tudo (${eventos.length})`],
            ['mensagens', `Mensagens (${msgCount})`],
            ['atividades', `Atividades (${actCount})`],
          ] as const).map(([id, label]) =>
            <button type="button" key={id} aria-pressed={filtro === id}
              className={filtro === id ? 'ativa' : ''}
              onClick={() => setFiltro(id)}>{label}</button>
          )}
        </div>
        <button type="button" onClick={() => void recarregar()}
          disabled={carregando}>{carregando ? 'Atualizando…' : 'Atualizar'}</button>
      </div>
      {telefone && <div className="crm-timeline-atendimento">
        <Link href={`/crm/atendimentos?telefone=${encodeURIComponent(telefone)}`}>
          Abrir na central de atendimento
        </Link>
      </div>}
      {aviso && <p className="crm-timeline-aviso">{aviso}</p>}
      {erro && <p role="alert" className="crm-aviso">{erro}</p>}
      {carregando && <p className="crm-contexto-vazio">Carregando linha do tempo…</p>}
      {!carregando && !erro && exibidos.length === 0 && (
        <div className="crm-contexto-vazio">
          <strong>Nenhum registro encontrado.</strong>
          <p>As conversas e atividades deste negócio aparecerão aqui.</p>
        </div>
      )}
      {!carregando && !erro && (
        <ol className="crm-timeline-eventos">
          {exibidos.map(e => <li key={e.id} className={`crm-timeline-evento ${e.origem}`}>
            <div className="crm-timeline-marca" aria-hidden="true"/>
            <div className="crm-timeline-cartao">
              <header>
                <strong>{e.titulo}</strong>
                <time dateTime={e.data}>{dataFmt(e.data)}</time>
              </header>
              {e.texto && <p>{e.texto}</p>}
              <footer>
                <span>{e.origem === 'entrada' ? 'Mensagem recebida' :
                  e.origem === 'saida' ? 'Mensagem enviada' : 'Registro do CRM'}</span>
                {e.autor && <span>{e.autor}</span>}
                {e.status && <span>{e.status}</span>}
                {e.vencimento && <span>Prazo: {dataFmt(e.vencimento)}</span>}
              </footer>
            </div>
          </li>)}
        </ol>
      )}
    </section>
  );
}
