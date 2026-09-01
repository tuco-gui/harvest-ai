import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { gerarComIA, montarPrompts, validarMensagemWhatsApp, type ProvedorIA } from '@/lib/ia';
import { getOrCreateSession, sendText as wahaSendText, usaWaha as ehWaha } from '@/lib/waha';
import { normalizarTelefone } from '@/lib/telefone';
import { estaSuprimido } from '@/lib/supressao';
import {
  contatoJaAbordado, registrarTentativaContato, type ProviderContato,
} from '@/lib/historicoContato';
import { vincularLeadACampanha } from '@/lib/campanhaLeads';
import {
  carregarCanais, resolverCanalDisparo, sessaoWahaDoCanal, type CanalWhatsApp,
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
    lead, indice = 0, campanhaId, canalId = null, canalIds = null, modoEnvio = null,
  } = await req.json().catch(() => ({}) as any);
  if (!lead?.telefone) {
    return NextResponse.json({ erro: 'Lead sem telefone.' }, { status: 400 });
  }
  const telefone = normalizarTelefone(lead.telefone);
  if (!telefone) {
    return NextResponse.json({ erro: 'Telefone do lead é inválido.' }, { status: 400 });
  }
  const campanhaIdNum = typeof campanhaId === 'number' ? campanhaId : null;
  const admin = supabaseAdmin();

  // Guarda fail-closed de ambiente (ADR-009): roda ANTES de qualquer outra
  // coisa, inclusive da barreira de supressão — numa conta marcada como
  // 'teste', número fora da whitelist de QA da conta nunca chega perto de
  // um provider real.
  const permissaoAmbiente = await envioPermitidoNoAmbiente(admin, perfil.conta_id, telefone);
  if (!permissaoAmbiente.ok) {
    return NextResponse.json({ erro: permissaoAmbiente.motivo, bloqueadoPorAmbiente: true }, { status: 403 });
  }

  // O id recebido da tela é a identidade canônica. Reencontrar o lead por
  // place_id criava/selecionava outro registro em alguns casos e separava a
  // mensagem da oportunidade que o CRM já tinha vinculada.
  const leadIdRecebido = Number(lead.id);
  const { data: leadPersistido } = Number.isInteger(leadIdRecebido)
    ? await admin.from('prospecta_leads')
        .select('id, conta_id, place_id, empresa, telefone, telefone_original')
        .eq('id', leadIdRecebido).eq('conta_id', perfil.conta_id).maybeSingle()
    : { data: null };
  if (!leadPersistido) {
    return NextResponse.json({ erro: 'Lead não encontrado na conta ativa.' }, { status: 404 });
  }
  if (campanhaIdNum !== null) {
    const { data: vinculo } = await admin.from('campanha_leads').select('id')
      .eq('conta_id', perfil.conta_id).eq('campanha_id', campanhaIdNum)
      .eq('lead_id', leadPersistido.id).maybeSingle();
    const { data: vinculoLegado } = vinculo ? { data: vinculo } : await admin.from('prospecta_leads')
      .select('id').eq('id', leadPersistido.id).eq('campanha_id', campanhaIdNum).maybeSingle();
    if (!vinculoLegado) {
      return NextResponse.json({ erro: 'Este lead não pertence à campanha informada.' }, { status: 400 });
    }
  }

  async function registrarFalha(motivo: string, provider: ProviderContato = 'waha', canal: CanalWhatsApp | null = null) {
    const { data: msg } = await admin.from('prospecta_mensagens').insert({
      conta_id: perfil!.conta_id, lead_id: leadPersistido!.id, parte: 1,
      direcao: 'saida', conteudo: '', status: 'erro', enviado_em: null, erro: motivo,
    }).select('id').maybeSingle();
    await registrarTentativaContato(admin, {
      contaId: perfil!.conta_id!, leadId: leadPersistido!.id, campanhaId: campanhaIdNum,
      mensagemId: msg?.id ?? null, telefone: telefone!, provider, canalId: canal?.id ?? null,
      status: 'erro', motivoBloqueio: motivo,
    });
  }

  // ---- Resolução do canal (multicanal) ----
  const [{ data: cred }, { data: envio }, { data: campanha }, canais] = await Promise.all([
    admin.from('conta_credenciais').select('*').eq('conta_id', perfil.conta_id).single(),
    admin.from('conta_config_envio').select('*').eq('conta_id', perfil.conta_id).single(),
    campanhaIdNum !== null
      ? admin.from('prospecta_campanhas')
          .select('modo_envio_numero, canal_ids, mensagem_modo, mensagens, contexto_ia')
          .eq('id', campanhaIdNum).eq('conta_id', perfil.conta_id).single()
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
  const idsRodizio = Array.isArray(canalIds) && canalIds.length
    ? canalIds.filter((id: unknown) => Number.isInteger(id))
    : campanha?.canal_ids;
  if (modo === 'rodizio' && Array.isArray(idsRodizio) && idsRodizio.length) {
    const ids = new Set(idsRodizio as number[]);
    canaisValidos = canais.filter((c) => ids.has(c.id));
  }

  const canal: CanalWhatsApp | null = resolverCanalDisparo(canaisValidos, modo, canalId, Number(indice));
  if (!canal) {
    await registrarFalha('Nenhum canal conectado e elegível foi encontrado para esta campanha.');
    return NextResponse.json(
      { erro: 'Nenhum canal de WhatsApp elegível para enviar. Conecte um número em Configurações → WhatsApp ou escolha um canal ativo.' },
      { status: 400 },
    );
  }

  const usaWaha = ehWaha({ whatsapp_provider: canal.provider });
  const provider: ProviderContato = usaWaha ? 'waha' : 'evolution';
  const sessaoWaha = usaWaha ? sessaoWahaDoCanal(canal) : null;

  // Barreira de supressão — Fase 3A. Roda ANTES de qualquer chamada ao
  // provider (WAHA/Evolution) ou à IA.
  if (await estaSuprimido(admin, perfil.conta_id, telefone)) {
    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: leadPersistido.id, campanhaId: campanhaIdNum,
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
      status = await getOrCreateSession(sessaoWaha!);
    } catch {
      const falha = 'Não consegui falar com o WAHA. Verifique se o servidor está no ar.';
      await registrarFalha(falha, provider, canal);
      return NextResponse.json({ erro: falha }, { status: 400 });
    }
    if (status.status !== 'WORKING') {
      await registrarFalha('O canal WAHA selecionado não está conectado (status diferente de WORKING).', provider, canal);
      return NextResponse.json(
        { erro: 'O canal selecionado (WAHA) não está conectado. Conecte pelo QR Code em Configurações → WhatsApp.' },
        { status: 400 },
      );
    }
  } else if (!cred?.evolution_url || !cred?.evolution_instancia || !cred?.evolution_key) {
    await registrarFalha('O canal Evolution não possui endereço, instância e token válidos.', provider, canal);
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
      await registrarFalha('A estratégia usa IA, mas não há chave de IA configurada na conta.', provider, canal);
      return NextResponse.json(
        { erro: 'O modo "A IA escreve" precisa de uma chave de IA em Configurações.' },
        { status: 400 },
      );
    }
    try {
      const { system, user } = montarPrompts(contextoIa, lead);
      const provedorIa = (cred.ia_provedor ?? 'openai') as ProvedorIA;
      let gerada = await gerarComIA(provedorIa, cred.ia_key, system, user, cred.ia_modelo);
      let validacao = validarMensagemWhatsApp(gerada);
      // Uma segunda geração estritamente orientada ao formato reduz falhas
      // transitórias de modelos de raciocínio sem jamais enviar a primeira
      // resposta defeituosa ao contato.
      if (!validacao.ok) {
        gerada = await gerarComIA(
          provedorIa, cred.ia_key,
          `${system}\n\nCORREÇÃO OBRIGATÓRIA: gere novamente e entregue somente a mensagem final completa.`,
          user, cred.ia_modelo,
        );
        validacao = validarMensagemWhatsApp(gerada);
      }
      if (!validacao.ok) {
        await registrarFalha(validacao.motivo, provider, canal);
        return NextResponse.json({ erro: `${validacao.motivo} Nada foi enviado.` }, { status: 422 });
      }
      mensagem = validacao.texto;
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : 'Falha desconhecida.';
      const falha = `A IA não gerou uma mensagem utilizável: ${detalhe}`;
      await registrarFalha(falha, provider, canal);
      return NextResponse.json({ erro: falha }, { status: 502 });
    }
  } else {
    if (!textos.length) {
      await registrarFalha('A estratégia selecionada não possui mensagem cadastrada.', provider, canal);
      return NextResponse.json({ erro: 'Nenhuma mensagem cadastrada.' }, { status: 400 });
    }
    // rodízio alterna por lead; fixa usa sempre a primeira
    mensagem = modoMsg === 'rodizio' ? textos[Number(indice) % textos.length] : textos[0];
  }

  // Barreira final pré-envio (Fase 3A).
  if (await estaSuprimido(admin, perfil.conta_id, telefone)) {
    await registrarTentativaContato(admin, {
      contaId: perfil.conta_id, leadId: leadPersistido.id, campanhaId: campanhaIdNum,
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
    entregue = await wahaSendText(sessaoWaha!, telefone, mensagem);
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
    .update({
      telefone,
      ...(entregue ? { disparo: 'sim', status: 'disparado', disparado_em: new Date().toISOString() } : {}),
    })
    .eq('id', leadPersistido.id).eq('conta_id', perfil.conta_id)
    .select('id').maybeSingle();

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
      motivoBloqueio: falha,
    });
    if (campanhaIdNum !== null) {
      await vincularLeadACampanha(admin, perfil.conta_id, campanhaIdNum, salvo.id, 'disparo');
    }
  }

  if (!entregue) return NextResponse.json({ erro: falha }, { status: 502 });
  // Se este lead já está no CRM, a conversa e o estágio acompanham o envio
  // feito pela campanha. Não cria oportunidade automaticamente.
  await admin.from('oportunidades')
    .update({ estagio: 'contatado', probabilidade: 10, atualizado_em: new Date().toISOString() })
    .eq('conta_id', perfil.conta_id).eq('lead_id', leadPersistido.id).eq('estagio', 'novo');
  return NextResponse.json({
    ok: true, mensagem, contatoAnterior,
    canal: { id: canal.id, nome: canal.nome, provider: canal.provider },
  });
}
