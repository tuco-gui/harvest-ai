import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { getOrCreateSession, getQrCode, getNumeroConectado, logoutSession } from '@/lib/waha';
import { carregarCanais, sessaoWahaDoCanal, type CanalWhatsApp } from '@/lib/whatsappCanais';

async function canalDaRequisicao(req: Request, contaId: string): Promise<CanalWhatsApp | null> {
  const canalId = Number(new URL(req.url).searchParams.get('canalId'));
  if (!Number.isInteger(canalId)) return null;
  const canais = await carregarCanais(supabaseAdmin(), contaId);
  return canais.find((c) => c.id === canalId && c.provider === 'waha') ?? null;
}

/**
 * Chamada via polling pelo front enquanto a tela de conexão WAHA está
 * aberta. Status/QR nunca são cacheados — sempre ao vivo na API do WAHA.
 */
export async function GET(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não acessa a conexão do WhatsApp.' }, { status: 403 });
  }

  const canal = await canalDaRequisicao(req, perfil.conta_id);
  if (!canal) return NextResponse.json({ erro: 'Canal WAHA não encontrado nesta conta.' }, { status: 404 });
  const sessionName = sessaoWahaDoCanal(canal);
  try {
    const atual = await getOrCreateSession(sessionName);
    const qr = atual.status === 'SCAN_QR_CODE' ? await getQrCode(sessionName) : null;
    const numero = atual.status === 'WORKING' ? await getNumeroConectado(sessionName) : null;
    await supabaseAdmin().from('whatsapp_canais').update({
      status: atual.status === 'WORKING' ? 'conectado' : 'desconectado',
      ...(numero ? { numero } : {}),
      atualizado_em: new Date().toISOString(),
    }).eq('id', canal.id).eq('conta_id', perfil.conta_id);
    return NextResponse.json({ status: atual.status, qr, numero });
  } catch {
    return NextResponse.json({ erro: 'Não consegui falar com o WAHA.' }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não acessa a conexão do WhatsApp.' }, { status: 403 });
  }

  const canal = await canalDaRequisicao(req, perfil.conta_id);
  if (!canal) return NextResponse.json({ erro: 'Canal WAHA não encontrado nesta conta.' }, { status: 404 });
  try {
    await logoutSession(sessaoWahaDoCanal(canal));
    await supabaseAdmin().from('whatsapp_canais')
      .update({ status: 'desconectado', atualizado_em: new Date().toISOString() })
      .eq('id', canal.id).eq('conta_id', perfil.conta_id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: 'Não consegui desconectar do WAHA.' }, { status: 502 });
  }
}
