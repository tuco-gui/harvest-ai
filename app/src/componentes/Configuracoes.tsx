'use client';

import { useState } from 'react';

type Props = {
  temSerpapi: boolean;
  evolutionUrl: string;
  evolutionInstancia: string;
  temEvolutionKey: boolean;
  modo: string;
  mensagens: string[];
  contexto: string;
  intervaloMin: number;
  intervaloMax: number;
};

export default function Configuracoes(p: Props) {
  const [aba, setAba] = useState<'conexoes' | 'envios'>('conexoes');

  const [serpapi, setSerpapi] = useState('');
  const [evoUrl, setEvoUrl] = useState(p.evolutionUrl);
  const [evoInst, setEvoInst] = useState(p.evolutionInstancia);
  const [evoKey, setEvoKey] = useState('');

  const [modo, setModo] = useState(p.modo);
  const [textos, setTextos] = useState(p.mensagens.join('\n---\n'));
  const [contexto, setContexto] = useState(p.contexto);
  const [min, setMin] = useState(p.intervaloMin);
  const [max, setMax] = useState(p.intervaloMax);

  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function lerMensagens(bruto: string) {
    return bruto.split(/^\s*---\s*$/m).map((m) => m.trim()).filter(Boolean);
  }

  async function salvar() {
    setAviso(null);

    const lista = lerMensagens(textos);
    if (modo !== 'ia' && !lista.length) {
      setAviso('Cadastre pelo menos uma mensagem, ou escolha "A IA escreve".');
      return;
    }
    if (min < 5 || min >= max) {
      setAviso('O intervalo mínimo precisa ser de pelo menos 5s e menor que o máximo.');
      return;
    }

    setSalvando(true);
    const r = await fetch('/api/configuracoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // campos de chave em branco significam "não mexer", não "apagar"
        serpapi_key: serpapi || undefined,
        evolution_url: evoUrl,
        evolution_instancia: evoInst,
        evolution_key: evoKey || undefined,
        modo,
        mensagens: lista,
        contexto,
        intervalo_min: min,
        intervalo_max: max,
      }),
    });
    const dados = await r.json();
    setSalvando(false);
    setAviso(r.ok ? 'Configurações salvas.' : (dados.erro ?? 'Não consegui salvar.'));
    if (r.ok) { setSerpapi(''); setEvoKey(''); }
  }

  return (
    <div className="pagina">
      <div className="modos" style={{ marginBottom: 28 }}>
        <button aria-pressed={aba === 'conexoes'} onClick={() => setAba('conexoes')}>Conexões</button>
        <button aria-pressed={aba === 'envios'} onClick={() => setAba('envios')}>Mensagens e Envios</button>
      </div>

      {aba === 'conexoes' && (
        <>
          <section className="secao">
            <h2>Busca no Google Maps</h2>
            <p className="resumo-secao">Chave da SerpAPI. Cada página de busca consome um crédito.</p>
            <div className="cartaocfg">
              <div className="grupo">
                <label className="label" htmlFor="serp">Chave da SerpAPI</label>
                <input id="serp" type="password" value={serpapi} onChange={(e) => setSerpapi(e.target.value)}
                       placeholder={p.temSerpapi ? '•••••••• já cadastrada' : 'cole a chave aqui'} />
                <p className="ajuda">
                  {p.temSerpapi
                    ? 'Já existe uma chave salva. Preencha só se quiser trocá-la.'
                    : 'Pegue em serpapi.com/manage-api-key.'}
                </p>
              </div>
            </div>
          </section>

          <section className="secao">
            <h2>WhatsApp</h2>
            <p className="resumo-secao">Evolution API. Sem ela os números aparecem como não verificados.</p>
            <div className="cartaocfg">
              <div className="grupo">
                <label className="label" htmlFor="evourl">Endereço da Evolution</label>
                <input id="evourl" value={evoUrl} onChange={(e) => setEvoUrl(e.target.value)}
                       placeholder="https://evolution.seudominio.com.br" />
              </div>
              <div className="grupo">
                <label className="label" htmlFor="evoinst">Instância</label>
                <input id="evoinst" value={evoInst} onChange={(e) => setEvoInst(e.target.value)} />
              </div>
              <div className="grupo">
                <label className="label" htmlFor="evokey">Token</label>
                <input id="evokey" type="password" value={evoKey} onChange={(e) => setEvoKey(e.target.value)}
                       placeholder={p.temEvolutionKey ? '•••••••• já cadastrado' : 'cole o token aqui'} />
              </div>
            </div>
          </section>
        </>
      )}

      {aba === 'envios' && (
        <>
          <section className="secao">
            <h2>O que será enviado</h2>
            <p className="resumo-secao">Vale para todos os leads que você selecionar no disparo.</p>
            <div className="cartaocfg">
              {[
                ['fixa', 'Mensagem fixa', 'A mesma mensagem para todo mundo.'],
                ['rodizio', 'Rodízio de mensagens', 'Alterna entre as mensagens cadastradas, uma por lead. Variar o texto reduz o risco de bloqueio.'],
                ['ia', 'A IA escreve', 'Personalizada por lead, usando os dados da busca ou da planilha.'],
              ].map(([valor, titulo, desc]) => (
                <label key={valor} style={{ display: 'flex', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                  <input type="radio" name="modo" checked={modo === valor}
                         onChange={() => setModo(valor)} style={{ marginTop: 3 }} />
                  <span>
                    <b style={{ display: 'block', fontWeight: 600 }}>{titulo}</b>
                    <span className="ajuda" style={{ marginTop: 2, display: 'block' }}>{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {modo !== 'ia' && (
            <section className="secao">
              <h2>Mensagens</h2>
              <p className="resumo-secao">Separe cada uma por uma linha com três traços.</p>
              <div className="cartaocfg">
                <div className="grupo">
                  <textarea rows={10} value={textos} onChange={(e) => setTextos(e.target.value)}
                            placeholder={'Oi! Aqui é a Ana, da Empresa X…\n---\nOlá! Sou a Ana, da Empresa X…'} />
                  <p className="ajuda">{lerMensagens(textos).length} cadastrada(s). No rodízio, use de 3 a 5.</p>
                </div>
              </div>
            </section>
          )}

          {modo === 'ia' && (
            <section className="secao">
              <h2>Contexto para a IA</h2>
              <p className="resumo-secao">O que ela precisa saber para escrever no seu lugar.</p>
              <div className="cartaocfg">
                <div className="grupo">
                  <textarea rows={8} value={contexto} onChange={(e) => setContexto(e.target.value)}
                            placeholder="Quem somos, o que vendemos, para quem, condição comercial, tom de voz, o que nunca dizer." />
                  <p className="ajuda">
                    A IA também recebe os dados do lead. Colunas extras da planilha (último pedido,
                    valor, produtos) entram aqui automaticamente e viram personalização.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="secao">
            <h2>Intervalo entre envios</h2>
            <p className="resumo-secao">
              Disparar rápido demais é o caminho mais curto para o WhatsApp bloquear o número.
            </p>
            <div className="cartaocfg">
              <div style={{ display: 'flex', gap: 16 }}>
                <div className="grupo" style={{ flex: 1 }}>
                  <label className="label" htmlFor="min">Mínimo (segundos)</label>
                  <input id="min" type="number" min={5} max={300} value={min}
                         onChange={(e) => setMin(Number(e.target.value))} />
                </div>
                <div className="grupo" style={{ flex: 1 }}>
                  <label className="label" htmlFor="max">Máximo (segundos)</label>
                  <input id="max" type="number" min={10} max={600} value={max}
                         onChange={(e) => setMax(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <button className="salvar" onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
      {aviso && <p className="aviso">{aviso}</p>}
    </div>
  );
}
