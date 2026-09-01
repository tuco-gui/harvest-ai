/**
 * Testes unitários dos helpers de "esqueci minha senha" (lib/recuperacao.ts).
 * Roda sem banco: node --experimental-strip-types tests/unit/recuperacao.test.ts
 */
import { emailValido, textoCodigoRecuperacao, baseUrlApp } from '../../app/src/lib/recuperacao.ts';

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
const tStaging = textoCodigoRecuperacao('123456', 'https://harvest-staging.vercel.app');
ok(tStaging.includes('https://harvest-staging.vercel.app/verificar-codigo'),
  'texto: link aponta para a baseUrl de staging');
ok(!tStaging.includes('figueiramarketing.com.br'), 'texto: NÃO aponta para produção em staging');
const tProd = textoCodigoRecuperacao('123456', 'https://harvest.figueiramarketing.com.br');
ok(tProd.includes('https://harvest.figueiramarketing.com.br/verificar-codigo'),
  'texto: produção -> link de produção');
// Sem baseUrl -> lança (fail-closed), não monta link incorreto
let lancou = false;
try { textoCodigoRecuperacao('123456', ''); } catch { lancou = true; }
ok(lancou, 'texto: baseUrl vazia -> lança (não gera link incorreto)');

if (falhas) {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
console.log('\nTodos os testes de recuperação de senha passaram.');
