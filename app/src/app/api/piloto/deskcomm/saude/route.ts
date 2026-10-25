import { NextResponse } from 'next/server';
import { perfilAtual } from '@/lib/supabase/server';
import { diagnosticarAgentesDeskcomm, pilotoDeskcommPermitido } from '@/lib/deskcommPiloto';

export const dynamic = 'force-dynamic';

/** GET de diagnóstico QA — nunca conexão de WhatsApp, deploy ou escrita. */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  // Superadmin autenticado numa conta QA ativa, sem receber contaId via navegador.
  if (perfil.papel !== 'super_admin' || !perfil.conta_id) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }
  if (!pilotoDeskcommPermitido(perfil.conta_id)) {
    return NextResponse.json({ configurado: false, estado: 'desativado' }, { status: 404 });
  }
  const resultado = await diagnosticarAgentesDeskcomm(perfil.conta_id);
  const ok = resultado.estado === 'operacional';
  return NextResponse.json({ configurado: true, ...resultado }, {
    status: ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
