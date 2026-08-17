import { classificarSituacaoContato } from '../../app/src/lib/situacaoContato.ts';

// Gate da release P0: cada situação exibida na campanha precisa ser inequívoca.
let falhas = 0;
function ok(condicao: boolean, descricao: string) {
  if (!condicao) { console.error(`  FALHOU - ${descricao}`); falhas++; }
  else console.log(`  ok  - ${descricao}`);
}

ok(classificarSituacaoContato(['enviado'], false) === 'sem_resposta', 'enviado sem inbound -> sem resposta');
ok(classificarSituacaoContato(['enviado', 'recebido'], false) === 'respondido', 'inbound comum -> respondeu');
ok(classificarSituacaoContato(['enviado', 'optout'], true) === 'optout', 'SAIR -> opt-out');
ok(classificarSituacaoContato(['bloqueado_supressao'], false) === 'bloqueado', 'supressão no histórico -> bloqueado');
ok(classificarSituacaoContato([], true) === 'bloqueado', 'supressão atual -> bloqueado');
ok(classificarSituacaoContato(['enviado', 'erro'], false) === 'erro', 'última tentativa com erro -> erro');
ok(classificarSituacaoContato([], false) === 'nao_contatado', 'sem histórico -> não contatado');

process.exit(falhas ? 1 : 0);
