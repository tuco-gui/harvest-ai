import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { enviarEmail } from '@/lib/email';
import { smtpConfigurado } from '@/lib/smtpCredenciais';
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

  // Pré-validação global e neutra ao e-mail: erro 503 não enumera usuários.
  // Não gere códigos que não poderão ser entregues.
  const baseUrl = baseUrlApp();
  if (!baseUrl || !(await smtpConfigurado())) {
    console.error('[esqueci-senha] Recuperação indisponível: URL ou transporte SMTP não configurado no runtime.');
    return NextResponse.json(
      { erro: 'A recuperação por e-mail está temporariamente indisponível. Contate o suporte.' },
      { status: 503 },
    );
  }

  const admin = supabaseAdmin();
  const resultado = await gerarCodigoRecuperacao(admin, email);
  if ('codigo' in resultado) {
    const enviado = await enviarEmail(
      email,
      'Redefinir sua senha no Harvest AI',
      textoCodigoRecuperacao(resultado.codigo, baseUrl),
    );
    if (!enviado) {
      // Não revelar ao chamador se o usuário existe ou se houve falha
      // de envio para aquele endereço. Operação registra só fato genérico.
      console.error('[esqueci-senha] Falha na entrega de código de recuperação.');
    }
  }

  // ponytail: sem rate-limit aqui. O Supabase já limita a (re)geração de OTP
  // por e-mail, mas um atacante ainda pode fazer "OTP bombing" de um e-mail
  // de terceiro. Upgrade: throttling por IP+e-mail (ex.: Upstash/KV) antes de
  // chamar gerarCodigoRecuperacao — fora de escopo desta entrega.
  return NextResponse.json({
    ok: true,
    mensagem: 'Se o e-mail estiver cadastrado e a entrega estiver disponível, você receberá um código de 6 dígitos.',
  });
}
