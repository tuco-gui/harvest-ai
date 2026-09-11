import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Sem conta.' }, { status: 400 });
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .rpc('inbox_contatos', { p_conta_id: perfil.conta_id })
    .select('*');

  if (error) {
    // Fallback: raw query if RPC doesn't exist yet
    const { data: raw } = await admin
      .from('inbound_eventos')
      .select('telefone, nome_contato, mensagem, tipo_evento, recebido_em, lead_id')
      .eq('conta_id', perfil.conta_id)
      .order('recebido_em', { ascending: false })
      .limit(500);

    if (!raw) return NextResponse.json({ contatos: [] });

    // Group by phone
    const byPhone = new Map<string, {
      telefone: string;
      nome: string | null;
      ultimaMensagem: string;
      ultimaRecebida: string;
      total: number;
      leadId: number | null;
    }>();

    for (const r of raw) {
      const tel = r.telefone;
      const existing = byPhone.get(tel);
      if (existing) {
        existing.total++;
        if (r.recebido_em > existing.ultimaRecebida) {
          existing.ultimaMensagem = r.mensagem ?? '';
          existing.ultimaRecebida = r.recebido_em;
          if (r.nome_contato) existing.nome = r.nome_contato;
          if (r.lead_id) existing.leadId = r.lead_id;
        }
      } else {
        byPhone.set(tel, {
          telefone: tel,
          nome: r.nome_contato ?? null,
          ultimaMensagem: r.mensagem ?? '',
          ultimaRecebida: r.recebido_em,
          total: 1,
          leadId: r.lead_id ?? null,
        });
      }
    }

    const contatos = [...byPhone.values()].sort(
      (a, b) => new Date(b.ultimaRecebida).getTime() - new Date(a.ultimaRecebida).getTime()
    );

    return NextResponse.json({ contatos });
  }

  return NextResponse.json({ contatos: data ?? [] });
}
