/**
 * Resolvedor de credenciais SMTP por ambiente — FAIL-CLOSED em staging/produção.
 * 
 * STAGING (Vercel): usa Environment Variables protegidas do projeto Vercel
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASSWORD
 * - SMTP_FROM
 * - SMTP_REPLY_TO
 * 
 * PRODUÇÃO (Docker Swarm): usa Docker Secrets
 * - /run/secrets/harvest_smtp_host
 * - /run/secrets/harvest_smtp_port
 * - /run/secrets/harvest_smtp_user
 * - /run/secrets/harvest_smtp_password
 * - /run/secrets/harvest_smtp_from
 * - /run/secrets/harvest_smtp_reply_to
 * 
 * DESENVOLVIMENTO/LOCAL (fallback permitido): usa config_sistema do banco
 * APENAS quando NÃO estiver em staging/produção.
 * 
 * NUNCA retornar segredos ao frontend.
 */

import { configuracaoSmtp as configuracaoSmtpBanco } from './email';

export type SmtpCredenciaisResolvidas = {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  remetente: string;
  replyTo: string | null;
  fonte: 'runtime' | 'banco';
};

export type AmbienteSmtp = 'staging' | 'producao' | 'development' | 'desconhecido';

/**
 * Detecta o ambiente de execução baseado em variáveis de ambiente e filesystem.
 * STAGING: NEXT_PUBLIC_AMBIENTE === 'staging' (Vercel)
 * PRODUÇÃO: existe /run/secrets/ (Docker Swarm) OU NODE_ENV=production sem staging
 * DESENVOLVIMENTO: padrão quando nenhum dos acima
 */
function detectarAmbiente(): AmbienteSmtp {
  // STAGING explícito (Vercel)
  if (process.env.NEXT_PUBLIC_AMBIENTE === 'staging') {
    return 'staging';
  }

  // PRODUÇÃO: Docker Secrets presentes (Swarm)
  try {
    const fs = require('fs');
    if (fs.existsSync('/run/secrets')) {
      return 'producao';
    }
  } catch {
    // ignora
  }

  // PRODUÇÃO implícita: NODE_ENV=production sem staging
  if (process.env.NODE_ENV === 'production') {
    return 'producao';
  }

  // DESENVOLVIMENTO/LOCAL
  return 'development';
}

function lerDockerSecret(caminho: string): string | null {
  try {
    const fs = require('fs');
    if (fs.existsSync(caminho)) {
      return fs.readFileSync(caminho, 'utf-8').trim();
    }
  } catch {
    // ignora erros de leitura
  }
  return null;
}

function resolverDoRuntime(): SmtpCredenciaisResolvidas | null {
  const ambiente = detectarAmbiente();

  // STAGING (Vercel) - Environment Variables
  const host = process.env.SMTP_HOST;
  const porta = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const usuario = process.env.SMTP_USER;
  const senha = process.env.SMTP_PASSWORD;
  const remetente = process.env.SMTP_FROM;
  const replyTo = process.env.SMTP_REPLY_TO || null;

  if (host && usuario && senha) {
    return {
      host,
      porta,
      usuario,
      senha,
      remetente: remetente || usuario,
      replyTo,
      fonte: 'runtime',
    };
  }

  // PRODUÇÃO (Docker Swarm) - Docker Secrets
  if (ambiente === 'producao') {
    const hostSecret = lerDockerSecret('/run/secrets/harvest_smtp_host');
    const portaSecret = lerDockerSecret('/run/secrets/harvest_smtp_port');
    const usuarioSecret = lerDockerSecret('/run/secrets/harvest_smtp_user');
    const senhaSecret = lerDockerSecret('/run/secrets/harvest_smtp_password');
    const remetenteSecret = lerDockerSecret('/run/secrets/harvest_smtp_from');
    const replyToSecret = lerDockerSecret('/run/secrets/harvest_smtp_reply_to');

    if (hostSecret && usuarioSecret && senhaSecret) {
      return {
        host: hostSecret,
        porta: portaSecret ? parseInt(portaSecret, 10) : 587,
        usuario: usuarioSecret,
        senha: senhaSecret,
        remetente: remetenteSecret || usuarioSecret,
        replyTo: replyToSecret || null,
        fonte: 'runtime',
      };
    }
  }

  return null;
}

/**
 * Resolve credenciais SMTP com FAIL-CLOSED em staging/produção.
 * 
 * Regras:
 * - STAGING/PRODUÇÃO: SOMENTE runtime (Vercel env vars / Docker Secrets).
 *   Se faltar qualquer credencial → null (FALHA).
 * - DESENVOLVIMENTO: runtime → banco legacy (compatibilidade).
 * 
 * Retorna null se não houver credenciais válidas para o ambiente.
 */
export async function resolverCredenciaisSmtp(): Promise<SmtpCredenciaisResolvidas | null> {
  const ambiente = detectarAmbiente();

  // 1. Tentar runtime (obrigatório em staging/produção)
  const runtime = resolverDoRuntime();
  if (runtime) {
    return runtime;
  }

  // 2. FAIL-CLOSED: em staging/produção, NÃO faz fallback para banco
  if (ambiente === 'staging' || ambiente === 'producao') {
    return null;
  }

  // 3. DESENVOLVIMENTO/LOCAL: fallback para banco legacy (compatibilidade)
  const banco = await configuracaoSmtpBanco();
  if (banco?.smtp_host && banco.smtp_usuario && banco.smtp_senha) {
    return {
      host: banco.smtp_host,
      porta: banco.smtp_porta ?? 587,
      usuario: banco.smtp_usuario,
      senha: banco.smtp_senha,
      remetente: banco.smtp_remetente || banco.smtp_usuario,
      replyTo: banco.smtp_reply_to || null,
      fonte: 'banco',
    };
  }

  return null;
}

/**
 * Verifica se as credenciais SMTP estão disponíveis para o ambiente atual.
 * Em staging/produção, retorna false se runtime não estiver completo.
 */
export async function smtpConfigurado(): Promise<boolean> {
  const creds = await resolverCredenciaisSmtp();
  return !!creds;
}

/**
 * Obtém metadados não sensíveis para UI/health check.
 * Inclui o ambiente detectado para diagnóstico.
 */
export async function metadadosSmtp(): Promise<{
  configurado: boolean;
  host: string | null;
  porta: number | null;
  usuario: string | null;
  remetente: string | null;
  replyTo: string | null;
  fonte: 'runtime' | 'banco' | 'nenhuma';
  ambiente: AmbienteSmtp;
}> {
  const ambiente = detectarAmbiente();
  const creds = await resolverCredenciaisSmtp();
  
  if (!creds) {
    return {
      configurado: false,
      host: null,
      porta: null,
      usuario: null,
      remetente: null,
      replyTo: null,
      fonte: 'nenhuma',
      ambiente,
    };
  }

  return {
    configurado: true,
    host: creds.host,
    porta: creds.porta,
    usuario: creds.usuario,
    remetente: creds.remetente,
    replyTo: creds.replyTo,
    fonte: creds.fonte,
    ambiente,
  };
}

/**
 * Exporta detector de ambiente para testes.
 */
export { detectarAmbiente };