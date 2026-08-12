'use client';

import { useState } from 'react';
import { PROVEDORES } from '@/lib/ia';

type ErroMensagem = { tipo: string; empresa: string; erro: string; quando: string };

type Props = {
  temSerpapi: boolean;
  evolutionUrl: string;
  evolutionInstancia: string;
  temEvolutionKey: boolean;
  whatsappProvider: string;
  temIa: boolean;
  iaProvedor: string;
  iaModelo: string;
  temPerplexity: boolean;
  decisorProvedor: string;
  temSerper: boolean;
  temTavily: boolean;
  linkedinProvedor: string;
  emailProvedor: string;
  temAnymail: boolean;
  temApollo: boolean;
  temSnov: boolean;
  modo: string;
  mensagens: string[];
  contexto: string;
  intervaloMin: number;
  intervaloMax: number;
  erros: ErroMensagem[];
};

export default function Configuracoes(p: Props) {
  const [aba, setAba] = useState<'conexoes' | 'mensagens' | 'tempo' | 'erros'>('conexoes');

  const [serpapi, setSerpapi] = useState('');
  const [evoUrl, setEvoUrl] = useState(p.evolutionUrl);
  const [evoInst, setEvoInst] = useState(p.evolutionInstancia);
  const [evoKey, setEvoKey] = useState('');
  const [whatsappProvider, setWhatsappProvider] = useState(p.whatsappProvider);
  const [wahaStatus, setWahaStatus] = useState<{ status: string; qr: string | null; numero: string | null } | null>(null);
  const [wahaCarregando, setWahaCarregando] = useState(false);
  const [iaProvedor, setIaProvedor] = useState(p.iaProvedor);
  const [iaKey, setIaKey] = useState('');
  const [iaModelo, setIaModelo] = useState(p.iaModelo);
  const [decisorProvedor, setDecisorProvedor] = useState(p.decisorProvedor);
  const [perplexityKey, setPerplexityKey] = useState('');
  const [serperKey, setSerperKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [linkedinProvedor, setLinkedinProvedor] = useState(p.linkedinProvedor);
  const [emailProvedor, setEmailProvedor] = useState(p.emailProvedor);
  const [anymailKey, setAnymailKey] = useState('');
  const [apolloKey, setApolloKey] = useState('');
  const [snovClientId, setSnovClientId] = useState('');
  const [snovClientSecret, setSnovClientSecret] = useState('');

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

  async function conectarWaha() {
    setWahaCarregando(true);
    let tentativas = 0;
    const MAX_TENTATIVAS = 60; // ~2min a 2s por poll — teto pra um WAHA quebrado não pollar pra sempre
    const poll = async () => {
      tentativas++;
      const r = await fetch('/api/waha/session');
      const d = await r.json();
      if (!r.ok) { setWahaCarregando(false); setWahaStatus(null); return; }
      setWahaStatus(d);
      if (d.status === 'WORKING' || d.status === 'FAILED' || d.status === 'ERRO') {
        setWahaCarregando(false);
      } else if (tentativas >= MAX_TENTATIVAS) {
        setWahaCarregando(false);
        setWahaStatus({ ...d, status: 'ERRO' });
      } else {
        setTimeout(poll, 2000);
      }
    };
    poll();
  }

  async function desconectarWaha() {
    setWahaCarregando(true);
    await fetch('/api/waha/session', { method: 'DELETE' });
    setWahaStatus(null);
    setWahaCarregando(false);
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
        whatsapp_provider: whatsappProvider,
        ia_provedor: iaProvedor,
        ia_key: iaKey || undefined,
        ia_modelo: iaModelo,
        decisor_provedor: decisorProvedor,
        perplexity_key: perplexityKey || undefined,
        serper_key: serperKey || undefined,
        tavily_key: tavilyKey || undefined,
        linkedin_provedor: linkedinProvedor,
        email_provedor: emailProvedor,
        anymail_key: anymailKey || undefined,
        apollo_key: apolloKey || undefined,
        snov_client_id: snovClientId || undefined,
        snov_client_secret: snovClientSecret || undefined,
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
    if (r.ok) {
      setSerpapi(''); setEvoKey(''); setIaKey(''); setPerplexityKey(''); setSerperKey(''); setTavilyKey('');
      setAnymailKey(''); setApolloKey(''); setSnovClientId(''); setSnovClientSecret('');
    }
  }

  return (
    <div className="pagina">
      <div className="modos" style={{ marginBottom: 28 }}>
        <button aria-pressed={aba === 'conexoes'} onClick={() => setAba('conexoes')}>Conexões</button>
        <button aria-pressed={aba === 'mensagens'} onClick={() => setAba('mensagens')}>Mensagens</button>
        <button aria-pressed={aba === 'tempo'} onClick={() => setAba('tempo')}>Tempo de envio</button>
        <button aria-pressed={aba === 'erros'} onClick={() => setAba('erros')}>
          Erros{p.erros.length > 0 ? ` (${p.erros.length})` : ''}
        </button>
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
            <p className="resumo-secao">Escolha o provedor. Sem ele os números aparecem como não verificados.</p>
            <div className="cartaocfg">
              <div className="grupo">
                <label className="label" htmlFor="wa-provedor">Provedor</label>
                <select id="wa-provedor" value={whatsappProvider}
                        onChange={(e) => { setWhatsappProvider(e.target.value); setWahaStatus(null); }}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  <option value="evolution">Evolution API — instância própria</option>
                  <option value="waha">WAHA — conecta por QR Code aqui mesmo</option>
                </select>
              </div>

              {whatsappProvider === 'evolution' ? (
                <>
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
                </>
              ) : (
                <div className="grupo">
                  {!wahaStatus && (
                    <button type="button" className="btn-teste" disabled={wahaCarregando} onClick={conectarWaha}>
                      {wahaCarregando ? 'Conectando…' : 'Conectar WhatsApp'}
                    </button>
                  )}
                  {wahaStatus?.status === 'SCAN_QR_CODE' && wahaStatus.qr && (
                    <>
                      <p className="ajuda">Escaneie no WhatsApp do celular: Aparelhos conectados → Conectar um aparelho.</p>
                      <img src={wahaStatus.qr} alt="QR Code do WhatsApp" style={{ maxWidth: 260 }} />
                    </>
                  )}
                  {wahaStatus?.status === 'WORKING' && (
                    <>
                      <p className="ajuda">Conectado{wahaStatus.numero ? ` — ${wahaStatus.numero}` : ''}.</p>
                      <button type="button" className="btn-teste" disabled={wahaCarregando} onClick={desconectarWaha}>
                        Desconectar
                      </button>
                    </>
                  )}
                  {wahaStatus && (wahaStatus.status === 'FAILED' || wahaStatus.status === 'ERRO') && (
                    <>
                      <p className="ajuda">Não consegui conectar ao WAHA. Verifique o servidor e tente de novo.</p>
                      <button type="button" className="btn-teste" disabled={wahaCarregando} onClick={conectarWaha}>
                        Tentar de novo
                      </button>
                    </>
                  )}
                  {wahaStatus && wahaStatus.status !== 'SCAN_QR_CODE' && wahaStatus.status !== 'WORKING'
                    && wahaStatus.status !== 'FAILED' && wahaStatus.status !== 'ERRO' && (
                    <p className="ajuda">Status: {wahaStatus.status}. Aguarde…</p>
                  )}
                </div>
              )}
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
                  {iaProvedor === 'gemini' && (
                    <> Assinatura do Gemini (Workspace/Gemini Advanced) não dá cota de API — é um
                      produto separado. Se der "cota excedida" mesmo sem uso, o projeto do Google
                      Cloud dessa chave precisa ter faturamento ativado em
                      console.cloud.google.com/billing.</>
                  )}
                </p>
              </div>
              <div className="grupo">
                <label className="label" htmlFor="ia-modelo">Modelo (opcional)</label>
                <input id="ia-modelo" value={iaModelo} onChange={(e) => setIaModelo(e.target.value)}
                       placeholder="deixe em branco para o padrão" />
                <p className="ajuda">
                  {iaProvedor === 'ollama'
                    ? 'Copie o nome exato de ollama.com/models — ex.: gpt-oss:120b-cloud, glm-4.6:cloud, qwen3:cloud.'
                    : 'Só mexa aqui se quiser um modelo específico desse provedor. Em branco, usamos um rápido e barato por padrão.'}
                </p>
              </div>
            </div>
          </section>

          <section className="secao">
            <h2>Enriquecimento de lead</h2>
            <p className="resumo-secao">
              Opcional. Sem chave, o botão "Enriquecer" some da lista de resultados. Cada chave é
              uma etapa independente — pode cadastrar só uma, as outras ficam puladas.
            </p>
            <div className="cartaocfg">
              <div className="grupo">
                <label className="label" htmlFor="decisor-provedor">Serviço que acha o sócio/decisor</label>
                <select id="decisor-provedor" value={decisorProvedor} onChange={(e) => setDecisorProvedor(e.target.value)}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  <option value="perplexity">Perplexity — mais preciso, cobra por consulta</option>
                  <option value="gratis">Grátis — usa a IA e o Serper/Tavily já cadastrados</option>
                </select>
              </div>
              {decisorProvedor === 'gratis' ? (
                <p className="ajuda" style={{ marginTop: -6, marginBottom: 4 }}>
                  Não precisa de chave nova: busca pelo Serper/Tavily configurado ali embaixo e manda
                  pra IA da seção "Inteligência artificial" (ali em cima) interpretar. Menos preciso
                  que a Perplexity, mas roda sem gastar nada.
                </p>
              ) : (
                <div className="grupo">
                  <label className="label" htmlFor="perplexity-key">Chave da Perplexity</label>
                  <input id="perplexity-key" type="password" value={perplexityKey}
                         onChange={(e) => setPerplexityKey(e.target.value)}
                         placeholder={p.temPerplexity ? '•••••••• já cadastrada' : 'cole a chave aqui'} />
                  <p className="ajuda">Pegue em perplexity.ai/settings/api. Cobra por consulta, sem plano grátis.</p>
                </div>
              )}
              <div className="grupo">
                <label className="label" htmlFor="linkedin-provedor">Serviço que acha o LinkedIn pessoal</label>
                <select id="linkedin-provedor" value={linkedinProvedor} onChange={(e) => setLinkedinProvedor(e.target.value)}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  <option value="serper">Serper — 2.500 buscas grátis (crédito único)</option>
                  <option value="tavily">Tavily — 1.000 buscas grátis por mês (recorrente)</option>
                </select>
              </div>
              {linkedinProvedor === 'tavily' ? (
                <div className="grupo">
                  <label className="label" htmlFor="tavily-key">Chave da Tavily</label>
                  <input id="tavily-key" type="password" value={tavilyKey}
                         onChange={(e) => setTavilyKey(e.target.value)}
                         placeholder={p.temTavily ? '•••••••• já cadastrada' : 'cole a chave aqui'} />
                  <p className="ajuda">Pegue em app.tavily.com.</p>
                </div>
              ) : (
                <div className="grupo">
                  <label className="label" htmlFor="serper-key">Chave do Serper</label>
                  <input id="serper-key" type="password" value={serperKey}
                         onChange={(e) => setSerperKey(e.target.value)}
                         placeholder={p.temSerper ? '•••••••• já cadastrada' : 'cole a chave aqui'} />
                  <p className="ajuda">Pegue em serper.dev.</p>
                </div>
              )}
              <div className="grupo">
                <label className="label" htmlFor="email-provedor">Serviço que acha e valida o e-mail</label>
                <select id="email-provedor" value={emailProvedor} onChange={(e) => setEmailProvedor(e.target.value)}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  <option value="anymail">Anymail Finder — 100 créditos grátis por 14 dias</option>
                  <option value="apollo">Apollo.io — cota grátis variável, verificar direto</option>
                  <option value="snov">Snov.io — plano grátis com limite mensal</option>
                </select>
              </div>
              {emailProvedor === 'apollo' ? (
                <div className="grupo">
                  <label className="label" htmlFor="apollo-key">Chave da Apollo.io</label>
                  <input id="apollo-key" type="password" value={apolloKey}
                         onChange={(e) => setApolloKey(e.target.value)}
                         placeholder={p.temApollo ? '•••••••• já cadastrada' : 'cole a chave aqui'} />
                  <p className="ajuda">Pegue em app.apollo.io (Settings → API).</p>
                </div>
              ) : emailProvedor === 'snov' ? (
                <>
                  <div className="grupo">
                    <label className="label" htmlFor="snov-id">Snov.io — API User ID</label>
                    <input id="snov-id" type="password" value={snovClientId}
                           onChange={(e) => setSnovClientId(e.target.value)}
                           placeholder={p.temSnov ? '•••••••• já cadastrado' : 'cole o ID aqui'} />
                  </div>
                  <div className="grupo">
                    <label className="label" htmlFor="snov-secret">Snov.io — API Secret</label>
                    <input id="snov-secret" type="password" value={snovClientSecret}
                           onChange={(e) => setSnovClientSecret(e.target.value)}
                           placeholder={p.temSnov ? '•••••••• já cadastrado' : 'cole o secret aqui'} />
                    <p className="ajuda">Os dois em snov.io, aba API das configurações da conta.</p>
                  </div>
                </>
              ) : (
                <div className="grupo">
                  <label className="label" htmlFor="anymail-key">Chave da Anymail Finder</label>
                  <input id="anymail-key" type="password" value={anymailKey}
                         onChange={(e) => setAnymailKey(e.target.value)}
                         placeholder={p.temAnymail ? '•••••••• já cadastrada' : 'cole a chave aqui'} />
                  <p className="ajuda">Pegue em anymailfinder.com.</p>
                </div>
              )}
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
                  decisorProvedor === 'gratis' ? ['decisor-gratis', 'Testar decisor grátis'] : ['perplexity', 'Testar Perplexity'],
                  linkedinProvedor === 'tavily' ? ['tavily', 'Testar Tavily'] : ['serper', 'Testar Serper'],
                  emailProvedor === 'apollo' ? ['apollo', 'Testar Apollo.io']
                    : emailProvedor === 'snov' ? ['snov', 'Testar Snov.io']
                    : ['anymail', 'Testar Anymail Finder'],
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
                  <b>{
                    qual === 'serpapi' ? 'Busca' : qual === 'whatsapp' ? 'WhatsApp' : qual === 'ia' ? 'IA'
                    : qual === 'perplexity' ? 'Perplexity' : qual === 'decisor-gratis' ? 'Decisor grátis'
                    : qual === 'serper' ? 'Serper' : qual === 'tavily' ? 'Tavily'
                    : qual === 'apollo' ? 'Apollo.io' : qual === 'snov' ? 'Snov.io' : 'Anymail Finder'
                  }:</b> {r.recado}
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

      {aba === 'erros' && (
        <section className="secao">
          <h2>Erros de envio</h2>
          <p className="resumo-secao">
            Disparos e enriquecimentos que falharam nesta conta, mais recentes primeiro.
          </p>
          <table className="tabela">
            <thead>
              <tr><th>Quando</th><th>Tipo</th><th>Empresa</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {p.erros.map((e, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{e.quando}</td>
                  <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{e.tipo}</td>
                  <td>{e.empresa}</td>
                  <td style={{ color: 'var(--ink-2)' }}>{e.erro}</td>
                </tr>
              ))}
              {!p.erros.length && (
                <tr><td colSpan={4} style={{ color: 'var(--ink-3)' }}>Nenhum erro registrado.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {aba !== 'erros' && (
        <button className="salvar" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      )}
      {aviso && <p className="aviso">{aviso}</p>}
    </div>
  );
}
