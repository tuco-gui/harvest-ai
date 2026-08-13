import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { gerarComIA, montarPrompts, type ProvedorIA } from '@/lib/ia';
import { wahaSessionName, getOrCreateSession, sendText as wahaSendText, usaWaha as ehWaha } from '@/lib/waha';
import { normalizarTelefone } from '@/lib/telefone';
import { estaSuprimido } from '@/lib/supressao';
import { contatoJaAbordado, registrarTentativaContato, type ProviderContato } from '@/lib/historicoContato';
import { vincularLeadACampanha } from '@/lib/campanhaLeads';

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
  const telefone = normalizarTelefone(lead.telefone);
  if (!telefone) {
    return NextResponse.json({ erro: 'Telefone do lead é inválido.' }, { status: 400 });
  }
  const campanhaIdNum = typeof campanhaId === 'number' ? campanhaId : null;

  const admin = supabaseAdmin();
  const [{ data: cred }, { data: envio }] = await Promise.all([
    admin.from('conta_credenciais').select('*').eq('conta_id', perfil.conta_id).single(),
    admin.from('conta_config_envio').select('*').eq('conta_id', perfil.conta_id).single(),
  ]);

  const usaWaha = ehWaha(cred);
  const provider: ProviderContato = usaWaha ? 'waha' : 'evolution';

  // Barreira de supressão — Fase 3A. Roda ANTES de qualquer chamada ao
  // provider (WAHA/Evolution) ou à IA: um contato suprimido não deve nem
  // custar uma geração de mensagem, muito menos um disparo.
  if (await estaSuprimido(admin, perfil.conta_id, telefone)) {
    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: null, campanhaId: campanhaIdNum,
      telefone, provider, status: 'bloqueado_supressao',
      motivoBloqueio: 'Telefone suprimido (opt-out/supressão central da conta).',
    });
    return NextResponse.json(
      { erro: 'Este contato está suprimido (opt-out) e não pode receber disparo.', suprimido: true },
      { status: 403 },
    );
  }

  // Informativo, não bloqueia — a conta decide conscientemente se reenvia
  // (ver Fase 3A: proteção contra contato duplicado).
  const contatoAnterior = await contatoJaAbordado(admin, perfil.conta_id, telefone);

  if (usaWaha) {
    let status;
    try {
      status = await getOrCreateSession(wahaSessionName(perfil.conta_id));
    } catch {
      // WAHA fora do ar: registra a falha no lead, igual ao caminho de erro
      // da Evolution mais abaixo, em vez de deixar o lead sem nenhum rastro.
      const falha = 'Não consegui falar com o WAHA. Verifique se o servidor está no ar.';
      const { data: salvo } = await admin
        .from('prospecta_leads')
        .upsert(
          {
            conta_id: perfil.conta_id,
            place_id: lead.place_id ?? null,
            empresa: lead.empresa,
            telefone,
            telefone_original: lead.telefone_original ?? null,
            ...(campanhaIdNum !== null ? { campanha_id: campanhaIdNum } : {}),
          },
          { onConflict: 'conta_id, place_id' },
        )
        .select('id')
        .maybeSingle();
      let mensagemId: number | null = null;
      if (salvo?.id) {
        const { data: msg } = await admin.from('prospecta_mensagens').insert({
          conta_id: perfil.conta_id,
          lead_id: salvo.id,
          parte: 1,
          direcao: 'saida',
          conteudo: '',
          status: 'erro',
          enviado_em: null,
          erro: falha,
        }).select('id').maybeSingle();
        mensagemId = msg?.id ?? null;
      }
      await registrarTentativaContato(admin, {
        contaId: perfil.conta_id, leadId: salvo?.id ?? null, campanhaId: campanhaIdNum,
        mensagemId, telefone, provider, status: 'erro',
      });
      return NextResponse.json({ erro: falha }, { status: 400 });
    }
    if (status.status !== 'WORKING') {
      return NextResponse.json(
        { erro: 'WAHA está configurado como provider desta conta, mas a sessão não está conectada. Conecte pelo QR Code em Configurações → Conexões.' },
        { status: 400 },
      );
    }
  } else if (!cred?.evolution_url || !cred?.evolution_instancia || !cred?.evolution_key) {
    return NextResponse.json(
      { erro: 'Evolution está configurado como provider desta conta, mas não está conectada. Preencha endereço, instância e token em Configurações → Conexões.' },
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

  // Barreira final pré-envio (Fase 3A) — repete a checagem de supressão
  // imediatamente antes da chamada ao provider. Cobre o caso raro de o
  // contato ter sido suprimido durante a geração da mensagem (IA pode levar
  // segundos); sem isso a checagem lá em cima vira só "quase no início".
  if (await estaSuprimido(admin, perfil.conta_id, telefone)) {
    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: null, campanhaId: campanhaIdNum,
      telefone, provider, status: 'bloqueado_supressao',
      motivoBloqueio: 'Telefone suprimido (opt-out/supressão central da conta) — detectado na barreira final pré-envio.',
    });
    return NextResponse.json(
      { erro: 'Este contato está suprimido (opt-out) e não pode receber disparo.', suprimido: true },
      { status: 403 },
    );
  }

  let entregue = false;
  let falha: string | null = null;

  if (usaWaha) {
    entregue = await wahaSendText(wahaSessionName(perfil.conta_id), telefone, mensagem);
    if (!entregue) falha = 'Não consegui falar com o WAHA.';
  } else {
    const base = cred.evolution_url.replace(/\/+$/, '');
    try {
      const r = await fetch(`${base}/message/sendText/${cred.evolution_instancia}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cred.evolution_key },
        body: JSON.stringify({ number: telefone, text: mensagem }),
        signal: AbortSignal.timeout(30_000),
      });
      entregue = r.ok;
      if (!r.ok) falha = `Evolution respondeu ${r.status}`;
    } catch {
      falha = 'Não consegui falar com a Evolution.';
    }
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
        telefone,
        telefone_original: lead.telefone_original ?? null,
        ...(campanhaIdNum !== null ? { campanha_id: campanhaIdNum } : {}),
        ...(entregue ? { disparo: 'sim', status: 'disparado', disparado_em: new Date().toISOString() } : {}),
      },
      { onConflict: 'conta_id, place_id' },
    )
    .select('id')
    .maybeSingle();

  let mensagemId: number | null = null;
  if (salvo?.id) {
    const { data: msg } = await admin.from('prospecta_mensagens').insert({
      conta_id: perfil.conta_id,
      lead_id: salvo.id,
      parte: 1,
      direcao: 'saida',
      conteudo: mensagem,
      status: entregue ? 'enviada' : 'erro',
      enviado_em: entregue ? new Date().toISOString() : null,
      erro: falha,
    }).select('id').maybeSingle();
    mensagemId = msg?.id ?? null;

    // Fase 3A: histórico de contato (por telefone, todo provider) e vínculo
    // N:N com a campanha — mesmo lead pode acabar em duas campanhas ao longo
    // do tempo, e isso não pode depender só de prospecta_leads.campanha_id.
    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: salvo.id, campanhaId: campanhaIdNum,
      mensagemId, telefone, provider, status: entregue ? 'enviado' : 'erro',
    });
    if (campanhaIdNum !== null) {
      await vincularLeadACampanha(admin, perfil.conta_id, campanhaIdNum, salvo.id, 'disparo');
    }
  }

  if (!entregue) return NextResponse.json({ erro: falha }, { status: 502 });
  return NextResponse.json({ ok: true, mensagem, contatoAnterior });
}
