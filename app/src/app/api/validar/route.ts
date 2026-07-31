import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Valida uma leva de números na Evolution. Usado pela importação de lista. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const { telefones } = await req.json().catch(() => ({}) as any);
  const lista = [...new Set((telefones ?? []).filter((t: unknown): t is string => typeof t === 'string' && !!t))];
  if (!lista.length) return NextResponse.json({ validacao: {}, validou: false });

  const { data: c } = await supabaseAdmin()
    .from('conta_credenciais')
    .select('evolution_url, evolution_instancia, evolution_key')
    .eq('conta_id', perfil.conta_id).single();

  if (!c?.evolution_url || !c?.evolution_instancia || !c?.evolution_key) {
    return NextResponse.json({ validacao: {}, validou: false });
  }

  try {
    const base = c.evolution_url.replace(/\/+$/, '');
    const r = await fetch(`${base}/chat/whatsappNumbers/${c.evolution_instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: c.evolution_key },
      body: JSON.stringify({ numbers: lista }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!r.ok) return NextResponse.json({ validacao: {}, validou: false });
    const d = await r.json();
    if (!Array.isArray(d)) return NextResponse.json({ validacao: {}, validou: false });
    return NextResponse.json({
      validacao: Object.fromEntries(d.map((i: any) => [String(i.number), i.exists === true])),
      validou: true,
    });
  } catch {
    return NextResponse.json({ validacao: {}, validou: false });
  }
}
