import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/**
 * Testa uma conexão sem gastar nada:
 *  - serpapi  -> consulta a conta, não faz busca (busca custaria 1 crédito)
 *  - whatsapp -> valida um número qualquer, que a Evolution não cobra
 *  - openai   -> lista modelos, que não consome token
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não testa conexões.' }, { status: 403 });
  }

  const { qual } = await req.json().catch(() => ({}) as any);
  const { data: c } = await supabaseAdmin()
    .from('conta_credenciais').select('*').eq('conta_id', perfil.conta_id).single();

  try {
    if (qual === 'serpapi') {
      if (!c?.serpapi_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });
      const r = await fetch(`https://serpapi.com/account?api_key=${c.serpapi_key}`,
        { signal: AbortSignal.timeout(20_000) });
      const d = await r.json();
      if (d.error) return NextResponse.json({ erro: 'Chave recusada pela SerpAPI.' }, { status: 400 });
      return NextResponse.json({ ok: true, recado: `Chave válida. ${d.total_searches_left ?? '?'} buscas restantes no mês.` });
    }

    if (qual === 'whatsapp') {
      if (!c?.evolution_url || !c?.evolution_instancia || !c?.evolution_key) {
        return NextResponse.json({ erro: 'Preencha endereço, instância e token.' }, { status: 400 });
      }
      const base = c.evolution_url.replace(/\/+$/, '');
      const r = await fetch(`${base}/chat/whatsappNumbers/${c.evolution_instancia}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.evolution_key },
        body: JSON.stringify({ numbers: ['5511999999999'] }),
        signal: AbortSignal.timeout(25_000),
      });
      if (r.status === 401 || r.status === 403) {
        return NextResponse.json({ erro: 'Token recusado pela Evolution.' }, { status: 400 });
      }
      if (r.status === 404) {
        return NextResponse.json({ erro: 'Instância não encontrada nesse endereço.' }, { status: 400 });
      }
      if (!r.ok) return NextResponse.json({ erro: `Evolution respondeu ${r.status}.` }, { status: 400 });
      const d = await r.json();
      if (!Array.isArray(d)) return NextResponse.json({ erro: 'Resposta inesperada da Evolution.' }, { status: 400 });
      return NextResponse.json({ ok: true, recado: 'Conectado. O número está respondendo.' });
    }

    if (qual === 'openai') {
      if (!c?.openai_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${c.openai_key}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) return NextResponse.json({ erro: 'Chave recusada pela OpenAI.' }, { status: 400 });
      return NextResponse.json({ ok: true, recado: 'Chave válida.' });
    }
  } catch {
    return NextResponse.json({ erro: 'Não consegui alcançar o serviço.' }, { status: 502 });
  }

  return NextResponse.json({ erro: 'Teste desconhecido.' }, { status: 400 });
}
