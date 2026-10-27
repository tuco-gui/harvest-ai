import {instanteDe,diaLocalISO} from './agenda/fuso.ts';

/** Adaptado de Deskcomm lib/agenda/recorte-da-grade.ts (MIT): buscar os 42 dias desenhados. */
export function diasDaGrade(mes:string):string[] {
 const [ano,numero]=mes.split('-').map(Number);
 const inicio=new Date(Date.UTC(ano,numero-1,1));inicio.setUTCDate(1-inicio.getUTCDay());
 return Array.from({length:42},(_,i)=>{
  const dia=new Date(inicio);dia.setUTCDate(dia.getUTCDate()+i);return dia.toISOString().slice(0,10);
 });
}
export function mudarMes(mes:string,delta:number):string {
 const [ano,numero]=mes.split('-').map(Number);return new Date(Date.UTC(ano,numero-1+delta,1)).toISOString().slice(0,7);
}
export function consultaAgenda(params:URLSearchParams,agora=new Date()) {
 const fuso=params.get('fuso')??'America/Sao_Paulo';
 try{new Intl.DateTimeFormat('pt-BR',{timeZone:fuso}).format();}catch{throw Error('Fuso horário inválido.');}
 const mes=params.get('mes')??diaLocalISO(agora,fuso).slice(0,7);
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes))throw Error('Mês inválido.');
 const dias=diasDaGrade(mes);
 const instante=(dia:string)=>{
  const [ano,mes,d]=dia.split('-').map(Number);return instanteDe({ano,mes,dia:d},fuso).toISOString();
 };
 const fim=new Date(dias.at(-1)!+'T12:00:00Z');fim.setUTCDate(fim.getUTCDate()+1);
 return {mes,fuso,de:instante(dias[0]),ate:instante(fim.toISOString().slice(0,10))};
}
