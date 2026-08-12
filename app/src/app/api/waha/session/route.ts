import { NextResponse } from 'next/server';
import { perfilAtual } from '@/lib/supabase/server';
import { wahaSessionName, getOrCreateSession, getQrCode, logoutSession } from '@/lib/waha';

/**
 * Chamada via polling pelo front enquanto a tela de conexão WAHA está
 * aberta. Status/QR nunca são cacheados — sempre ao vivo na API do WAHA.
 */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const sessionName = wahaSessionName(perfil.conta_id);
  try {
    const atual = await getOrCreateSession(sessionName);
    const qr = atual.status === 'SCAN_QR_CODE' ? await getQrCode(sessionName) : null;
    return NextResponse.json({ status: atual.status, qr, numero: atual.me?.id ?? null });
  } catch {
    return NextResponse.json({ erro: 'Não consegui falar com o WAHA.' }, { status: 502 });
  }
}

export async function DELETE() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  try {
    await logoutSession(wahaSessionName(perfil.conta_id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: 'Não consegui desconectar do WAHA.' }, { status: 502 });
  }
}
