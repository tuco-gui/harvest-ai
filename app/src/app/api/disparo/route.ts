import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { gerarComIA, montarPrompts, type ProvedorIA } from '@/lib/ia';
import { wahaSessionName, getOrCreateSession, sendText as wahaSendText, usaWaha as ehWaha } from '@/lib/waha';
import { normalizarTelefone } from '@/lib/telefone';
import { estaSuprimido } from '@/lib/supressao';
import {
  contatoJaAbordado, registrarTentativaContato, type ProviderContato,
} from '@/lib/historicoContato';
import { vincularLeadACampanha } from '@/lib/campanhaLeads';
import {
  carregarCanais, resolverCanalDisparo, type CanalWhatsApp,
} from '@/lib/whatsappCanais';
import { envioPermitidoNoAmbiente } from '@/lib/ambienteEnvio';

/**
 * Envia UMA mensagem. O navegador chama uma vez por lead e controla o
 * intervalo entre as chamadas — é isso que faz Pausar e Parar valerem de
 * verdade: parar é simplesmente não chamar de novo.
 *
 * Multicanal (Fase 3B.1): o número de envio é um CANAL (whatsapp_canais),
 * não um provider global. A campanha define modo fixo ou rodízio; o lead
 * seleciona o canal dentro da regra. O histórico registra o canal_id real.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) {
    return NextResponse.json({ erro: 'Escolha uma conta antes de disparar.' }, { status: 400 });
  }

  const {
    lead, indice = 0, campanhaId, canalId = null, modoEnvio = null,
  } = await req.json().catch(() => ({}) as any);
  if (!lead?.telefone) {
    return NextResponse.json({ erro: 'Lead sem telefone.' }, { status: 400 });
  }
  const telefone = normalizarTelefone(lead.telefone);
  if (!telefone) {
    return NextResponse.json({ erro: 'Telefone do lead é inválido.' }, { status: 400 });
  }
  const campanhaIdNum = typeof campanhaId === 'number' ? campanhaId : null;

  // Guarda fail-closed de ambiente (staging): roda ANTES de qualquer outra
  // coisa, inclusive da barreira de supressão — em WHATSAPP_MODE=test,
  // número fora da whitelist de QA nunca chega perto de um provider real,
  // mesmo que secrets de staging estejam mal configurados.
  const permissaoAmbiente = envioPermitidoNoAmbiente(telefone);
  if (!permissaoAmbiente.ok) {
    return NextResponse.json({ erro: permissaoAmbiente.motivo, bloqueadoPorAmbiente: true }, { status: 403 });
  }

  const admin = supabaseAdmin();

  // ---- Resolução do canal (multicanal) ----
  const [{ data: cred }, { data: envio }, { data: campanha }, canais] = await Promise.all([
    admin.from('conta_credenciais').select('*').eq('conta_id', perfil.conta_id).single(),
    admin.from('conta_config_envio').select('*').eq('conta_id', perfil.conta_id).single(),
    campanhaIdNum !== null
      ? admin.from('prospecta_campanhas')
          .select('modo_envio_numero, canal_ids, mensagem_modo, mensagens, contexto_ia')
          .eq('id', campanhaIdNum).single()
      : Promise.resolve({ data: null }),
    carregarCanais(admin, perfil.conta_id),
  ]);

  // modo de envio: prioriza o explícito no corpo, depois o da campanha, depois fixo.
  const modo: 'fixo' | 'rodizio' =
    modoEnvio === 'rodizio' || modoEnvio === 'fixo' ? modoEnvio
      : campanha?.modo_envio_numero === 'rodizio' ? 'rodizio'
      : 'fixo';

  // No rodízio, se a campanha listou canais específicos, restringe a eles.
  let canaisValidos = canais;
  if (modo === 'rodizio' && Array.isArray(campanha?.canal_ids) && (campanha!.canal_ids as number[]).length) {
    const ids = new Set(campanha!.canal_ids as number[]);
    canaisValidos = canais.filter((c) => ids.has(c.id));
  }

  const canal: CanalWhatsApp | null = resolverCanalDisparo(canaisValidos, modo, canalId, Number(indice));
  if (!canal) {
    return NextResponse.json(
      { erro: 'Nenhum canal de WhatsApp elegível para enviar. Conecte um número em Configurações → WhatsApp ou escolha um canal ativo.' },
      { status: 400 },
    );
  }

  const usaWaha = ehWaha({ whatsapp_provider: canal.provider });
  const provider: ProviderContato = usaWaha ? 'waha' : 'evolution';

  // Barreira de supressão — Fase 3A. Roda ANTES de qualquer chamada ao
  // provider (WAHA/Evolution) ou à IA.
  if (await estaSuprimido(admin, perfil.conta_id, telefone)) {
    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: null, campanhaId: campanhaIdNum,
      telefone, provider, canalId: canal.id, status: 'bloqueado_supressao',
      motivoBloqueio: 'Telefone suprimido (opt-out/supressão central da conta).',
    });
    return NextResponse.json(
      { erro: 'Este contato está suprimido (opt-out) e não pode receber disparo.', suprimido: true },
      { status: 403 },
    );
  }

  // Informativo, não bloqueia.
  const contatoAnterior = await contatoJaAbordado(admin, perfil.conta_id, telefone);

  if (usaWaha) {
    let status;
    try {
      status = await getOrCreateSession(wahaSessionName(perfil.conta_id));
    } catch {
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
        mensagemId, telefone, provider, canalId: canal.id, status: 'erro',
      });
      return NextResponse.json({ erro: falha }, { status: 400 });
    }
    if (status.status !== 'WORKING') {
      return NextResponse.json(
        { erro: 'O canal selecionado (WAHA) não está conectado. Conecte pelo QR Code em Configurações → WhatsApp.' },
        { status: 400 },
      );
    }
  } else if (!cred?.evolution_url || !cred?.evolution_instancia || !cred?.evolution_key) {
    return NextResponse.json(
      { erro: 'O canal selecionado (Evolution) não está conectado. Preencha endereço, instância e token em Configurações → WhatsApp.' },
      { status: 400 },
    );
  }

  // Estratégia de mensagem (Entrega 12): a campanha pode sobrescrever a
  // config padrão da conta (conta_config_envio). `mensagem_modo` null ou
  // 'padrao' = usa a config da conta, como antes.
  const campanhaSobrescreve = !!campanha?.mensagem_modo && campanha.mensagem_modo !== 'padrao';
  const modoMsg: 'ia' | 'fixa' | 'rodizio' = campanhaSobrescreve
    ? (campanha!.mensagem_modo as 'ia' | 'fixa' | 'rodizio')
    : (envio?.modo ?? 'ia');
  const textos: string[] = campanhaSobrescreve
    ? (Array.isArray(campanha?.mensagens) ? (campanha!.mensagens as string[]) : [])
    : (Array.isArray(envio?.mensagens) ? envio!.mensagens : []);
  const contextoIa: string = campanhaSobrescreve && campanha?.contexto_ia
    ? campanha.contexto_ia
    : (envio?.contexto ?? '');

  let mensagem: string;
  if (modoMsg === 'ia') {
    if (!cred.ia_key) {
      return NextResponse.json(
        { erro: 'O modo "A IA escreve" precisa de uma chave de IA em Configurações.' },
        { status: 400 },
      );
    }
    try {
      const { system, user } = montarPrompts(contextoIa, lead);
      mensagem = await gerarComIA((cred.ia_provedor ?? 'openai') as ProvedorIA, cred.ia_key, system, user, cred.ia_modelo);
    } catch {
      return NextResponse.json({ erro: 'A IA não respondeu. Tente de novo.' }, { status: 502 });
    }
  } else {
    if (!textos.length) {
      return NextResponse.json({ erro: 'Nenhuma mensagem cadastrada.' }, { status: 400 });
    }
    // rodízio alterna por lead; fixa usa sempre a primeira
    mensagem = modoMsg === 'rodizio' ? textos[Number(indice) % textos.length] : textos[0];
  }

  // Barreira final pré-envio (Fase 3A).
  if (await estaSuprimido(admin, perfil.conta_id, telefone)) {
    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: null, campanhaId: campanhaIdNum,
      telefone, provider, canalId: canal.id, status: 'bloqueado_supressao',
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

  // Registra o que aconteceu, mesmo quando falhou.
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

    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: salvo.id, campanhaId: campanhaIdNum,
      mensagemId, telefone, provider, canalId: canal.id, status: entregue ? 'enviado' : 'erro',
    });
    if (campanhaIdNum !== null) {
      await vincularLeadACampanha(admin, perfil.conta_id, campanhaIdNum, salvo.id, 'disparo');
    }
  }

  if (!entregue) return NextResponse.json({ erro: falha }, { status: 502 });
  return NextResponse.json({
    ok: true, mensagem, contatoAnterior,
    canal: { id: canal.id, nome: canal.nome, provider: canal.provider },
  });
}
