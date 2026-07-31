'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Lead = {
  place_id: string | null;
  empresa: string;
  telefone: string | null;
  telefone_original: string | null;
  endereco: string | null;
  especialidades: string | null;
  rating: number | null;
  reviews: number | null;
  site: string | null;
  tem_whatsapp: boolean | null;
};

type Estado = 'parado' | 'correndo' | 'pausado';

const INTERVALO_MIN = 30;
const INTERVALO_MAX = 60;

export default function Prospeccao({ podeConfigurar }: { podeConfigurar: boolean }) {
  const [termo, setTermo] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jaBuscou, setJaBuscou] = useState(false);

  const [estado, setEstado] = useState<Estado>('parado');
  const [restam, setRestam] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [recado, setRecado] = useState<string | null>(null);
  const tique = useRef<ReturnType<typeof setInterval> | null>(null);

  const chave = (l: Lead, i: number) => l.place_id ?? `${l.empresa}-${i}`;
  const selecionados = useMemo(
    () => leads.filter((l, i) => escolhidos.has(chave(l, i))),
    [leads, escolhidos],
  );
  const comZap = leads.filter((l) => l.tem_whatsapp === true).length;

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!termo.trim() || buscando) return;

    setBuscando(true);
    setErro(null);

    try {
      const r = await fetch('/api/busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termo, pagina: 1 }),
      });
      const dados = await r.json();

      if (!r.ok) {
        setErro(dados.erro ?? 'Não consegui buscar agora.');
        setLeads([]);
      } else {
        setLeads(dados.leads ?? []);
        setEscolhidos(new Set());
      }
      setJaBuscou(true);
    } catch {
      setErro('Sem conexão com o servidor.');
    } finally {
      setBuscando(false);
    }
  }

  function alternar(k: string) {
    setEscolhidos((antes) => {
      const novo = new Set(antes);
      novo.has(k) ? novo.delete(k) : novo.add(k);
      return novo;
    });
  }

  const todas = () => setEscolhidos(new Set(leads.map(chave)));
  const nenhuma = () => setEscolhidos(new Set());
  const soZap = () =>
    setEscolhidos(new Set(leads.filter((l) => l.tem_whatsapp === true).map(chave)));

  /* ------------------------------------------------------- disparo */
  function proximoIntervalo() {
    return Math.floor(Math.random() * (INTERVALO_MAX - INTERVALO_MIN + 1)) + INTERVALO_MIN;
  }

  function disparar() {
    if (!selecionados.length) return;
    setEnviados(0);
    setRestam(proximoIntervalo());
    setEstado('correndo');
    setRecado(null);
  }

  function pausar() {
    setEstado((e) => (e === 'correndo' ? 'pausado' : 'correndo'));
  }

  function parar() {
    if (!confirm('Parar o disparo? As mensagens que ainda não saíram serão canceladas.')) return;
    const restantes = selecionados.length - enviados;
    setEstado('parado');
    setRestam(0);
    setRecado(
      `Disparo interrompido. ${enviados} ${enviados === 1 ? 'mensagem saiu' : 'mensagens saíram'}, ` +
        `${restantes} ${restantes === 1 ? 'foi cancelada' : 'foram canceladas'}.`,
    );
  }

  useEffect(() => {
    if (estado !== 'correndo') return;

    tique.current = setInterval(() => {
      setRestam((s) => {
        if (s > 1) return s - 1;
        setEnviados((n) => {
          const feitos = n + 1;
          if (feitos >= selecionados.length) {
            setEstado('parado');
            setRecado(`Pronto. ${feitos} ${feitos === 1 ? 'mensagem enviada' : 'mensagens enviadas'}.`);
          }
          return feitos;
        });
        return proximoIntervalo();
      });
    }, 1000);

    return () => { if (tique.current) clearInterval(tique.current); };
  }, [estado, selecionados.length]);

  const naFila = selecionados.slice(enviados);
  const minutos = Math.max(1, Math.round((naFila.length * (INTERVALO_MIN + INTERVALO_MAX)) / 2 / 60));
  const disparando = estado !== 'parado';

  return (
    <div className="palco">
      <main className="obra">
        <form className="busca" onSubmit={buscar}>
          <label className="campo">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
              <circle cx="7.5" cy="7.5" r="5.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="joalheria em botucatu"
              aria-label="Ramo e cidade"
            />
          </label>
          <button className="btn-busca" disabled={buscando || !termo.trim()}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        <p className="dica">
          Ramo e cidade. <b>joalheria em botucatu</b>, <b>pet shop em salvador</b>. Cada página de
          busca consome um crédito.
        </p>

        {erro && <p className="erro">{erro}</p>}

        {leads.length > 0 && (
          <>
            <section className="funil" aria-label="Resultado da busca">
              <div className="etapa">
                <span className="num">{leads.length}</span>
                <span className="label">Encontradas</span>
              </div>
              <div className="etapa">
                <span className="num">{comZap}</span>
                <span className="label">Com WhatsApp</span>
              </div>
              <div className="etapa" data-fim="">
                <span className="num">{escolhidos.size}</span>
                <span className="label">Selecionadas</span>
              </div>
            </section>

            <div className="barra-lista">
              <div className="acoes">
                <button type="button" onClick={todas}>Selecionar todas</button>
                <div className="sep" />
                <button type="button" onClick={nenhuma}>Limpar seleção</button>
                <div className="sep" />
                <button type="button" onClick={soZap}>Só com WhatsApp</button>
              </div>
            </div>

            <ul className="lista" role="listbox" aria-multiselectable>
              {leads.map((l, i) => {
                const k = chave(l, i);
                const marcado = escolhidos.has(k);
                return (
                  <li
                    key={k}
                    className="linha"
                    role="option"
                    tabIndex={0}
                    aria-selected={marcado}
                    data-zap={l.tem_whatsapp === true ? 'sim' : 'nao'}
                    onClick={() => alternar(k)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternar(k); }
                    }}
                  >
                    <span className="marca-sel">
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.6L3.3 6 8 1" stroke="var(--sobre-ink)" strokeWidth="1.8" />
                      </svg>
                    </span>
                    <span className="quem">
                      <span className="nome">{l.empresa}</span>
                      <span className="onde">{l.endereco ?? 'Endereço não informado'}</span>
                    </span>
                    <span className="nota">
                      {l.rating ? (
                        <>
                          <span className="num">{l.rating.toFixed(1).replace('.', ',')}</span>
                          <span>{l.reviews ?? 0}</span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </span>
                    <span className="zap">
                      <span className="ponto" />
                      {l.telefone_original ?? 'sem telefone'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {jaBuscou && !leads.length && !erro && (
          <p className="vazio">Nenhuma empresa encontrada. Tente outro ramo ou outra cidade.</p>
        )}

        {!jaBuscou && !erro && (
          <p className="vazio">
            Busque um ramo e uma cidade para começar.
            {podeConfigurar && ' As chaves ficam em Configurações.'}
          </p>
        )}
      </main>

      {/* A cadência é o produto: as mensagens saem espaçadas de propósito,
          para não queimar o número. Por isso a fila fica sempre visível. */}
      <aside className="regua" aria-label="Fila de disparo">
        <div className="regua-topo">
          <span className="label">
            {disparando ? `Disparando ${Math.min(enviados + 1, selecionados.length)} de ${selecionados.length}` : 'Fila'}
          </span>
          {!disparando && <span className="label">{INTERVALO_MIN}–{INTERVALO_MAX}s</span>}
        </div>

        <div className="relogio">
          <span className="num">
            {disparando ? restam : naFila.length}
            <small>{disparando ? 's' : naFila.length === 1 ? ' lead' : ' leads'}</small>
          </span>
          <span className="label" style={{ display: 'block', marginTop: 8 }}>
            {estado === 'pausado' ? 'Pausado' : disparando ? 'Até a próxima sair' : 'Prontos para o disparo'}
          </span>
        </div>

        <div className="pulso">
          <i style={{ width: disparando ? `${(restam / INTERVALO_MAX) * 100}%` : '0%' }} />
        </div>

        <ul className="fila">
          {naFila.map((l, i) => (
            <li key={chave(l, i)}>
              <span className="quem-fila">{l.empresa}</span>
              <span className="quando">{i === 0 && disparando ? 'saindo' : `+${i * 45}s`}</span>
            </li>
          ))}
          {!naFila.length && <li style={{ color: 'var(--ink-3)' }}>Nada na fila</li>}
        </ul>

        <div className="resumo">
          <span className="label">Tempo da fila</span>
          <span className="num">{naFila.length ? `≈ ${minutos} min` : '—'}</span>
        </div>

        {disparando ? (
          <div className="controles">
            <button type="button" onClick={pausar}>{estado === 'pausado' ? 'Retomar' : 'Pausar'}</button>
            <button type="button" className="parar" onClick={parar}>Parar</button>
          </div>
        ) : (
          <button className="disparar" onClick={disparar} disabled={!selecionados.length}>
            {selecionados.length
              ? `Disparar ${selecionados.length} ${selecionados.length === 1 ? 'mensagem' : 'mensagens'}`
              : 'Selecione quem vai receber'}
          </button>
        )}

        <p className="nota-rodape">
          {recado ??
            (estado === 'pausado'
              ? 'Pausado. Nenhuma mensagem sai até você retomar.'
              : 'O intervalo entre envios protege o número contra bloqueio. Você pode pausar ou parar a qualquer momento.')}
        </p>
      </aside>
    </div>
  );
}
