import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/**
 * Envia UMA mensagem. O navegador chama uma vez por lead e controla o
 * intervalo entre as chamadas — é isso que faz Pausar e Parar valerem de
 * verdade: parar é simplesmente não chamar de novo.
 *
 * Vai direto na Evolution, sem passar pelo n8n. Um sistema em vez de dois,
 * e o registro de o que saiu fica no mesmo banco dos leads.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) {
    return NextResponse.json({ erro: 'Escolha uma conta antes de disparar.' }, { status: 400 });
  }

  const { lead, indice = 0 } = await req.json().catch(() => ({}) as any);
  if (!lead?.telefone) {
    return NextResponse.json({ erro: 'Lead sem telefone.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const [{ data: cred }, { data: envio }] = await Promise.all([
    admin.from('conta_credenciais').select('*').eq('conta_id', perfil.conta_id).single(),
    admin.from('conta_config_envio').select('*').eq('conta_id', perfil.conta_id).single(),
  ]);

  if (!cred?.evolution_url || !cred?.evolution_instancia || !cred?.evolution_key) {
    return NextResponse.json(
      { erro: 'Falta configurar o WhatsApp em Configurações → Conexões.' },
      { status: 400 },
    );
  }

  const modo = envio?.modo ?? 'ia';
  const textos: string[] = Array.isArray(envio?.mensagens) ? envio!.mensagens : [];

  let mensagem: string;
  if (modo === 'ia') {
    if (!cred.openai_key) {
      return NextResponse.json(
        { erro: 'O modo "A IA escreve" precisa da chave da OpenAI em Configurações.' },
        { status: 400 },
      );
    }
    try {
      mensagem = await escreverComIA(cred.openai_key, envio?.contexto ?? '', lead);
    } catch {
      return NextResponse.json({ erro: 'A IA não respondeu. Tente de novo.' }, { status: 502 });
    }
  } else {
    if (!textos.length) {
      return NextResponse.json({ erro: 'Nenhuma mensagem cadastrada.' }, { status: 400 });
    }
    // rodízio alterna por lead; fixa usa sempre a primeira
    mensagem = modo === 'rodizio' ? textos[Number(indice) % textos.length] : textos[0];
  }

  const base = cred.evolution_url.replace(/\/+$/, '');
  let entregue = false;
  let falha: string | null = null;

  try {
    const r = await fetch(`${base}/message/sendText/${cred.evolution_instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cred.evolution_key },
      body: JSON.stringify({ number: lead.telefone, text: mensagem }),
      signal: AbortSignal.timeout(30_000),
    });
    entregue = r.ok;
    if (!r.ok) falha = `Evolution respondeu ${r.status}`;
  } catch {
    falha = 'Não consegui falar com a Evolution.';
  }

  // Registra o que aconteceu, mesmo quando falhou — é o histórico que
  // permite saber depois quem recebeu o quê, e quando.
  const { data: salvo } = await admin
    .from('prospecta_leads')
    .upsert(
      {
        conta_id: perfil.conta_id,
        place_id: lead.place_id ?? null,
        empresa: lead.empresa,
        telefone: lead.telefone,
        telefone_original: lead.telefone_original ?? null,
        ...(entregue ? { disparo: 'sim', status: 'disparado', disparado_em: new Date().toISOString() } : {}),
      },
      { onConflict: 'place_id' },
    )
    .select('id')
    .maybeSingle();

  if (salvo?.id) {
    await admin.from('prospecta_mensagens').insert({
      conta_id: perfil.conta_id,
      lead_id: salvo.id,
      parte: 1,
      direcao: 'saida',
      conteudo: mensagem,
      status: entregue ? 'enviada' : 'erro',
      enviado_em: entregue ? new Date().toISOString() : null,
      erro: falha,
    });
  }

  if (!entregue) return NextResponse.json({ erro: falha }, { status: 502 });
  return NextResponse.json({ ok: true, mensagem });
}

async function escreverComIA(chave: string, contexto: string, lead: any): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'Você escreve a primeira mensagem de WhatsApp de uma prospecção B2B, em português brasileiro. ' +
            'Uma mensagem só, de 25 a 45 palavras, terminando com uma pergunta. ' +
            'Tom humano, direto e educado. Sem emoji no início, no máximo um na mensagem inteira. ' +
            'Nunca invente fato sobre a empresa: use apenas o que vier nos dados. ' +
            'Proibido urgência artificial, promessa de resultado e linguagem de spam. ' +
            'Responda apenas com o texto da mensagem, sem aspas e sem explicação.\n\n' +
            `Contexto de quem está mandando:\n${contexto || '(não informado)'}`,
        },
        {
          role: 'user',
          content:
            `Empresa: ${lead.empresa}\n` +
            `Ramo: ${lead.especialidades ?? 'não informado'}\n` +
            `Nota no Google: ${lead.rating ?? 'não informada'} (${lead.reviews ?? 0} avaliações)\n` +
            `Endereço: ${lead.endereco ?? 'não informado'}\n` +
            `Site: ${lead.site ?? 'não tem'}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(40_000),
  });

  if (!r.ok) throw new Error(String(r.status));
  const d = await r.json();
  const texto = d.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('vazio');
  return texto;
}
