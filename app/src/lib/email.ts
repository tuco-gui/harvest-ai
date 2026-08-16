import nodemailer from 'nodemailer';
import { supabaseAdmin } from './supabase/server';
import { resolverCredenciaisSmtp } from './smtpCredenciais';

export type ConfigSmtp = {
  smtp_host: string | null;
  smtp_porta: number | null;
  smtp_usuario: string | null;
  smtp_senha: string | null;
  smtp_remetente: string | null;
  smtp_reply_to: string | null;
};

/** Lê configuração legada do banco (desenvolvimento/local). */
export async function configuracaoSmtp(): Promise<ConfigSmtp | null> {
  const { data } = await supabaseAdmin().from('config_sistema').select('*').eq('id', 1).maybeSingle();
  if (!data?.smtp_host || !data.smtp_usuario || !data.smtp_senha) return null;
  return data as ConfigSmtp;
}

function transportador(cfg: ConfigSmtp) {
  return nodemailer.createTransport({
    host: cfg.smtp_host!,
    port: cfg.smtp_porta ?? 587,
    secure: (cfg.smtp_porta ?? 587) === 465,
    auth: { user: cfg.smtp_usuario!, pass: cfg.smtp_senha! },
  });
}

function transportadorResolvido(creds: { host: string; porta: number; usuario: string; senha: string }) {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.porta,
    secure: creds.porta === 465,
    auth: { user: creds.usuario, pass: creds.senha },
  });
}

function emailOptions(cfg: { remetente?: string | null; replyTo?: string | null }, destino: string, assunto: string, texto: string) {
  const opts: any = {
    from: cfg.remetente || cfg.replyTo || 'Harvest AI <no-reply@figueiramarketing.com.br>',
    to: destino,
    subject: assunto,
    text: texto,
  };
  if (cfg.replyTo) {
    opts.replyTo = cfg.replyTo;
  }
  return opts;
}

/** Manda e-mail usando credenciais resolvidas (runtime > banco). Silencioso quando não está configurado. */
export async function enviarEmail(destino: string, assunto: string, texto: string): Promise<boolean> {
  const creds = await resolverCredenciaisSmtp();
  if (!creds) return false;
  try {
    await transportadorResolvido(creds).sendMail(emailOptions(creds, destino, assunto, texto));
    return true;
  } catch {
    return false;
  }
}

export async function testarSmtp(cfg: ConfigSmtp, destino: string): Promise<string | null> {
  try {
    await transportador(cfg).sendMail(emailOptions({
      remetente: cfg.smtp_remetente,
      replyTo: cfg.smtp_reply_to,
    }, destino, 'Teste de SMTP — Harvest AI', 'Se esta mensagem chegou, o SMTP está configurado corretamente.'));
    return null;
  } catch (e: any) {
    return e?.message ?? 'Não consegui enviar.';
  }
}

export async function testarSmtpResolvido(destino: string): Promise<string | null> {
  const creds = await resolverCredenciaisSmtp();
  if (!creds) return 'SMTP não configurado.';
  try {
    await transportadorResolvido(creds).sendMail(emailOptions(creds, destino, 'Teste de SMTP — Harvest AI', 'Se esta mensagem chegou, o SMTP está configurado corretamente.'));
    return null;
  } catch (e: any) {
    return e?.message ?? 'Não consegui enviar.';
  }
}