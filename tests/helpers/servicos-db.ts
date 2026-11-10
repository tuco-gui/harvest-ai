/** Double do protocolo Supabase, com filtros reais de tenant/ator e auditoria. */
export function servicosDb(tabelas:Record<string,any[]>,erros:Record<string,any>={}){
 const consultas:Array<{tabela:string;filtros:Record<string,unknown>}>=[];
  const db:any={from(tabela:string){const filtros:Record<string,unknown>={};const pred:Array<(r:any)=>boolean>=[];let unico=false,novo:any=null,patch:any=null,conflito:string[]=[];
  consultas.push({tabela,filtros});
  let contar=false;
  const q:any={select(_?:string,opts?:{count?:string}){contar=!!opts?.count;return q;},eq(k:string,v:any){filtros[k]=v;pred.push(r=>r[k]===v);return q;},gt(k:string,v:any){pred.push(r=>r[k]>v);return q;},is(k:string,v:any){pred.push(r=>(r[k]??null)===v);return q;},
    order(){return q;},limit(){return q;},maybeSingle(){unico=true;return q;},single(){unico=true;return q;},insert(x:any){novo=x;return q;},update(x:any){patch=x;return q;},upsert(x:any,o:any){novo=x;conflito=String(o?.onConflict??'id').split(',').map((s:string)=>s.trim());return q;},
    then(resolve:(r:any)=>void){if(erros[tabela])return resolve({data:null,error:erros[tabela]});const rows=tabelas[tabela]??=[];if(novo){const ex=conflito.length?rows.find(r=>conflito.every(k=>r[k]===novo[k])):null;if(ex)Object.assign(ex,novo);else rows.push({...novo,id:novo.id??rows.length+1});}const found=rows.filter(r=>pred.every(p=>p(r)));if(patch)found.forEach(r=>Object.assign(r,patch));resolve({data:unico?(found[0]?{...found[0]}:null):found.map(r=>({...r})),error:null,count:contar?found.length:undefined});}
  };return q;
 }};
 return {db,consultas,tabelas};
}
