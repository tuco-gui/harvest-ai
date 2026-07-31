'use client';

import { useState } from 'react';
import { PROVEDORES } from '@/lib/ia';

type Props = {
  temSerpapi: boolean;
  evolutionUrl: string;
  evolutionInstancia: string;
  temEvolutionKey: boolean;
  temIa: boolean;
  iaProvedor: string;
  modo: string;
  mensagens: string[];
  contexto: string;
  intervaloMin: number;
  intervaloMax: number;
};

export default function Configuracoes(p: Props) {
  const [aba, setAba] = useState<'conexoes' | 'mensagens' | 'tempo'>('conexoes');

  const [serpapi, setSerpapi] = useState('');
  const [evoUrl, setEvoUrl] = useState(p.evolutionUrl);
  const [evoInst, setEvoInst] = useState(p.evolutionInstancia);
  const [evoKey, setEvoKey] = useState('');
  const [iaProvedor, setIaProvedor] = useState(p.iaProvedor);
  const [iaKey, setIaKey] = useState('');

  const [modo, setModo] = useState(p.modo);
  const [textos, setTextos] = useState(p.mensagens.join('\n---\n'));
  const [contexto, setContexto] = useState(p.contexto);
  const [min, setMin] = useState(p.intervaloMin);
  const [max, setMax] = useState(p.intervaloMax);

  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [testando, setTestando] = useState<string | null>(null);
  const [testes, setTestes] = useState<Record<string, { ok: boolean; recado: string }>>({});

  async function testar(qual: string) {
    setTestando(qual);
    const r = await fetch('/api/testar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qual }),
    });
    const d = await r.json();
    setTestes((t) => ({ ...t, [qual]: { ok: r.ok, recado: r.ok ? d.recado : d.erro } }));
    setTestando(null);
  }

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
        ia_provedor: iaProvedor,
        ia_key: iaKey || undefined,
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
    if (r.ok) { setSerpapi(''); setEvoKey(''); setIaKey(''); }
  }

  return (
    <div className="pagina">
      <div className="modos" style={{ marginBottom: 28 }}>
        <button aria-pressed={aba === 'conexoes'} onClick={() => setAba('conexoes')}>Conexões</button>
        <button aria-pressed={aba === 'mensagens'} onClick={() => setAba('mensagens')}>Mensagens</button>
        <button aria-pressed={aba === 'tempo'} onClick={() => setAba('tempo')}>Tempo de envio</button>
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

          <section className="secao">
            <h2>Inteligência artificial</h2>
            <p className="resumo-secao">
              Só necessária no modo "A IA escreve". Nos outros modos pode ficar em branco. Groq e
              Gemini têm plano gratuito — bons para testar sem custo.
            </p>
            <div className="cartaocfg">
              <div className="grupo">
                <label className="label" htmlFor="ia-provedor">Provedor</label>
                <select id="ia-provedor" value={iaProvedor} onChange={(e) => setIaProvedor(e.target.value)}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  {PROVEDORES.map((prov) => (
                    <option key={prov.valor} value={prov.valor}>
                      {prov.nome}{prov.gratis ? ' — grátis' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grupo">
                <label className="label" htmlFor="ia-key">Chave da API</label>
                <input id="ia-key" type="password" value={iaKey} onChange={(e) => setIaKey(e.target.value)}
                       placeholder={p.temIa ? '•••••••• já cadastrada' : 'cole a chave aqui'} />
                <p className="ajuda">
                  Pegue em {PROVEDORES.find((prov) => prov.valor === iaProvedor)?.ondePegar}.
                </p>
              </div>
            </div>
          </section>

          <section className="secao">
            <h2>Testar as conexões</h2>
            <p className="resumo-secao">
              Nenhum destes testes envia mensagem pro WhatsApp. Testar busca e WhatsApp não gasta
              nada; testar IA gera uma mensagem de exemplo de verdade, então consome um token
              pequeno do seu provedor. Salve antes de testar.
            </p>
            <div className="cartaocfg">
              <div className="testes">
                {[
                  ['serpapi', 'Testar busca'],
                  ['whatsapp', 'Testar WhatsApp'],
                  ['ia', 'Testar IA'],
                ].map(([qual, rotulo]) => (
                  <button key={qual} type="button" className="btn-teste"
                          data-r={testes[qual]?.ok === undefined ? undefined : testes[qual].ok ? 'ok' : 'erro'}
                          disabled={testando === qual}
                          onClick={() => testar(qual)}>
                    {testando === qual ? 'Testando…' : rotulo}
                  </button>
                ))}
              </div>
              {Object.entries(testes).map(([qual, r]) => (
                <p key={qual} className="resultado-teste" style={{ marginTop: 10 }}>
                  <b>{qual === 'serpapi' ? 'Busca' : qual === 'whatsapp' ? 'WhatsApp' : 'IA'}:</b> {r.recado}
                </p>
              ))}
            </div>
          </section>
        </>
      )}

      {aba === 'mensagens' && (
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
        </>
      )}

      {aba === 'tempo' && (
        <section className="secao">
          <h2>Intervalo entre envios</h2>
          <p className="resumo-secao">
            Disparar rápido demais é o caminho mais curto para o WhatsApp bloquear o número. O
            sistema espera um tempo aleatório entre os dois valores a cada envio — o intervalo
            variável parece mais humano do que um relógio certinho.
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

            <div className="presets">
              {[
                [15, 30, 'Rápido', 'Para listas curtas e número já aquecido'],
                [30, 60, 'Moderado', 'O equilíbrio do dia a dia'],
                [60, 120, 'Seguro', 'Número novo ou lista grande'],
              ].map(([a, b, titulo, quando]) => (
                <button key={titulo as string} type="button" className="preset"
                        aria-pressed={min === a && max === b}
                        onClick={() => { setMin(a as number); setMax(b as number); }}>
                  <b>{titulo}</b>
                  <span>{a}–{b}s · {quando}</span>
                </button>
              ))}
            </div>

            <p className="ajuda" style={{ marginTop: 14 }}>
              Com {min}–{max}s, uma lista de 20 leads leva cerca de{' '}
              <b>{Math.round((20 * (min + max)) / 2 / 60)} minutos</b> para sair inteira.
            </p>
          </div>
        </section>
      )}

      <button className="salvar" onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
      {aviso && <p className="aviso">{aviso}</p>}
    </div>
  );
}
