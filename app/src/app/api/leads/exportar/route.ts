import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/**
 * Exporta leads da conta como CSV para download.
 */
export async function GET(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: leads, error } = await admin
    .from('prospecta_leads')
    .select('id, empresa, telefone, telefone_original, endereco, especialidades, tem_whatsapp, criado_em')
    .eq('conta_id', perfil.conta_id)
    .order('criado_em', { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const header = 'ID,Empresa,Telefone,Telefone Original,Endereço,Especialidades,WhatsApp,Criado em\n';
  const rows = (leads ?? []).map((l: any) =>
    [
      l.id,
      `"${(l.empresa ?? '').replace(/"/g, '""')}"`,
      l.telefone ?? '',
      l.telefone_original ?? '',
      `"${(l.endereco ?? '').replace(/"/g, '""')}"`,
      `"${(l.especialidades ?? '').replace(/"/g, '""')}"`,
      l.tem_whatsapp ?? '',
      l.criado_em ?? '',
    ].join(',')
  ).join('\n');

  return new NextResponse(header + rows, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads_${perfil.conta_id}.csv"`,
    },
  });
}
