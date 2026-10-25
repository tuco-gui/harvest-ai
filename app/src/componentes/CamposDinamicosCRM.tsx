'use client';
import type { CampoDef } from '@/lib/crmCadastros';

export default function CamposDinamicosCRM({ definicoes, valores, onChange, disabled = false }: {
 definicoes:CampoDef[]; valores:Record<string,unknown>;
 onChange:(novo:Record<string,unknown>)=>void; disabled?:boolean;
}) {
 function alterar(chave:string,v:unknown){ onChange({...valores,[chave]:v}); }
 return <div className="crm-campos-dinamicos">
  {definicoes.filter(x=>x.ativo).map(c=><label key={c.id}>
   <span>{c.rotulo}{c.obrigatorio?' *':''}</span>
   {c.tipo==='booleano' ? <input type="checkbox" disabled={disabled}
     checked={valores[c.chave]===true} onChange={e=>alterar(c.chave,e.target.checked)}/>
   : c.tipo==='selecao' ? <select disabled={disabled}
     value={typeof valores[c.chave]==='string'?String(valores[c.chave]):''}
     required={c.obrigatorio} onChange={e=>alterar(c.chave,e.target.value)}>
     <option value="">Selecionar…</option>
     {c.opcoes.map(o=><option key={o} value={o}>{o}</option>)}
    </select> : <input disabled={disabled} required={c.obrigatorio}
      type={c.tipo==='numero'?'number':c.tipo==='data'?'date':'text'}
      step={c.tipo==='numero'?'any':undefined}
      value={valores[c.chave]===null||valores[c.chave]===undefined?'':String(valores[c.chave])}
      onChange={e=>alterar(c.chave,c.tipo==='numero'?
        (e.target.value===''?null:Number(e.target.value)):e.target.value)}/>}
  </label>)}
 </div>;
}
