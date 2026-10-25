import assert from 'node:assert/strict';
import { chaveAtendimento, validarCanalAtendimento, montarConversasPorCanal } from '../../app/src/lib/crmAtendimentos.ts';
assert.equal(chaveAtendimento('5514999991111',null),'5514999991111:0');
assert.notEqual(chaveAtendimento('5514999991111',7),chaveAtendimento('5514999991111',8));
assert.equal(validarCanalAtendimento('0'),null);
assert.equal(validarCanalAtendimento(7),7);
assert.equal(validarCanalAtendimento('8'),8);
assert.equal(validarCanalAtendimento('-1'),undefined);
assert.equal(validarCanalAtendimento('abc'),undefined);
assert.equal(validarCanalAtendimento('9007199254740993'),undefined);
const mk=(canal_id:number|null,recebido_em:string,mensagem:string)=>({
 telefone:'5514999991111',canal_id,nome_contato:'Contato',
 mensagem,recebido_em,lead_id:1,funil_id:canal_id===7?35:null,
});
const eventos=[
 mk(7,'2026-10-25T14:00:00Z','WhatsApp do Comercial'),
 mk(8,'2026-10-25T13:00:00Z','WhatsApp Prospecção'),
 mk(null,'2026-10-25T12:00:00Z','Histórico antigo'),
];
const meta=(canal_id:number|null,responsavel_id:string,status:'aberto'|'pendente'|'resolvido')=>({
 canal_id,telefone:'5514999991111',responsavel_id,status,
 etiquetas:[],prioridade:'normal' as const,atualizado_em:'2026-10-25T13:00:00Z',
 prazo_triagem_em:null,resolvido_em:null,
});
const m=[meta(7,'operador-7','pendente'),meta(8,'operador-8','resolvido'),meta(null,'operador-antigo','aberto')];
const adm=montarConversasPorCanal(eventos,m,{id:'adm',papel:'admin'});
assert.equal(adm.length,3,'mesmo telefone atendido em 2 números mantém 3 fichas independentes');
assert.deepEqual(adm.map(c=>c.canalId),[7,8,null]);
assert.equal(adm[0].status,'pendente');
assert.equal(adm[1].status,'resolvido');
assert.equal(adm[2].status,'aberto');
assert.equal(adm[0].funilSugeridoId,35);
assert(adm.every(c=>c.total===1 && !c.canalAmbiguo));
const oper=montarConversasPorCanal(eventos,m,{id:'operador-8',papel:'operador'});
assert.equal(oper.length,1);
assert.equal(oper[0].canalId,8);
assert.equal(montarConversasPorCanal(eventos,[],{id:'sem-atribuicao',papel:'operador'}).length,0);
console.log('Atendimento por canal: identidade, legado, proprietário, SLA e permissões OK');