import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { gerarComIA, montarPrompts, type ProvedorIA } from '@/lib/ia';

const LEAD_EXEMPLO = {
  empresa: 'Joalheria Exemplo', especialidades: 'Joalheria', rating: 4.7, reviews: 132,
  endereco: 'Rua Example, 123 - Centro', site: 'https://exemplo.com.br',
};

/**
 * Testa uma conexão sem gastar nada:
 *  - serpapi  -> consulta a conta, não faz busca (busca custaria 1 crédito)
 *  - whatsapp -> valida um número qualquer, que a Evolution não cobra
 *  - ia       -> gera de verdade uma mensagem de exemplo, pra dar pra ver o
 *                resultado real antes de soltar pro cliente. Custa um token,
 *                mas é a única forma de saber se ficou bom.
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

    if (qual === 'ia') {
      if (!c?.ia_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });

      const { data: envio } = await supabaseAdmin()
        .from('conta_config_envio').select('contexto').eq('conta_id', perfil.conta_id).maybeSingle();

      const { system, user } = montarPrompts(envio?.contexto ?? '', LEAD_EXEMPLO);
      try {
        const texto = await gerarComIA((c.ia_provedor ?? 'openai') as ProvedorIA, c.ia_key, system, user);
        return NextResponse.json({ ok: true, recado: `Exemplo gerado: "${texto}"` });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'A IA não respondeu.' }, { status: 400 });
      }
    }
  } catch {
    return NextResponse.json({ erro: 'Não consegui alcançar o serviço.' }, { status: 502 });
  }

  return NextResponse.json({ erro: 'Teste desconhecido.' }, { status: 400 });
}
