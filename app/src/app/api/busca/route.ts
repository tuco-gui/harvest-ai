import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/**
 * Ponte de busca. O navegador manda só o termo — a chave da SerpAPI fica aqui.
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
    .select('serpapi_key, evolution_url, evolution_instancia, evolution_key')
    .eq('conta_id', perfil.conta_id)
    .single();

  if (!cred?.serpapi_key) {
    return NextResponse.json(
      { erro: 'Falta a chave da SerpAPI. Peça ao administrador da conta para cadastrar em Configurações.' },
      { status: 400 },
    );
  }

  const ponte = process.env.N8N_WEBHOOK_BUSCA;
  if (!ponte) {
    return NextResponse.json({ erro: 'Ponte de busca não configurada no servidor.' }, { status: 500 });
  }

  // A SerpAPI ignora `num` no engine google_maps e pagina de 20 em 20.
  const params: Record<string, string> = {
    engine: 'google_maps',
    type: 'search',
    q: termo.trim(),
    api_key: cred.serpapi_key,
    hl: 'pt',
    gl: 'br',
  };
  if (Number(pagina) > 1) params.start = String((Number(pagina) - 1) * 20);
  if (typeof ll === 'string' && ll) params.ll = ll;

  let bruto: { local_results?: unknown[]; error?: string };
  try {
    // uma segunda tentativa: o n8n devolve 5xx passageiro de vez em quando
    let resposta: Response | undefined;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      resposta = await fetch(ponte, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(45_000),
      });
      if (resposta.ok || resposta.status < 500 || tentativa === 2) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!resposta!.ok) {
      return NextResponse.json({ erro: `A ponte de busca respondeu ${resposta!.status}.` }, { status: 502 });
    }
    bruto = await resposta!.json();
  } catch {
    return NextResponse.json({ erro: 'Não consegui falar com a ponte de busca.' }, { status: 502 });
  }

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

  const podeValidar = cred.evolution_url && cred.evolution_instancia && cred.evolution_key;
  const zap = podeValidar ? await validarWhatsApp(cred, leads.map((l) => l.telefone)) : {};

  // Guarda os leads da conta. on_conflict=place_id evita duplicar entre buscas.
  //
  // Mas place_id repetido não pode simplesmente reescrever campanha_id: se
  // "Joalheria X" já estava na campanha "Busca de terça" e a mesma busca
  // roda de novo hoje, ela não pode "sumir" de terça só porque apareceu de
  // novo — por isso os que já existem são atualizados sem tocar campanha_id,
  // e viram avisados como duplicado pra tela poder excluir se quiser.
  const comId = leads.filter((l) => l.place_id);
  let existentes: Record<string, number | null> = {};
  if (comId.length) {
    const { data: jaExistiam } = await admin
      .from('prospecta_leads')
      .select('place_id, campanha_id')
      .eq('conta_id', perfil.conta_id)
      .in('place_id', comId.map((l) => l.place_id!));
    existentes = Object.fromEntries((jaExistiam ?? []).map((r: any) => [r.place_id, r.campanha_id]));
  }

  const novosLeads = comId.filter((l) => !(l.place_id! in existentes));
  const duplicados = comId.filter((l) => l.place_id! in existentes);

  const zapDe = (l: (typeof leads)[number]) =>
    l.telefone ? (zap[l.telefone] === true ? 'sim' : zap[l.telefone] === false ? 'nao' : 'nao_verificado') : 'nao_verificado';

  if (novosLeads.length) {
    await admin.from('prospecta_leads').upsert(novosLeads.map((l) => ({
      ...l,
      conta_id: perfil.conta_id,
      origem: 'serpapi',
      campanha_id: typeof campanhaId === 'number' ? campanhaId : null,
      tem_whatsapp: zapDe(l),
    })), { onConflict: 'place_id', ignoreDuplicates: false });
  }
  await Promise.all(duplicados.map((l) => admin
    .from('prospecta_leads')
    .update({
      telefone: l.telefone, telefone_original: l.telefone_original, endereco: l.endereco,
      rating: l.rating, reviews: l.reviews, site: l.site, latitude: l.latitude, longitude: l.longitude,
      tem_whatsapp: zapDe(l),
    })
    .eq('place_id', l.place_id!).eq('conta_id', perfil.conta_id)));

  const idsCampanhaAnterior = [...new Set(duplicados.map((l) => existentes[l.place_id!]).filter((id): id is number => !!id))];
  let nomesCampanha: Record<number, string> = {};
  if (idsCampanhaAnterior.length) {
    const { data: campanhasAnteriores } = await admin.from('prospecta_campanhas').select('id, nome').in('id', idsCampanhaAnterior);
    nomesCampanha = Object.fromEntries((campanhasAnteriores ?? []).map((c: any) => [c.id, c.nome]));
  }

  await admin.from('prospecta_buscas').insert({
    conta_id: perfil.conta_id,
    termo: termo.trim(),
    ll: typeof ll === 'string' ? ll : null,
    pagina: Number(pagina) || 1,
    total_resultados: achados.length,
    novos_leads: novosLeads.length,
    origem: 'app',
  });

  const comExtras = leads.map((l, i) => ({
    ...l,
    duplicado: l.place_id ? l.place_id in existentes : false,
    campanhaAnterior: l.place_id && existentes[l.place_id] ? (nomesCampanha[existentes[l.place_id]!] ?? null) : null,
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
  cred: { evolution_url: string | null; evolution_instancia: string | null; evolution_key: string | null },
  numeros: (string | null)[],
): Promise<Record<string, boolean>> {
  const lista = [...new Set(numeros.filter((n): n is string => !!n))];
  if (!lista.length) return {};

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
