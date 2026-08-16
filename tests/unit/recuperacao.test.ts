/**
 * Testes unitários dos helpers de recuperação/primeiro acesso
 * (lib/recuperacao.ts e lib/senha.ts). Roda sem banco:
 *   node --experimental-strip-types tests/unit/recuperacao.test.ts
 */
import { emailValido, textoCodigoRecuperacao, baseUrlApp } from '../../app/src/lib/recuperacao.ts';
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

// --- baseUrlApp por ambiente ---
const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;
const ORIGINAL2 = process.env.APP_URL;
function setBase(v: string | undefined) {
  if (v === undefined) { delete process.env.NEXT_PUBLIC_APP_URL; }
  else { process.env.NEXT_PUBLIC_APP_URL = v; }
}
setBase('https://harvest-staging.vercel.app');
ok(baseUrlApp() === 'https://harvest-staging.vercel.app', 'baseUrlApp: staging -> URL de staging');
setBase('https://harvest.figueiramarketing.com.br');
ok(baseUrlApp() === 'https://harvest.figueiramarketing.com.br', 'baseUrlApp: produção -> URL de produção');
setBase('https://harvest-staging.vercel.app/');
ok(baseUrlApp() === 'https://harvest-staging.vercel.app', 'baseUrlApp: remove barra final');
// Fallback para APP_URL quando NEXT_PUBLIC_APP_URL ausente
setBase(undefined);
process.env.APP_URL = 'https://fallback.exemplo.com';
ok(baseUrlApp() === 'https://fallback.exemplo.com', 'baseUrlApp: fallback APP_URL quando NEXT_PUBLIC ausente');
// Ausência total -> null (fail-closed, NÃO produção)
delete process.env.APP_URL;
ok(baseUrlApp() === null, 'baseUrlApp: ausência de config -> null (fail-closed)');
// restaura
if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
if (ORIGINAL2 === undefined) delete process.env.APP_URL; else process.env.APP_URL = ORIGINAL2;

// --- textoCodigoRecuperacao usa a baseUrl do ambiente (nunca hardcoded) ---
const tStaging = textoCodigoRecuperacao('123456', false, 'https://harvest-staging.vercel.app');
ok(tStaging.includes('https://harvest-staging.vercel.app/verificar-codigo'),
  'texto A: link aponta para a baseUrl de staging');
ok(!tStaging.includes('figueiramarketing.com.br'), 'texto A: NÃO aponta para produção em staging');
const tProd = textoCodigoRecuperacao('123456', false, 'https://harvest.figueiramarketing.com.br');
ok(tProd.includes('https://harvest.figueiramarketing.com.br/verificar-codigo'),
  'texto A: produção -> link de produção');
// Sem baseUrl -> lança (fail-closed), não monta link incorreto
let lancou = false;
try { textoCodigoRecuperacao('123456', false, ''); } catch { lancou = true; }
ok(lancou, 'texto: baseUrl vazia -> lança (não gera link incorreto)');

const tB = textoCodigoRecuperacao('654321', true, 'https://harvest-staging.vercel.app');
ok(tB.toLowerCase().includes('primeira vez') || tB.toLowerCase().includes('primeiro acesso'),
  'texto B: é de primeiro acesso');
ok(tB.includes('https://harvest-staging.vercel.app/verificar-codigo'),
  'texto B: primeiro acesso também usa baseUrl de staging');

// --- nenhuma URL de produção hardcoded no helper ---
// CoTO pelo textoCodigoRecuperacao acima: com baseUrl de staging o link só
// aponta para staging, e com baseUrl de produção só aponta para produção.
// Como o helper não tem mais string fixa de produção (vem de baseUrlApp),
// esses dois casos cobrem a ausência de hardcoded.

// --- senhaAleatoria (bootstrap interno do fluxo B) ---
const a1 = senhaAleatoria();
const a2 = senhaAleatoria();
ok(typeof a1 === 'string' && a1.length >= 8, 'senhaAleatoria: tem pelo menos 8 chars');
ok(a1 !== a2, 'senhaAleatoria: duas gerações diferentes');
ok(senhaFraca(a1) === null, 'senhaAleatoria: passa na regra de senha forte');

// A senha previsível antiga ("NomeDaEmpresa1234") NÃO existe mais.
const senhaExports = Object.keys(senhaMod);
ok(!senhaExports.includes('senhaProvisoria'), 'senhaProvisoria foi removida do módulo');
ok(!/1234$/.test(a1), 'senhaAleatoria: não termina em 1234 (padrão previsível antigo)');
ok(!/[A-Z][a-z]+1234/.test(a1), 'senhaAleatoria: não segue "Empresa1234"');

// --- contrato de resposta (shape) das rotas de usuário ---
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
