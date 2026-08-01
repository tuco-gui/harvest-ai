import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { gerarComIA, montarPrompts, type ProvedorIA } from '@/lib/ia';

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

  const { lead, indice = 0, campanhaId } = await req.json().catch(() => ({}) as any);
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
    if (!cred.ia_key) {
      return NextResponse.json(
        { erro: 'O modo "A IA escreve" precisa de uma chave de IA em Configurações.' },
        { status: 400 },
      );
    }
    try {
      const { system, user } = montarPrompts(envio?.contexto ?? '', lead);
      mensagem = await gerarComIA((cred.ia_provedor ?? 'openai') as ProvedorIA, cred.ia_key, system, user, cred.ia_modelo);
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
        ...(typeof campanhaId === 'number' ? { campanha_id: campanhaId } : {}),
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
