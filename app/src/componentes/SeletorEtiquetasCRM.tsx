'use client';

import { useEffect, useState } from 'react';
import type { EtiquetaCRM } from '@/lib/crmEtiquetas';

/**
 * Kommo: tags no cabeçalho da ficha, não administração de catálogo na ficha.
 * Alterar seleção modifica apenas o registro aberto; salvar depende da ficha pai.
 */
export default function SeletorEtiquetasCRM({ selecionadas, onChange, limite = 20, desabilitado = false }: {
  selecionadas: string[]; onChange: (tags: string[]) => void;
  limite?: number; desabilitado?: boolean;
}) {
  const [catalogo, setCatalogo] = useState<EtiquetaCRM[]>([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    const ctl = new AbortController();
    fetch('/api/crm/etiquetas', { signal: ctl.signal, cache: 'no-store' })
      .then(async r => { const d=await r.json(); if (!r.ok) throw Error(d.erro || 'Falha nas etiquetas'); return d; })
      .then(d => { if (!ctl.signal.aborted) setCatalogo(d.etiquetas ?? []); })
      .catch(e => { if (!ctl.signal.aborted) setErro(e.message); });
    return () => ctl.abort();
  }, []);
  const alternar = (nome:string) => {
    if (desabilitado) return;
    const proxima = selecionadas.includes(nome) ? selecionadas.filter(x=>x!==nome)
      : [...selecionadas,nome];
    if (proxima.length > limite) { setErro('Limite de '+limite+' etiquetas por registro.'); return; }
    onChange(proxima);setErro('');
  };
  const cor = (nome:string) => catalogo.find(t=>t.nome===nome)?.cor ?? null;
  return <div className="crm-tags-ficha">
    <div className="crm-tags-ficha-chips">{selecionadas.map(nome =>
      <span className="crm-tag-chip" key={nome} style={{borderColor:cor(nome)??undefined}}>
        <span className="crm-tag-ponto" style={{backgroundColor:cor(nome)??'var(--ink-3)'}} aria-hidden="true"/>
        {nome}
        <button type="button" disabled={desabilitado} aria-label={'Desvincular '+nome}
          onClick={()=>alternar(nome)}>×</button>
      </span>)}</div>
    <details className="crm-tags-ficha-menu">
      <summary># ADICIONAR TAGS</summary>
      <div className="crm-tags-ficha-lista">
        {catalogo.length ? catalogo.map(t=><label key={t.nome}>
          <input type="checkbox" checked={selecionadas.includes(t.nome)} disabled={desabilitado}
            onChange={()=>alternar(t.nome)}/>
          <span className="crm-tag-ponto" style={{backgroundColor:t.cor??'var(--ink-3)'}} aria-hidden="true"/>
          {t.nome}
        </label>) : <p className="ajuda">Use Buscar e filtrar → Tags → Gerenciar para cadastrar etiquetas.</p>}
      </div>
    </details>
    {erro && <span role="alert" className="crm-aviso">{erro}</span>}
  </div>;
