'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

declare global { interface Window { L: any; Papa: any } }

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
  latitude: number | null;
  longitude: number | null;
  tem_whatsapp: boolean | null;
  dados_extras?: Record<string, string> | null;
  distancia_km?: number | null;
  dentro_do_raio?: boolean | null;
};

type Estado = 'parado' | 'correndo' | 'pausado';
type PainelExtra = 'mapa' | 'planilha' | 'manual' | null;

const CENTRO_PADRAO: [number, number] = [-15.79, -47.88];
const RAIOS_PRESET = [1, 5, 10, 25];

/** O zoom do `ll=@lat,lng,ZOOMz` é só uma dica pro Google de onde olhar — a
 *  distância real é filtrada depois, no servidor. Por isso a fórmula é
 *  aproximada, não precisa bater exato com o raio escolhido. */
function zoomParaRaio(km: number): number {
  if (km <= 1) return 14;
  if (km <= 3) return 13;
  if (km <= 5) return 12;
  if (km <= 10) return 11;
  if (km <= 20) return 10;
  if (km <= 40) return 9;
  return 8;
}

export default function Prospeccao({
  podeConfigurar, intervaloMin = 30, intervaloMax = 60,
}: { podeConfigurar: boolean; intervaloMin?: number; intervaloMax?: number }) {
  const [termo, setTermo] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jaBuscou, setJaBuscou] = useState(false);
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista');
  const [painelExtra, setPainelExtra] = useState<PainelExtra>(null);
  const [regiao, setRegiao] = useState<{ lat: number; lng: number; km: number } | null>(null);
  const mapaRef = useRef<any>(null);
  const camadas = useRef<any[]>([]);

  const [estado, setEstado] = useState<Estado>('parado');
  const [restam, setRestam] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [falhas, setFalhas] = useState(0);
  const [recado, setRecado] = useState<string | null>(null);
  const [avisoRegiao, setAvisoRegiao] = useState<string | null>(null);
  const [raioCustom, setRaioCustom] = useState('');

  const chave = (l: Lead, i: number) => l.place_id ?? `${l.empresa}-${i}`;
  const selecionados = useMemo(
    () => leads.filter((l, i) => escolhidos.has(chave(l, i))),
    [leads, escolhidos],
  );
  const comZap = leads.filter((l) => l.tem_whatsapp === true).length;
  const mostrarMapa = painelExtra === 'mapa' || (leads.length > 0 && vista === 'mapa');

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!termo.trim() || buscando) return;

    setBuscando(true);
    setErro(null);
    setAvisoRegiao(null);

    try {
      const r = await fetch('/api/busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termo,
          pagina: 1,
          // raio em km -> zoom que a SerpAPI espera em ll=@lat,lng,ZOOMz (só uma
          // dica de onde olhar); `regiao` é o que o servidor usa pra filtrar de
          // verdade pela distância real.
          ll: regiao ? `@${regiao.lat.toFixed(6)},${regiao.lng.toFixed(6)},${zoomParaRaio(regiao.km)}z` : undefined,
          regiao: regiao ?? undefined,
        }),
      });
      const dados = await r.json();

      if (!r.ok) {
        setErro(dados.erro ?? 'Não consegui buscar agora.');
        setLeads([]);
      } else {
        setLeads(dados.leads ?? []);
        setEscolhidos(new Set());
        setVista(regiao ? 'mapa' : 'lista');
        setAvisoRegiao(dados.avisoRegiao ?? null);
      }
      setJaBuscou(true);
      setPainelExtra(null);
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

  function limparLista() {
    if (leads.length && !confirm('Limpar a lista atual? O que já foi disparado continua registrado.')) return;
    setLeads([]);
    setEscolhidos(new Set());
    setJaBuscou(false);
    setErro(null);
    setAvisoRegiao(null);
    setVista('lista');
  }

  function aplicarRaioCustom() {
    const km = Number(raioCustom);
    if (!km || km <= 0) return;
    setRegiao((r) => (r ? { ...r, km } : { lat: CENTRO_PADRAO[0], lng: CENTRO_PADRAO[1], km }));
    setRaioCustom('');
  }

  /* ------------------------------------------------------- disparo */
  // O laço vive aqui, no navegador: parar é simplesmente não chamar de novo.
  const parada = useRef<{ parar: boolean; pausado: boolean }>({ parar: false, pausado: false });

  function proximoIntervalo() {
    return Math.floor(Math.random() * (intervaloMax - intervaloMin + 1)) + intervaloMin;
  }
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function disparar() {
    const fila = selecionados;
    if (!fila.length) return;

    parada.current = { parar: false, pausado: false };
    setEstado('correndo');
    setEnviados(0);
    setFalhas(0);
    setRecado(null);

    let ok = 0;
    let erro = 0;

    for (let i = 0; i < fila.length; i++) {
      if (parada.current.parar) break;
      while (parada.current.pausado && !parada.current.parar) await espera(500);
      if (parada.current.parar) break;

      try {
        const r = await fetch('/api/disparo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead: fila[i], indice: i }),
        });
        if (r.ok) { ok++; setEnviados(ok); }
        else {
          erro++; setFalhas(erro);
          const d = await r.json().catch(() => ({}));
          // erro de configuração não adianta repetir 20 vezes
          if (r.status === 400) { setRecado(d.erro ?? 'Erro de configuração.'); break; }
        }
      } catch {
        erro++; setFalhas(erro);
      }

      if (i < fila.length - 1 && !parada.current.parar) {
        const intervalo = proximoIntervalo();
        for (let s = intervalo; s > 0 && !parada.current.parar; s--) {
          setRestam(s);
          await espera(1000);
          while (parada.current.pausado && !parada.current.parar) await espera(500);
        }
      }
    }

    setEstado('parado');
    setRestam(0);
    if (!parada.current.parar) {
      setRecado(
        erro
          ? `Terminou: ${ok} ${ok === 1 ? 'enviada' : 'enviadas'}, ${erro} com erro.`
          : `Pronto. ${ok} ${ok === 1 ? 'mensagem enviada' : 'mensagens enviadas'}.`,
      );
    }
  }

  function pausar() {
    parada.current.pausado = !parada.current.pausado;
    setEstado(parada.current.pausado ? 'pausado' : 'correndo');
  }

  function parar() {
    if (!confirm('Parar o disparo? As mensagens que ainda não saíram serão canceladas.')) return;
    parada.current.parar = true;
    parada.current.pausado = false;
    setRecado(`Disparo interrompido. ${enviados} ${enviados === 1 ? 'saiu' : 'saíram'}.`);
  }

  /* --------------------------------------------------- importar lista */
  const [importando, setImportando] = useState(false);

  function baixarModelo() {
    const linhas = [
      'nome,telefone,endereco,site,categoria,email,ultimo_pedido,valor_ultimo_pedido',
      'Clinica Exemplo,5511999998888,"Av. Paulista 1000, Sao Paulo - SP",https://exemplo.com.br,Clinica,contato@exemplo.com.br,2026-05-12,1450',
      'Pet Shop Exemplo,5571988887777,"Rua da Bahia 50, Salvador - BA",,Pet Shop,,,',
    ].join('\n');
    // BOM para o Excel abrir a acentuação certa
    const url = URL.createObjectURL(new Blob(['﻿' + linhas], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo-harvest.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function normalizar(bruto: string | null | undefined): string | null {
    if (!bruto) return null;
    let d = String(bruto).replace(/\D/g, '');
    if (d.length < 10) return null;
    if (!d.startsWith('55')) d = '55' + d;
    return d;
  }

  async function validarLeva(telefones: (string | null)[]): Promise<Record<string, boolean>> {
    try {
      const r = await fetch('/api/validar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefones }),
      });
      if (r.ok) return (await r.json()).validacao ?? {};
    } catch { /* sem validação os leads ficam como não verificados */ }
    return {};
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (!window.Papa) { setErro('Ainda carregando o leitor de planilha. Tente de novo em um instante.'); return; }

    setImportando(true);
    setErro(null);

    window.Papa.parse(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: async (saida: any) => {
        const linhas: Record<string, string>[] = saida.data ?? [];
        // nomes de coluna que a gente reconhece; o resto vira contexto para a IA
        const MAPA: Record<string, string[]> = {
          empresa: ['nome', 'name', 'empresa', 'company', 'cliente', 'razao social'],
          telefone: ['telefone', 'phone', 'celular', 'whatsapp', 'tel', 'contato', 'fone'],
          endereco: ['endereco', 'endereço', 'address', 'local', 'cidade'],
          site: ['site', 'website', 'url'],
          especialidades: ['categoria', 'category', 'segmento', 'nicho', 'ramo', 'tipo'],
        };
        const pegar = (linha: Record<string, string>, chaves: string[]) => {
          const k = Object.keys(linha).find((c) => chaves.includes(c.toLowerCase().trim()));
          return k ? linha[k] : '';
        };
        const usadas = Object.values(MAPA).flat().concat(['email', 'e-mail', 'mail']);

        const importados: Lead[] = linhas.map((linha) => {
          const extras: Record<string, string> = {};
          Object.keys(linha).forEach((c) => {
            const k = c.toLowerCase().trim();
            if (!usadas.includes(k) && linha[c]) extras[c.trim()] = linha[c];
          });
          const tel = pegar(linha, MAPA.telefone);
          return {
            place_id: null,
            empresa: pegar(linha, MAPA.empresa) || 'Sem nome',
            telefone: normalizar(tel),
            telefone_original: tel || null,
            endereco: pegar(linha, MAPA.endereco) || null,
            especialidades: pegar(linha, MAPA.especialidades) || 'Importado da planilha',
            rating: null, reviews: null,
            site: pegar(linha, MAPA.site) || null,
            latitude: null, longitude: null,
            tem_whatsapp: null,
            dados_extras: Object.keys(extras).length ? extras : null,
          } as Lead;
        }).filter((l) => l.telefone);

        const validacao = await validarLeva(importados.map((l) => l.telefone));

        setLeads(importados.map((l) => ({ ...l, tem_whatsapp: l.telefone ? (validacao[l.telefone] ?? null) : null })));
        setEscolhidos(new Set());
        setJaBuscou(true);
        setVista('lista');
        setPainelExtra(null);
        setImportando(false);
        if (!importados.length) setErro('Nenhuma linha com telefone válido. Confira a coluna de telefone.');
      },
      error: () => { setImportando(false); setErro('Não consegui ler o arquivo. Salve como CSV UTF-8.'); },
    });
    e.target.value = '';
  }

  /* -------------------------------------------------- entrada manual */
  const [manualTexto, setManualTexto] = useState('');
  const [adicionandoManual, setAdicionandoManual] = useState(false);

  async function adicionarManual() {
    const linhas = manualTexto.split('\n').map((l) => l.trim()).filter(Boolean);
    const candidatos = linhas.map((linha) => {
      const partes = linha.split(',').map((p) => p.trim());
      const [nomeBruto, telBruto] = partes.length > 1 ? partes : ['', partes[0]];
      return { empresa: nomeBruto || 'Contato manual', telOriginal: telBruto, telefone: normalizar(telBruto) };
    }).filter((c) => c.telefone);

    if (!candidatos.length) { setErro('Nenhum telefone válido. Um por linha, com DDD.'); return; }

    setAdicionandoManual(true);
    setErro(null);
    const validacao = await validarLeva(candidatos.map((c) => c.telefone));

    const novos: Lead[] = candidatos.map((c) => ({
      place_id: null, empresa: c.empresa, telefone: c.telefone, telefone_original: c.telOriginal,
      endereco: null, especialidades: 'Adicionado manualmente', rating: null, reviews: null,
      site: null, latitude: null, longitude: null,
      tem_whatsapp: c.telefone ? (validacao[c.telefone] ?? null) : null, dados_extras: null,
    }));

    setLeads((antes) => {
      const existentes = new Set(antes.map((l) => l.telefone));
      return [...antes, ...novos.filter((n) => !existentes.has(n.telefone))];
    });
    setJaBuscou(true);
    setVista('lista');
    setManualTexto('');
    setAdicionandoManual(false);
    setPainelExtra(null);
  }

  /* ---------------------------------------------------------- o CEP */
  const [cepTexto, setCepTexto] = useState('');
  const [localizandoCep, setLocalizandoCep] = useState(false);

  async function localizarCep() {
    const limpo = cepTexto.replace(/\D/g, '');
    if (limpo.length !== 8) { setErro('CEP precisa ter 8 dígitos.'); return; }

    setLocalizandoCep(true);
    setErro(null);
    try {
      const r = await fetch(`/api/cep?cep=${limpo}`);
      const d = await r.json();
      if (!r.ok) { setErro(d.erro ?? 'CEP não encontrado.'); return; }
      setRegiao((antes) => ({ lat: d.lat, lng: d.lng, km: antes?.km ?? 5 }));
      mapaRef.current?.setView([d.lat, d.lng], 13);
    } catch {
      setErro('Não consegui localizar agora.');
    } finally {
      setLocalizandoCep(false);
    }
  }

  /* --------------------------------------------------------- o mapa */
  const ehEscuro = () => {
    if (typeof document === 'undefined') return false;
    const t = document.documentElement.dataset.tema;
    return t ? t === 'escuro' : matchMedia('(prefers-color-scheme:dark)').matches;
  };

  useEffect(() => {
    if (!mostrarMapa) return;
    const L = typeof window !== 'undefined' ? window.L : null;
    if (!L) return;

    if (!mapaRef.current) {
      const centro = leads.find((l) => l.latitude && l.longitude);
      // scrollWheelZoom desligado: com ele ligado, rolar a página com o mouse
      // em cima do mapa trava a rolagem e some no zoom sem querer.
      mapaRef.current = L.map('mapa', { scrollWheelZoom: false }).setView(
        centro ? [centro.latitude, centro.longitude] : (regiao ? [regiao.lat, regiao.lng] : CENTRO_PADRAO),
        centro ? 13 : regiao ? 12 : 4,
      );
      L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/${ehEscuro() ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`,
        { attribution: '© OpenStreetMap, © CARTO', maxZoom: 19 },
      ).addTo(mapaRef.current);
      mapaRef.current.on('click', (e: any) =>
        setRegiao((r) => ({ lat: e.latlng.lat, lng: e.latlng.lng, km: r?.km ?? 5 })),
      );
    }
    setTimeout(() => mapaRef.current?.invalidateSize(), 60);
  }, [mostrarMapa, leads]);

  // redesenha pontos e círculo quando os leads ou a região mudam
  useEffect(() => {
    const L = typeof window !== 'undefined' ? window.L : null;
    const mapa = mapaRef.current;
    if (!L || !mapa || !mostrarMapa) return;

    camadas.current.forEach((c) => mapa.removeLayer(c));
    camadas.current = [];

    leads.forEach((l) => {
      if (!l.latitude || !l.longitude) return;
      const m = L.marker([l.latitude, l.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div class="pino-lead" data-sem="${l.tem_whatsapp === true ? '0' : '1'}"></div>`,
          iconSize: [9, 9],
        }),
      }).addTo(mapa).bindPopup(`<b>${l.empresa}</b><br>${l.telefone_original ?? 'sem telefone'}`);
      camadas.current.push(m);
    });

    if (regiao) {
      const pino = L.marker([regiao.lat, regiao.lng], {
        icon: L.divIcon({ className: '', html: '<div class="pino-busca"></div>', iconSize: [14, 14] }),
      }).addTo(mapa);
      const circulo = L.circle([regiao.lat, regiao.lng], {
        radius: regiao.km * 1000, color: '#C4191F', weight: 1, fillColor: '#C4191F', fillOpacity: 0.06,
      }).addTo(mapa);
      camadas.current.push(pino, circulo);
    }
  }, [leads, regiao, mostrarMapa]);

  const naFila = selecionados.slice(enviados);
  const minutos = Math.max(1, Math.round((naFila.length * (intervaloMin + intervaloMax)) / 2 / 60));
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

        <div className="modos" style={{ marginTop: 4 }}>
          <button type="button" aria-pressed={painelExtra === 'mapa'}
                  onClick={() => setPainelExtra((p) => (p === 'mapa' ? null : 'mapa'))}>
            Localizar no mapa
          </button>
          <button type="button" aria-pressed={painelExtra === 'planilha'}
                  onClick={() => setPainelExtra((p) => (p === 'planilha' ? null : 'planilha'))}>
            Importar planilha
          </button>
          <button type="button" aria-pressed={painelExtra === 'manual'}
                  onClick={() => setPainelExtra((p) => (p === 'manual' ? null : 'manual'))}>
            Adicionar manualmente
          </button>
        </div>

        {painelExtra === 'planilha' && (
          <div className="importar" style={{ marginTop: 14 }}>
            <input type="file" accept=".csv,text/csv" onChange={importar} disabled={importando}
                   aria-label="Arquivo CSV com a lista" />
            <p className="ajuda">
              {importando
                ? 'Lendo a planilha e conferindo os WhatsApps…'
                : <>Reconhece colunas como nome, telefone, endereço, site e categoria; o resto vira
                    contexto para a IA. <a href="#" onClick={(e) => { e.preventDefault(); baixarModelo(); }}>Baixar modelo</a>.
                    Só CSV — no Excel, salve como CSV UTF-8.</>}
            </p>
          </div>
        )}

        {painelExtra === 'manual' && (
          <div className="cartaocfg" style={{ marginTop: 14 }}>
            <div className="grupo">
              <label className="label" htmlFor="manual">Um contato por linha</label>
              <textarea id="manual" rows={5} value={manualTexto} onChange={(e) => setManualTexto(e.target.value)}
                        placeholder={'11999998888\nMaria, 11988887777'} />
              <p className="ajuda">Só o telefone, ou "nome, telefone". DDD sempre.</p>
            </div>
            <button className="salvar" type="button" disabled={adicionandoManual || !manualTexto.trim()}
                    onClick={adicionarManual}>
              {adicionandoManual ? 'Adicionando…' : 'Adicionar à lista'}
            </button>
          </div>
        )}

        {mostrarMapa && (
          <div className="mapa-bloco">
            <div className="mapa-controles">
              <div className="raios" role="group" aria-label="Raio da busca">
                {RAIOS_PRESET.map((km) => (
                  <button key={km} type="button"
                          aria-pressed={(regiao?.km ?? 5) === km}
                          onClick={() => setRegiao((r) => (r ? { ...r, km } : { lat: CENTRO_PADRAO[0], lng: CENTRO_PADRAO[1], km }))}>
                    {km} km
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
                <div className="grupo" style={{ marginBottom: 0, maxWidth: 100 }}>
                  <label className="label" htmlFor="raio-custom">Ou digite o raio</label>
                  <input id="raio-custom" type="number" min={1} max={300} value={raioCustom}
                         onChange={(e) => setRaioCustom(e.target.value)}
                         placeholder={`${regiao?.km ?? 5} km`} />
                </div>
                <button type="button" className="salvar" disabled={!raioCustom} onClick={aplicarRaioCustom}>
                  Definir
                </button>
              </div>
              <div className="grupo" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="cep">Ou informe um CEP</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="cep" value={cepTexto} onChange={(e) => setCepTexto(e.target.value)}
                         placeholder="18600-000" />
                  <button type="button" className="salvar" disabled={localizandoCep || !cepTexto.trim()}
                          onClick={localizarCep}>
                    {localizandoCep ? '…' : 'Ir'}
                  </button>
                </div>
              </div>

              {leads.length > 0 && (
                <div className="funil-mini">
                  <span><b>{leads.length}</b> encontradas</span>
                  <span><b>{comZap}</b> com WhatsApp</span>
                  <span><b>{escolhidos.size}</b> selecionadas</span>
                  <div className="acoes acoes-mini">
                    <button type="button" onClick={todas}>Selecionar todas</button>
                    <button type="button" onClick={nenhuma}>Limpar seleção</button>
                    <button type="button" onClick={soZap}>Só com WhatsApp</button>
                    <button type="button" onClick={limparLista}>Limpar lista</button>
                  </div>
                  <div className="modos" style={{ marginTop: 10 }}>
                    <button type="button" aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>Lista</button>
                    <button type="button" aria-pressed={vista === 'mapa'} onClick={() => setVista('mapa')}>Mapa</button>
                  </div>
                </div>
              )}
            </div>

            <div className="mapa-lado">
              <div id="mapa" />
              <p className="mapa-ajuda">
                Clique no mapa para marcar de onde buscar, escolha o raio, e digite o ramo ali em cima
                para buscar. Pontos verdes são empresas com WhatsApp.
              </p>
            </div>
          </div>
        )}

        {regiao && !mostrarMapa && (
          <div className="regiao">
            <span>Buscando em <b>{regiao.km} km</b> ao redor do ponto marcado</span>
            <button onClick={() => setRegiao(null)} aria-label="Remover região">×</button>
          </div>
        )}

        {avisoRegiao && <p className="aviso-suave">{avisoRegiao}</p>}

        {erro && <p className="erro">{erro}</p>}

        {leads.length > 0 && !mostrarMapa && (
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
                <div className="sep" />
                <button type="button" onClick={limparLista}>Limpar lista</button>
              </div>
              <div className="modos">
                <button type="button" aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>Lista</button>
                <button type="button" aria-pressed={vista === 'mapa'} onClick={() => setVista('mapa')}>Mapa</button>
              </div>
            </div>
          </>
        )}

        {leads.length > 0 && (
          <ul className="lista" role="listbox" aria-multiselectable hidden={vista !== 'lista'}>
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
                    data-fora-raio={l.dentro_do_raio === false ? '1' : undefined}
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
                      {l.especialidades && <span className="selo selo-ramo">{l.especialidades}</span>}
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
                      <span className="selo" data-zap-selo={l.tem_whatsapp === true ? 'sim' : l.tem_whatsapp === false ? 'nao' : 'incerto'}>
                        {l.tem_whatsapp === true ? 'WhatsApp' : l.tem_whatsapp === false ? 'Sem WhatsApp' : 'Não verificado'}
                      </span>
                      <span className="zap-numero">{l.telefone_original ?? 'sem telefone'}</span>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}

        {jaBuscou && !leads.length && !erro && (
          <p className="vazio">Nenhuma empresa encontrada. Tente outro ramo ou outra cidade.</p>
        )}

        {!jaBuscou && !erro && (
          <p className="vazio">
            Busque um ramo e uma cidade para começar — ou localize no mapa, importe uma planilha, ou
            adicione números manualmente, ali em cima.
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
          {!disparando && <span className="label">{intervaloMin}–{intervaloMax}s</span>}
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
          <i style={{ width: disparando ? `${(restam / intervaloMax) * 100}%` : '0%' }} />
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
            (falhas > 0 && disparando
              ? `${enviados} enviadas, ${falhas} com erro até agora.`
              : estado === 'pausado'
              ? 'Pausado. Nenhuma mensagem sai até você retomar.'
              : 'O intervalo entre envios protege o número contra bloqueio. Você pode pausar ou parar a qualquer momento.')}
        </p>
      </aside>
    </div>
  );
}
