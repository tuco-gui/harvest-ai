import {CATALOGO_AGENTES,type TipoAgente} from './agentes.ts';

/** Modelos são sugestões para instanciar, nunca seeds de agentes operacionais. */
export const MODELOS_AGENTES={
 recepcao:{tipo:'recepcao',nome:'Recepcionista',instrucao:CATALOGO_AGENTES.recepcao.instrucao},
 bdr:{tipo:'bdr',nome:'BDR',instrucao:CATALOGO_AGENTES.bdr.instrucao},
 vendas:{tipo:'vendas',nome:'Consultor de vendas',instrucao:CATALOGO_AGENTES.vendas.instrucao},
 suporte:{tipo:'suporte',nome:'Suporte',instrucao:CATALOGO_AGENTES.suporte.instrucao},
 financeiro:{tipo:'financeiro',nome:'Financeiro',instrucao:CATALOGO_AGENTES.financeiro.instrucao},
 bdr_imobiliario:{tipo:'bdr',nome:'BDR Imobiliário',instrucao:'Você é o BDR imobiliário da empresa desta workspace. Qualifique interesse, moradia ou investimento, prazo, financiamento e disponibilidade. Use somente a ficha aprovada do imóvel. Não invente condições, aprovação de crédito ou agenda. Renda em faixa é facultativa. Encaminhe negociação, visitas e dúvidas fora da base a um corretor humano.'},
} satisfies Record<string,{tipo:TipoAgente;nome:string;instrucao:string}>;
export type ConfigAgente={modelo:keyof typeof MODELOS_AGENTES;conhecimento:string;canais:number[];funis:number[];
 horario_inicio:number;horario_fim:number;fuso:string;autonomia:'manual'|'rascunho';transferencia:string};
export function configuracaoPadrao(tipo:TipoAgente):ConfigAgente{return {modelo:tipo,conhecimento:'',canais:[],funis:[],horario_inicio:9,horario_fim:19,fuso:'America/Sao_Paulo',autonomia:'manual',transferencia:'Encaminhar pedido de humano, opt-out, conflito ou assunto fora da base. Não transferir automaticamente sem homologação.'};}
export function validarConfigAgente(tipo:TipoAgente,c:unknown):c is ConfigAgente{
 if(!c||typeof c!=='object'||Array.isArray(c))return false;
 const x=c as ConfigAgente;
 return Object.hasOwn(MODELOS_AGENTES,x.modelo)&&MODELOS_AGENTES[x.modelo].tipo===tipo&&
  typeof x.conhecimento==='string'&&x.conhecimento.length<=16000&&typeof x.transferencia==='string'&&x.transferencia.length>=10&&x.transferencia.length<=2000&&
  ['canais','funis'].every(k=>Array.isArray(x[k as 'canais'])&&x[k as 'canais'].length<=30&&x[k as 'canais'].every(id=>Number.isSafeInteger(id)&&id>0))&&
  Number.isInteger(x.horario_inicio)&&Number.isInteger(x.horario_fim)&&x.horario_inicio>=0&&x.horario_fim<=24&&x.horario_fim>x.horario_inicio&&
  x.fuso==='America/Sao_Paulo'&&['manual','rascunho'].includes(x.autonomia);
}
