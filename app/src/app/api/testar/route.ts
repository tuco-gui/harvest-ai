import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { gerarComIA, montarPrompts, type ProvedorIA } from '@/lib/ia';
import {
  buscarDecisor, buscarDecisorGratis, buscarLinkedin, buscarLinkedinTavily,
  buscarEmailApollo, buscarEmailSnov,
} from '@/lib/enriquecimento';
import { wahaSessionName, getOrCreateSession, checkNumbers } from '@/lib/waha';

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
      if (c?.whatsapp_provider === 'waha') {
        const status = await getOrCreateSession(wahaSessionName(perfil.conta_id));
        if (status.status !== 'WORKING') {
          return NextResponse.json({ erro: `WAHA não está conectado (status: ${status.status}). Conecte pelo QR Code acima.` }, { status: 400 });
        }
        const chk = await checkNumbers(wahaSessionName(perfil.conta_id), ['5511999999999']);
        if (!('5511999999999' in chk)) {
          return NextResponse.json({ erro: 'WAHA não respondeu à consulta.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, recado: 'Conectado. O número está respondendo.' });
      }
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
        const texto = await gerarComIA((c.ia_provedor ?? 'openai') as ProvedorIA, c.ia_key, system, user, c.ia_modelo);
        return NextResponse.json({ ok: true, recado: `Exemplo gerado: "${texto}"` });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'A IA não respondeu.' }, { status: 400 });
      }
    }

    if (qual === 'perplexity') {
      if (!c?.perplexity_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });
      try {
        const { nome } = await buscarDecisor(c.perplexity_key, {
          empresa: LEAD_EXEMPLO.empresa, endereco: LEAD_EXEMPLO.endereco, place_id: null,
        });
        return NextResponse.json({ ok: true, recado: nome ? `Chave válida. Achou "${nome}" pro exemplo.` : 'Chave válida. Não achou decisor pro exemplo (esperado, é empresa fictícia).' });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'A Perplexity não respondeu.' }, { status: 400 });
      }
    }

    if (qual === 'serper') {
      if (!c?.serper_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });
      try {
        await buscarLinkedin(c.serper_key, 'Satya Nadella', 'Microsoft');
        return NextResponse.json({ ok: true, recado: 'Chave válida.' });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'O Serper não respondeu.' }, { status: 400 });
      }
    }

    if (qual === 'decisor-gratis') {
      if (!c?.ia_key) return NextResponse.json({ erro: 'Configure a IA (seção acima) primeiro.' }, { status: 400 });
      if (!c?.serper_key && !c?.tavily_key) return NextResponse.json({ erro: 'Configure o Serper ou o Tavily primeiro.' }, { status: 400 });
      try {
        const { nome } = await buscarDecisorGratis(c, { empresa: LEAD_EXEMPLO.empresa, endereco: LEAD_EXEMPLO.endereco });
        return NextResponse.json({ ok: true, recado: nome ? `Achou "${nome}" pro exemplo.` : 'Rodou sem erro. Não achou decisor pro exemplo (esperado, é empresa fictícia).' });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'Não respondeu.' }, { status: 400 });
      }
    }

    if (qual === 'tavily') {
      if (!c?.tavily_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });
      try {
        await buscarLinkedinTavily(c.tavily_key, 'Satya Nadella', 'Microsoft');
        return NextResponse.json({ ok: true, recado: 'Chave válida.' });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'O Tavily não respondeu.' }, { status: 400 });
      }
    }

    if (qual === 'apollo') {
      if (!c?.apollo_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });
      try {
        await buscarEmailApollo(c.apollo_key, 'Satya Nadella', 'microsoft.com', 'Microsoft');
        return NextResponse.json({ ok: true, recado: 'Chave válida.' });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'O Apollo não respondeu.' }, { status: 400 });
      }
    }

    if (qual === 'snov') {
      if (!c?.snov_client_id || !c?.snov_client_secret) return NextResponse.json({ erro: 'Preencha o API User ID e o API Secret.' }, { status: 400 });
      try {
        await buscarEmailSnov(c.snov_client_id, c.snov_client_secret, 'Satya Nadella', 'microsoft.com');
        return NextResponse.json({ ok: true, recado: 'Client ID/secret válidos.' });
      } catch (e: any) {
        return NextResponse.json({ erro: e?.message ?? 'O Snov.io não respondeu.' }, { status: 400 });
      }
    }

    if (qual === 'anymail') {
      if (!c?.anymail_key) return NextResponse.json({ erro: 'Sem chave cadastrada.' }, { status: 400 });
      const r = await fetch('https://api.anymailfinder.com/v5.1/account', {
        headers: { Authorization: `Bearer ${c.anymail_key}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) return NextResponse.json({ erro: 'Chave recusada pelo Anymail Finder.' }, { status: 400 });
      const d = await r.json();
      return NextResponse.json({ ok: true, recado: `Chave válida. ${d.credits_left ?? '?'} créditos restantes.` });
    }
  } catch {
    return NextResponse.json({ erro: 'Não consegui alcançar o serviço.' }, { status: 502 });
  }

  return NextResponse.json({ erro: 'Teste desconhecido.' }, { status: 400 });
}
