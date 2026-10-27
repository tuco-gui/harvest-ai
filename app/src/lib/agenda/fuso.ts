/**
 * Adaptado de DeskcommCRM lib/agenda/fuso.ts @ f13d26f6.
 * Copyright (c) 2026 Rafael Melgaço — MIT, ver THIRD_PARTY_NOTICES.md.
 * Preserva a conversão em duas passadas e a escolha explícita no salto de DST.
 */
export interface HoraDeParede {ano:number;mes:number;dia:number;hora?:number;minuto?:number;segundo?:number}
type ParedeLida=Required<HoraDeParede>;
const FORMATADORES=new Map<string,Intl.DateTimeFormat>();
function formatador(fuso:string) {
 const existente=FORMATADORES.get(fuso);if(existente)return existente;
 const novo=new Intl.DateTimeFormat('en-US',{timeZone:fuso,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 FORMATADORES.set(fuso,novo);return novo;
}
export function partesNoFuso(instante:Date,fuso:string):ParedeLida {
 const partes=formatador(fuso).formatToParts(instante);
 const numero=(tipo:Intl.DateTimeFormatPartTypes)=>Number(partes.find(p=>p.type===tipo)?.value??0);
 return {ano:numero('year'),mes:numero('month'),dia:numero('day'),hora:numero('hour'),minuto:numero('minute'),segundo:numero('second')};
}
export function offsetEmMinutos(instante:Date,fuso:string):number {
 const p=partesNoFuso(instante,fuso);
 const comoUtc=Date.UTC(p.ano,p.mes-1,p.dia,p.hora,p.minuto,p.segundo);
 return (comoUtc-Math.floor(instante.getTime()/1000)*1000)/60000;
}
export function instanteDe(pedida:HoraDeParede,fuso:string):Date {
 const p={...pedida,hora:pedida.hora??0,minuto:pedida.minuto??0,segundo:pedida.segundo??0};
 const alvo=Date.UTC(p.ano,p.mes-1,p.dia,p.hora,p.minuto,p.segundo);
 const bate=(instante:number)=>{
  const lida=partesNoFuso(new Date(instante),fuso);
  return lida.ano===p.ano&&lida.mes===p.mes&&lida.dia===p.dia&&lida.hora===p.hora&&lida.minuto===p.minuto;
 };
 const primeiro=alvo-offsetEmMinutos(new Date(alvo),fuso)*60000;
 if(bate(primeiro))return new Date(primeiro);
 const segundo=alvo-offsetEmMinutos(new Date(primeiro),fuso)*60000;
 if(bate(segundo))return new Date(segundo);
 return new Date(Math.max(primeiro,segundo));
}
export function diaLocalISO(instante:Date,fuso:string):string {
 const p=partesNoFuso(instante,fuso),dois=(n:number)=>String(n).padStart(2,'0');
 return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}
