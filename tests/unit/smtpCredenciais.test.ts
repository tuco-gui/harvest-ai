/**
 * Testes para resolverCredenciaisSmtp — fail-closed por ambiente.
 * Roda sem banco: node --experimental-strip-types tests/unit/smtpCredenciais.test.ts
 */

import { detectarAmbiente, resolverCredenciaisSmtp } from '../../app/src/lib/smtpCredenciais.ts';
import { configuracaoSmtp } from '../../app/src/lib/email.ts';

// Mock simples para configuracaoSmtp (evita conexão real com Supabase)
let mockConfiguracaoSmtpBanco: any = null;

// Sobrescreve a função importada
import * as emailModule from '../../app/src/lib/email.ts';
(emailModule as any).configuracaoSmtp = async () => mockConfiguracaoSmtpBanco;

function setEnv(env: Record<string, string | undefined>) {
  const backup: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    backup[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  return backup;
}

function restoreEnv(backup: Record<string, string | undefined>) {
  for (const key of Object.keys(backup)) {
    if (backup[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = backup[key];
    }
  }
}

let originalExistsSync: any = null;

function mockFsExistsSecrets(exists: boolean) {
  const fs = require('fs');
  if (originalExistsSync === null) {
    originalExistsSync = fs.existsSync;
  }
  fs.existsSync = (path: string) => {
    if (path === '/run/secrets') return exists;
    return originalExistsSync(path);
  };
}

function restoreFs() {
  if (originalExistsSync !== null) {
    const fs = require('fs');
    fs.existsSync = originalExistsSync;
    originalExistsSync = null;
  }
}

console.log('=== Testes smtpCredenciais ===\n');

let passou = 0;
let falhou = 0;

function assert(condicao: boolean, msg: string) {
  if (condicao) {
    console.log(`  ok  - ${msg}`);
    passou++;
  } else {
    console.error(`  FAIL - ${msg}`);
    falhou++;
  }
}

// Teste 1: detectarAmbiente - staging explícito
{
  const backup = setEnv({ NEXT_PUBLIC_AMBIENTE: 'staging', NODE_ENV: 'production' });
  const amb = detectarAmbiente();
  assert(amb === 'staging', 'detectarAmbiente: NEXT_PUBLIC_AMBIENTE=staging → staging');
  restoreEnv(backup);
}

// Teste 2: detectarAmbiente - produção via Docker Secrets
{
  const backup = setEnv({ NEXT_PUBLIC_AMBIENTE: undefined, NODE_ENV: 'production' });
  mockFsExistsSecrets(true);
  const amb = detectarAmbiente();
  assert(amb === 'producao', 'detectarAmbiente: /run/secrets existe → producao');
  restoreFs();
  restoreEnv(backup);
}

// Teste 3: detectarAmbiente - produção implícita (NODE_ENV=production)
{
  const backup = setEnv({ NEXT_PUBLIC_AMBIENTE: undefined, NODE_ENV: 'production' });
  mockFsExistsSecrets(false);
  const amb = detectarAmbiente();
  assert(amb === 'producao', 'detectarAmbiente: NODE_ENV=production sem secrets → producao');
  restoreFs();
  restoreEnv(backup);
}

// Teste 4: detectarAmbiente - development (padrão)
{
  const backup = setEnv({ NEXT_PUBLIC_AMBIENTE: undefined, NODE_ENV: 'development' });
  mockFsExistsSecrets(false);
  const amb = detectarAmbiente();
  assert(amb === 'development', 'detectarAmbiente: NODE_ENV=development → development');
  restoreFs();
  restoreEnv(backup);
}

// Teste 5: staging com runtime completo → OK
{
  const backup = setEnv({
    NEXT_PUBLIC_AMBIENTE: 'staging',
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: '587',
    SMTP_USER: 'user@test.com',
    SMTP_PASSWORD: 'senha-segura',
    SMTP_FROM: 'Test <no-reply@test.com>',
    SMTP_REPLY_TO: 'contato@test.com',
  });
  mockConfiguracaoSmtpBanco = { smtp_host: 'banco.host', smtp_usuario: 'banco@user', smtp_senha: 'banco-senha' };
  const creds = await resolverCredenciaisSmtp();
  assert(creds !== null, 'staging + runtime completo → credenciais resolvidas');
  assert(creds?.fonte === 'runtime', 'staging + runtime completo → fonte=runtime');
  assert(creds?.host === 'smtp-relay.brevo.com', 'staging + runtime → host do runtime');
  restoreEnv(backup);
}

// Teste 6: staging SEM password → FAIL (não cai para banco)
{
  const backup = setEnv({
    NEXT_PUBLIC_AMBIENTE: 'staging',
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: '587',
    SMTP_USER: 'user@test.com',
    // SMTP_PASSWORD ausente
    SMTP_FROM: 'Test <no-reply@test.com>',
  });
  mockConfiguracaoSmtpBanco = { smtp_host: 'banco.host', smtp_usuario: 'banco@user', smtp_senha: 'banco-senha' };
  const creds = await resolverCredenciaisSmtp();
  assert(creds === null, 'staging sem SMTP_PASSWORD → null (fail-closed)');
  restoreEnv(backup);
}

// Teste 7: staging com credenciais SOMENTE no banco → FAIL (não usa banco)
{
  const backup = setEnv({
    NEXT_PUBLIC_AMBIENTE: 'staging',
    // SEM variáveis SMTP_*
  });
  mockConfiguracaoSmtpBanco = { smtp_host: 'banco.host', smtp_usuario: 'banco@user', smtp_senha: 'banco-senha' };
  const creds = await resolverCredenciaisSmtp();
  assert(creds === null, 'staging sem runtime, só banco → null (fail-closed)');
  restoreEnv(backup);
}

// Teste 8: produção sem Docker Secrets → FAIL
{
  const backup = setEnv({
    NEXT_PUBLIC_AMBIENTE: undefined,
    NODE_ENV: 'production',
    // SEM variáveis SMTP_*
  });
  mockFsExistsSecrets(false);
  mockConfiguracaoSmtpBanco = { smtp_host: 'banco.host', smtp_usuario: 'banco@user', smtp_senha: 'banco-senha' };
  const creds = await resolverCredenciaisSmtp();
  assert(creds === null, 'produção sem secrets nem runtime → null (fail-closed)');
  restoreFs();
  restoreEnv(backup);
}

// Teste 9: development sem runtime + banco legacy → compatibilidade
{
  const backup = setEnv({
    NEXT_PUBLIC_AMBIENTE: undefined,
    NODE_ENV: 'development',
    // SEM variáveis SMTP_*
  });
  mockFsExistsSecrets(false);
  mockConfiguracaoSmtpBanco = { smtp_host: 'banco.host', smtp_usuario: 'banco@user', smtp_senha: 'banco-senha' };
  const creds = await resolverCredenciaisSmtp();
  assert(creds !== null, 'development sem runtime + banco legacy → credenciais do banco');
  assert(creds?.fonte === 'banco', 'development + banco legacy → fonte=banco');
  assert(creds?.host === 'banco.host', 'development + banco → host do banco');
  restoreFs();
  restoreEnv(backup);
}

// Teste 10: development sem runtime SEM banco → null
{
  const backup = setEnv({
    NEXT_PUBLIC_AMBIENTE: undefined,
    NODE_ENV: 'development',
  });
  mockFsExistsSecrets(false);
  mockConfiguracaoSmtpBanco = null;
  const creds = await resolverCredenciaisSmtp();
  assert(creds === null, 'development sem runtime nem banco → null');
  restoreFs();
  restoreEnv(backup);
}

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou > 0) process.exit(1);