import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { enviarEmail } from '@/lib/email';
import { gerarCodigoRecuperacao, textoCodigoRecuperacao, baseUrlApp } from '@/lib/recuperacao';

/**
 * Esqueci minha senha — gera um código OTP de 6 dígitos e manda por e-mail.
 *
 * Anti-enumeração: não revela se o e-mail existe ou se o SMTP está ok.
 * Falha silenciosa vira 200 genérico igual ao sucesso, para um atacante não
 * mapear quais e-mails têm conta no Harvest. (Em staging isso é ruído, mas em
 * produção é o comportamento esperado de um fluxo self-service.)
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}) as any);
  const email = String(b.email ?? '').trim().toLowerCase();

  // Só a checagem de FORMATO falha rápido — e mesmo assim não diz "esse e-mail
  // não tem conta", diz que o formato está errado. O resto é sempre 200.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ erro: 'Informe um e-mail válido.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const res = await gerarCodigoRecuperacao(admin, email);

  // Link do e-mail usa a base URL do ambiente (NEXT_PUBLIC_APP_URL). Sem ela,
  // não montamos link nenhum — fail-closed (não apontamos para produção). O
  // fluxo público continua 200 genérico para não vazar nada; o erro técnico
  // fica só no log interno (sem segredo).
  const baseUrl = baseUrlApp();
  if ('codigo' in res) {
    if (baseUrl) {
      await enviarEmail(
        email,
        'Redefinir sua senha no Harvest AI',
        textoCodigoRecuperacao(res.codigo, baseUrl),
      );
    } else {
      console.error('[esqueci-senha] NEXT_PUBLIC_APP_URL ausente: não foi possível enviar o e-mail de recuperação.');
    }
  }
  // Se deu erro (usuário inexistente, e-mail não confirmado etc.), caímos no
  // 200 genérico abaixo sem enviar nada.

  // ponytail: sem rate-limit aqui. O Supabase já limita a (re)geração de OTP
  // por e-mail, mas um atacante ainda pode fazer "OTP bombing" de um e-mail
  // de terceiro. Upgrade: throttling por IP+e-mail (ex.: Upstash/KV) antes de
  // chamar gerarCodigoRecuperacao — fora de escopo desta entrega.
  return NextResponse.json({
    ok: true,
    mensagem: 'Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos para ele.',
  });
}
