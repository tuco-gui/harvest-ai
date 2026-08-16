import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { salvarLeads } from '@/lib/leads';
import { wahaSessionName, checkNumbers, usaWaha } from '@/lib/waha';
import { chamarSerpApi, resolverChaveSerpapi } from '@/lib/serpapi';

/**
 * Busca no Google Maps via SerpAPI, chamada direta (sem n8n — ver lib/serpapi.ts).
 * O navegador manda só o termo — a chave da SerpAPI fica no servidor.
 *
 * A conta vem SEMPRE da sessão verificada, nunca do corpo da requisição.
 * É isso que impede alguém de trocar o conta_id e usar o crédito de outro.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) {
    return NextResponse.json({ erro: 'Sessão expirada. Entre de novo.' }, { status: 401 });
  }
  if (!perfil.conta_id) {
    return NextResponse.json(
      { erro: 'Sua conta de super admin não tem carteira de créditos. Entre por uma conta de cliente.' },
      { status: 400 },
    );
  }

  const { termo, pagina = 1, ll, regiao, campanhaId } = await req.json().catch(() => ({}) as Record<string, unknown>);
  if (typeof termo !== 'string' || !termo.trim()) {
    return NextResponse.json({ erro: 'Digite o ramo e a cidade.' }, { status: 400 });
  }
  const raio = regiao as { lat: number; lng: number; km: number } | undefined;

  const admin = supabaseAdmin();
  const { data: cred } = await admin
    .from('conta_credenciais')
    .select('*')
    .eq('conta_id', perfil.conta_id)
    .single();

  // Busca é institucional (bug P0): credencial da Figueira em runtime prevalece;
  // BYOK por tenant só como fallback. Sem nenhuma → indisponível sanitizado,
  // nunca "cadastre sua chave".
  const chave = resolverChaveSerpapi(cred);
  if (chave.fonte === 'ausente') {
    return NextResponse.json(
      { erro: 'Busca temporariamente indisponível.', indisponivel: true },
      { status: 503 },
    );
  }

  // A SerpAPI ignora `num` no engine google_maps e pagina de 20 em 20.
  const params: Record<string, string> = {
    engine: 'google_maps',
    type: 'search',
    q: termo.trim(),
    hl: 'pt',
    gl: 'br',
  };
  if (Number(pagina) > 1) params.start = String((Number(pagina) - 1) * 20);
  if (typeof ll === 'string' && ll) params.ll = ll;

  // Chamada direta à SerpAPI (sem ponte n8n) — mesma função usada por
  // "Testar busca" (lib/serpapi.ts) — um único caminho real, sem divergência
  // entre teste e busca de verdade. A chave nunca entra em `params`.
  const resultado = await chamarSerpApi(admin, perfil.conta_id, chave.key, params, { modo: 'busca' });
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.motivo }, { status: resultado.status });
  }
  const bruto = resultado.dados;

  if (bruto.error) {
    const chaveRuim = /invalid api key/i.test(bruto.error);
    return NextResponse.json(
      { erro: chaveRuim ? 'A chave da SerpAPI foi recusada. Confira em Configurações.' : bruto.error },
      { status: 400 },
    );
  }

  const achados = Array.isArray(bruto.local_results) ? bruto.local_results : [];

  const leads = achados.map((x: any) => ({
    place_id: x.place_id ?? null,
    empresa: x.title ?? 'Nome não disponível',
    telefone: normalizarTelefone(x.phone),
    telefone_original: x.phone ?? null,
    endereco: x.address ?? null,
    especialidades: Array.isArray(x.type) ? x.type.join(', ') : (x.type ?? null),
    rating: x.rating ?? null,
    reviews: x.reviews ?? null,
    site: x.website ?? null,
    latitude: x.gps_coordinates?.latitude ?? null,
    longitude: x.gps_coordinates?.longitude ?? null,
  }));

  // O `ll`+zoom da SerpAPI é só uma dica de onde centralizar — o Google não
  // filtra de verdade pelo raio, então calculamos a distância real e ordenamos
  // por ela. Não descartamos quem está fora: só avisamos, porque às vezes é
  // isso mesmo que existe na região.
  let avisoRegiao: string | null = null;
  const distancias = new Map<number, number | null>();
  if (raio) {
    leads.forEach((l, i) => {
      distancias.set(i, l.latitude && l.longitude ? distanciaKm(raio.lat, raio.lng, l.latitude, l.longitude) : null);
    });
    const dentro = [...distancias.values()].filter((d) => d !== null && d <= raio.km).length;
    if (dentro === 0 && leads.length > 0) {
      avisoRegiao = `Nenhuma empresa encontrada dentro de ${raio.km} km. Os resultados abaixo são os mais próximos — recomendamos abrir o raio.`;
    } else if (dentro < 3 && dentro < leads.length) {
      avisoRegiao = `Só ${dentro} ${dentro === 1 ? 'empresa está' : 'empresas estão'} dentro de ${raio.km} km. Recomendamos abrir o raio para achar mais.`;
    }
  }

  const podeValidar = usaWaha(cred) || !!(cred.evolution_url && cred.evolution_instancia && cred.evolution_key);
  const zap = podeValidar ? await validarWhatsApp({ ...cred, conta_id: perfil.conta_id }, leads.map((l) => l.telefone)) : {};
  const zapDe = (l: (typeof leads)[number]) =>
    l.telefone ? (zap[l.telefone] === true ? 'sim' : zap[l.telefone] === false ? 'nao' : 'nao_verificado') : 'nao_verificado';

  const comId = leads.filter((l): l is typeof l & { place_id: string } => !!l.place_id);
  const { porPlaceId, novos } = await salvarLeads(
    admin, perfil.conta_id, comId.map((l) => ({ ...l, tem_whatsapp: zapDe(l) })),
    typeof campanhaId === 'number' ? campanhaId : null, 'serpapi',
  );

  await admin.from('prospecta_buscas').insert({
    conta_id: perfil.conta_id,
    termo: termo.trim(),
    ll: typeof ll === 'string' ? ll : null,
    pagina: Number(pagina) || 1,
    total_resultados: achados.length,
    novos_leads: novos,
    origem: 'app',
  });

  const comExtras = leads.map((l, i) => ({
    ...l,
    id: l.place_id ? (porPlaceId[l.place_id]?.id ?? null) : null,
    duplicado: l.place_id ? (porPlaceId[l.place_id]?.duplicado ?? false) : false,
    campanhaAnterior: l.place_id ? (porPlaceId[l.place_id]?.campanhaAnterior ?? null) : null,
    tem_whatsapp: l.telefone ? (zap[l.telefone] ?? null) : null,
    distancia_km: raio ? (distancias.get(i) ?? null) : null,
    dentro_do_raio: raio ? (distancias.get(i) !== null && distancias.get(i)! <= raio.km) : null,
  }));
  if (raio) comExtras.sort((a, b) => (a.distancia_km ?? Infinity) - (b.distancia_km ?? Infinity));

  return NextResponse.json({
    leads: comExtras,
    avisoRegiao,
    validou: podeValidar,
  });
}

/** Distância em linha reta entre dois pontos, em km (fórmula de Haversine). */
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Só dígitos, com DDI 55. A Evolution responde exists:false sem o 55. */
function normalizarTelefone(bruto?: string | null): string | null {
  if (!bruto) return null;
  let d = bruto.replace(/\D/g, '');
  if (d.length < 10) return null;
  if (!d.startsWith('55')) d = '55' + d;
  return d;
}

async function validarWhatsApp(
  cred: {
    conta_id: string;
    whatsapp_provider: string | null;
    evolution_url: string | null;
    evolution_instancia: string | null;
    evolution_key: string | null;
  },
  numeros: (string | null)[],
): Promise<Record<string, boolean>> {
  const lista = [...new Set(numeros.filter((n): n is string => !!n))];
  if (!lista.length) return {};

  if (usaWaha(cred)) {
    try {
      return await checkNumbers(wahaSessionName(cred.conta_id), lista);
    } catch {
      return {};
    }
  }

  try {
    const base = cred.evolution_url!.replace(/\/+$/, '');
    const r = await fetch(`${base}/chat/whatsappNumbers/${cred.evolution_instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cred.evolution_key! },
      body: JSON.stringify({ numbers: lista }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return {};
    const dados = await r.json();
    if (!Array.isArray(dados)) return {};
    return Object.fromEntries(dados.map((i: any) => [String(i.number), i.exists === true]));
  } catch {
    return {}; // validação é opcional: sem ela os leads vêm como "não verificado"
  }
}
