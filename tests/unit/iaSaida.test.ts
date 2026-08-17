import { validarMensagemWhatsApp } from '../../app/src/lib/ia.ts';

let falhas = 0;
function ok(condicao: boolean, descricao: string) {
  if (!condicao) { console.error(`  FALHOU - ${descricao}`); falhas++; }
  else console.log(`  ok  - ${descricao}`);
}

ok(
  !validarMensagemWhatsApp('Drafting Strategy:**\n*').ok,
  'bloqueia rascunho interno do modelo',
);
ok(
  !validarMensagemWhatsApp('Olá, Carol! Aqui é o').ok,
  'bloqueia mensagem curta e truncada',
);
ok(
  !validarMensagemWhatsApp('Olá, Carol! Aqui é o Guilherme,').ok,
  'bloqueia frase terminada em pontuação de continuação',
);
const valida = validarMensagemWhatsApp(
  'Olá, Carol! Aqui é o Guilherme, da Figueira Marketing. Posso enviar uma apresentação rápida?\n\nQUERO RECEBER\nNÃO QUERO RECEBER',
);
ok(valida.ok, 'aceita mensagem final completa');
ok(valida.ok && !valida.texto.includes('```'), 'remove cerca de código sem alterar mensagem válida');

process.exit(falhas ? 1 : 0);
