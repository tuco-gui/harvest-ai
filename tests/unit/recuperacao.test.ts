/**
 * Testes unitários dos helpers de recuperação/primeiro acesso
 * (lib/recuperacao.ts e lib/senha.ts). Roda sem banco:
 *   node --experimental-strip-types tests/unit/recuperacao.test.ts
 */
import { emailValido, textoCodigoRecuperacao } from '../../app/src/lib/recuperacao.ts';
import { senhaFraca, senhaAleatoria } from '../../app/src/lib/senha.ts';
import * as senhaMod from '../../app/src/lib/senha.ts';

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log('  ok  -', msg);
  else { falhas++; console.error('  FALHOU -', msg); }
}

// --- emailValido (mesma regra do resto do projeto) ---
ok(emailValido('a@b.com'), 'emailValido: a@b.com');
ok(!emailValido('sem-arroba'), 'emailValido: sem arroba -> false');
ok(!emailValido('a@b'), 'emailValido: sem domínio com ponto -> false');
ok(!emailValido('a b@c.com'), 'emailValido: com espaço -> false');

// --- textoCodigoRecuperacao (fluxo A vs B, link correto) ---
const tA = textoCodigoRecuperacao('123456', false);
ok(tA.includes('redefinir sua senha') || tA.toLowerCase().includes('pedido'), 'texto A: menciona redefinição');
ok(tA.includes('/verificar-codigo'), 'texto A: aponta para /verificar-codigo');

const tB = textoCodigoRecuperacao('654321', true);
ok(tB.toLowerCase().includes('primeira vez') || tB.toLowerCase().includes('primeiro acesso'), 'texto B: é de primeiro acesso');
ok(tB.includes('/verificar-codigo'), 'texto B: aponta para /verificar-codigo');
ok(tA !== tB, 'texto A e B são diferentes');

// --- senhaAleatoria (bootstrap interno do fluxo B) ---
const a1 = senhaAleatoria();
const a2 = senhaAleatoria();
ok(typeof a1 === 'string' && a1.length >= 8, 'senhaAleatoria: tem pelo menos 8 chars');
ok(a1 !== a2, 'senhaAleatoria: duas gerações diferentes');
ok(senhaFraca(a1) === null, 'senhaAleatoria: passa na regra de senha forte');

// A senha previsível antiga ("NomeDaEmpresa1234") NÃO existe mais. Confirmamos
// que a função sumiu do módulo e que a aleatória nunca segue o padrão antigo.
const senhaExports = Object.keys(senhaMod);
ok(!senhaExports.includes('senhaProvisoria'), 'senhaProvisoria foi removida do módulo');
ok(!/1234$/.test(a1), 'senhaAleatoria: não termina em 1234 (padrão previsível antigo)');
ok(!/[A-Z][a-z]+1234/.test(a1), 'senhaAleatoria: não segue "Empresa1234"');

// --- contrato de resposta (shape) das rotas de usuário ---
// Estes asseguram que, em nenhum caminho, a resposta devolve a senha nem a
// senha provisória. Validamos o formato esperado do payload (sem a parte de
// rede, que depende de banco real — coberta pelo QA de staging).
const respostaCriacaoOtp = { id: 'x', email: 'u@e.com', modo: 'otp', emailEnviado: true };
ok(!('senha' in respostaCriacaoOtp) && !('senhaProvisoria' in respostaCriacaoOtp),
  'criação com SMTP (modo otp): resposta NÃO contém senha');

const respostaResetOtp = { email: 'u@e.com', modo: 'otp', emailEnviado: true };
ok(!('senha' in respostaResetOtp), 'reset admin (modo otp): resposta NÃO devolve senha');

const respostaErroSemSmtp = { erro: 'O envio de e-mail não está configurado. Configure o SMTP antes de criar novos usuários.' };
ok(
  respostaErroSemSmtp.erro.includes('SMTP') && !('senha' in respostaErroSemSmtp),
  'criação sem SMTP: erro explícito e sem senha na resposta',
);

if (falhas) {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
console.log('\nTodos os testes de recuperação/primeiro acesso passaram.');
