'use client';

import { useEffect, useState } from 'react';
import {
  PALETA_ETIQUETAS, nomeEtiqueta, type EtiquetaCRM,
} from '@/lib/crmEtiquetas';

export default function GerenciadorEtiquetasCRM({
  selecionadas, onChange, desabilitado = false, contexto = 'conversa', limite = 8,
}: { selecionadas: string[]; onChange: (v: string[]) => void; desabilitado?: boolean; contexto?: 'conversa' | 'negócio'; limite?: number }) {
  const [catalogo, setCatalogo] = useState<EtiquetaCRM[]>([]);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState<string | null>(null);
  const [gerenciando, setGerenciando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/crm/etiquetas', { cache: 'no-store', signal: ctrl.signal })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? 'Não foi possível ler o catálogo.');
        if (!ctrl.signal.aborted) { setCatalogo(d.etiquetas ?? []); setPodeGerenciar(d.podeGerenciar); }
      }).catch(e => { if (!ctrl.signal.aborted) setErro(e.message); });
    return () => ctrl.abort();
  }, []);

  function alternar(nome: string) {
    if (desabilitado || ocupado) return;
    const nova = selecionadas.includes(nome)
      ? selecionadas.filter(n => n !== nome) : [...selecionadas, nome];
    if (nova.length > limite) { setErro(`Até ${limite} etiquetas por ${contexto}.`); return; }
    onChange(nova);
    setErro('');
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const nome = nomeEtiqueta(novoNome);
    if (!nome) { setErro('Nome deve ter entre 1 e 28 caracteres.'); return; }
    setOcupado(true); setErro(''); setAviso('');
    try {
      const r = await fetch('/api/crm/etiquetas', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ nome, cor:novaCor }),
      });
      const d=await r.json();
      if(!r.ok) throw Error(d.erro || 'Não foi possível criar.');
      setCatalogo(antigo => [...antigo.filter(x=>x.nome!==d.etiqueta.nome),d.etiqueta]
        .sort((a,b)=>a.nome.localeCompare(b.nome)));
      if (selecionadas.length < limite && !selecionadas.includes(nome)) onChange([...selecionadas,nome]);
      setNovoNome('');setNovaCor(null);setAviso('Etiqueta criada e incluída na seleção.');
    } catch(err) {setErro(err instanceof Error?err.message:'Falha ao criar.');}
    finally {setOcupado(false);}
  }

  async function alterarCor(nome: string, cor: string | null) {
    setOcupado(true);setErro('');
    try {
      const r=await fetch('/api/crm/etiquetas',{method:'PATCH',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({nome,cor})});
      const d=await r.json();
      if(!r.ok) throw Error(d.erro || 'Não foi possível alterar a cor.');
      setCatalogo(arr=>arr.map(x=>x.nome===nome?d.etiqueta:x));
    }catch(err){setErro(err instanceof Error?err.message:'Falha ao salvar cor.');}
    finally{setOcupado(false);}
  }

  async function excluir(nome: string) {
    if(!window.confirm('Excluir DEFINITIVAMENTE a etiqueta "'+nome+
      '" do catálogo e de TODOS os atendimentos e negócios desta workspace? A operação não pode ser desfeita.'))return;
    setOcupado(true);setErro('');setAviso('');
    try{
      const r=await fetch('/api/crm/etiquetas',{method:'DELETE',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({nome,confirmar:nome})});
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Falha ao excluir etiqueta.');
      setCatalogo(arr=>arr.filter(x=>x.nome!==nome));
      onChange(selecionadas.filter(x=>x!==nome));
      setAviso('Etiqueta excluída e desvinculada de '+d.desvinculadaDe+' registro(s).');
    }catch(err){setErro(err instanceof Error?err.message:'Falha ao excluir.');}
    finally{setOcupado(false);}
  }

  function chip(nome: string) {
    const cor = catalogo.find(x=>x.nome===nome)?.cor;
    return <span key={nome} className="crm-tag-chip" style={{borderColor:cor??undefined}}>
      <span className="crm-tag-ponto" style={{backgroundColor:cor??'var(--ink-3)'}} aria-hidden="true"/>
      {nome}
      <button type="button" disabled={ocupado||desabilitado}
        aria-label={'Remover etiqueta '+nome+' deste '+contexto} onClick={()=>alternar(nome)}>×</button>
    </span>;
  }

  return <div className="crm-gestao-etiquetas">
    <div className="crm-gestao-etiquetas-cabecalho">
      <strong>Etiquetas ({selecionadas.length}/{limite})</strong>
      <button type="button" onClick={()=>setGerenciando(!gerenciando)}
        aria-expanded={gerenciando}>{gerenciando?'Fechar catálogo':'Gerenciar etiquetas'}</button>
    </div>
    <div className="crm-etiquetas-chips">
      {selecionadas.length?selecionadas.map(chip):<span className="ajuda">Nenhuma etiqueta selecionada.</span>}
    </div>
    <fieldset className="crm-etiquetas-opcoes" disabled={ocupado||desabilitado}>
      <legend>Adicionar ou remover várias etiquetas</legend>
      {catalogo.length?catalogo.map(t=><label key={t.nome}>
        <input type="checkbox" checked={selecionadas.includes(t.nome)}
          onChange={()=>alternar(t.nome)}/>
        <span className="crm-tag-ponto" style={{backgroundColor:t.cor??'var(--ink-3)'}} aria-hidden="true"/>
        {t.nome}
      </label>):<p className="ajuda">Nenhuma etiqueta cadastrada. Crie a primeira abaixo.</p>}
    </fieldset>
    {!!selecionadas.length && <button className="crm-etiquetas-limpar" type="button"
      disabled={ocupado||desabilitado} onClick={()=>onChange([])}>
      Remover todas as etiquetas deste {contexto}
    </button>}
    {gerenciando && <div className="crm-etiquetas-gerenciar">
      {podeGerenciar ? <>
        <form onSubmit={criar}>
          <label>Nova etiqueta
            <input value={novoNome} maxLength={28}
              onChange={e=>setNovoNome(e.target.value)} placeholder="Ex.: proposta enviada"/>
          </label>
          <p className="ajuda">Escolha uma cor antes de criar (opcional).</p>
          <div className="crm-etiquetas-paleta">
            {PALETA_ETIQUETAS.map(t=><button type="button" key={t.cor}
              aria-label={'Cor '+t.nome} aria-pressed={novaCor===t.cor}
              title={t.nome} onClick={()=>setNovaCor(t.cor)}
              style={{backgroundColor:t.cor}}/>)}
            <button type="button" className="sem-cor" onClick={()=>setNovaCor(null)}>Sem cor</button>
          </div>
          <button type="submit" disabled={ocupado||!novoNome.trim()}>+ Criar etiqueta</button>
        </form>
        <div className="crm-etiquetas-administrar">
          <p className="ajuda">Alterar cor ou excluir definitivamente do catálogo.</p>
          {catalogo.map(t=><div className="crm-etiqueta-linha" key={t.nome}>
            <strong>{t.nome}</strong>
            <select aria-label={'Cor de '+t.nome} disabled={ocupado}
              value={t.cor??''} onChange={e=>void alterarCor(t.nome,e.target.value||null)}>
              <option value="">Sem cor</option>
              {PALETA_ETIQUETAS.map(x=><option key={x.cor} value={x.cor}>{x.nome}</option>)}
            </select>
            <button type="button" disabled={ocupado}
              onClick={()=>void excluir(t.nome)}>Excluir catálogo</button>
          </div>)}
        </div>
      </>:<p className="ajuda">Somente administradores podem criar, alterar cores ou excluir etiquetas do catálogo.</p>}
    </div>}
    {erro&&<p role="alert" className="crm-aviso">{erro}</p>}
    {aviso&&<p role="status" className="ajuda">{aviso}</p>}
  </div>;
}
