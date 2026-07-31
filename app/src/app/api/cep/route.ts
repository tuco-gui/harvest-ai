import { NextResponse } from 'next/server';

const AGENTE = { 'User-Agent': 'HarvestAI/1.0 (contato@figueiramarketing.com.br)' };

/**
 * Geocodifica um CEP para lat/lng. O Nominatim (OpenStreetMap) sozinho não
 * indexa CEP brasileiro direito — devolve vazio quase sempre. O caminho que
 * funciona é: ViaCEP acha o endereço a partir do CEP, e o Nominatim geocodifica
 * esse endereço. Cai para o nível da cidade se a rua não for encontrada.
 */
export async function GET(req: Request) {
  const cep = new URL(req.url).searchParams.get('cep')?.replace(/\D/g, '');
  if (!cep || cep.length !== 8) {
    return NextResponse.json({ erro: 'CEP inválido.' }, { status: 400 });
  }

  try {
    const rEndereco = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(10_000) });
    const endereco = await rEndereco.json();
    if (endereco?.erro || !endereco?.localidade) {
      return NextResponse.json({ erro: 'CEP não encontrado.' }, { status: 404 });
    }

    const tentativas = [
      [endereco.logradouro, endereco.localidade, endereco.uf].filter(Boolean).join(', '),
      [endereco.localidade, endereco.uf].filter(Boolean).join(', '),
    ].filter(Boolean);

    for (const consulta of tentativas) {
      const rGeo = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${consulta}, Brazil`)}&format=json&limit=1&countrycodes=br`,
        { headers: AGENTE, signal: AbortSignal.timeout(10_000) },
      );
      const geo = await rGeo.json();
      if (Array.isArray(geo) && geo[0]) {
        return NextResponse.json({
          lat: Number(geo[0].lat), lng: Number(geo[0].lon),
          cidade: endereco.localidade, uf: endereco.uf,
        });
      }
    }

    return NextResponse.json({ erro: 'Achei o CEP mas não consegui localizar no mapa.' }, { status: 404 });
  } catch {
    return NextResponse.json({ erro: 'Não consegui localizar agora.' }, { status: 502 });
  }
}
