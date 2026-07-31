import nodemailer from 'nodemailer';
import { supabaseAdmin } from './supabase/server';

export type ConfigSmtp = {
  smtp_host: string | null;
  smtp_porta: number | null;
  smtp_usuario: string | null;
  smtp_senha: string | null;
  smtp_remetente: string | null;
};

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

/** Manda e-mail se o SMTP estiver configurado. Silencioso quando não está —
 *  a credencial sempre aparece na tela também, então o e-mail é um extra. */
export async function enviarEmail(destino: string, assunto: string, texto: string): Promise<boolean> {
  const cfg = await configuracaoSmtp();
  if (!cfg) return false;
  try {
    await transportador(cfg).sendMail({
      from: cfg.smtp_remetente || cfg.smtp_usuario!,
      to: destino,
      subject: assunto,
      text: texto,
    });
    return true;
  } catch {
    return false;
  }
}

export async function testarSmtp(cfg: ConfigSmtp, destino: string): Promise<string | null> {
  try {
    await transportador(cfg).sendMail({
      from: cfg.smtp_remetente || cfg.smtp_usuario!,
      to: destino,
      subject: 'Teste de SMTP — Harvest AI',
      text: 'Se esta mensagem chegou, o SMTP está configurado corretamente.',
    });
    return null;
  } catch (e: any) {
    return e?.message ?? 'Não consegui enviar.';
  }
}
