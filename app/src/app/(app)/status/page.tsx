import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { metadadosSmtp } from '@/lib/smtpCredenciais';

type Item = { nome: string; ok: boolean; detalhe: string };

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  const admin = supabaseAdmin();
  const inicio = Date.now();
  const { error: erroBanco } = await admin.from('contas').select('id').limit(1);
  const tempoBanco = Date.now() - inicio;

  const smtpMeta = await metadadosSmtp();

  // Classificação de estado SMTP (não executa envio a cada load)
  let smtpEstado: 'não configurado' | 'configurado' | 'conexão validada' | 'envio validado' | 'entrega validada';
  let smtpDetalhe: string;

  if (!smtpMeta.configurado) {
    smtpEstado = 'não configurado';
    smtpDetalhe = `ambiente: ${smtpMeta.ambiente} — convites e senhas não saem por e-mail`;
  } else {
    smtpEstado = 'configurado';
    smtpDetalhe = `ambiente: ${smtpMeta.ambiente} | fonte: ${smtpMeta.fonte} | ${smtpMeta.host}:${smtpMeta.porta}`;
    // Nota: "conexão validada" / "envio validado" / "entrega validada"
    // exigem teste explícito via /sistema (ação do super admin), não health check passivo.
  }

  const itens: Item[] = [
    {
      nome: 'Banco de dados',
      ok: !erroBanco,
      detalhe: erroBanco ? erroBanco.message : `respondendo em ${tempoBanco} ms`,
    },
    {
      nome: 'E-mail do sistema (SMTP)',
      ok: smtpMeta.configurado,
      detalhe: smtpDetalhe,
    },
  ];

  // Erros recentes (sanitizados — nunca mostramos stack trace nem segredo).
  const { data: errosRecentes } = await admin
    .from('historico_contato')
    .select('criado_em, status, provider')
    .eq('conta_id', perfil.conta_id)
    .in('status', ['erro', 'bloqueado_supressao'])
    .order('criado_em', { ascending: false })
    .limit(8);

  // Logs operacionais sanitizados (Fase 3B.1.1): busca/whatsapp/inbound/ia/banco.
  // origem='log' grava só texto seguro (lib/logOperacional); nunca tem segredo.
  const { data: logsOp } = await admin
    .from('historico_contato')
    .select('criado_em, status, motivo_bloqueio')
    .eq('conta_id', perfil.conta_id)
    .eq('origem', 'log')
    .eq('canal', 'log')
    .order('criado_em', { ascending: false })
    .limit(12);

  // Timeline única (Entrega 12): "Erros recentes" e "Logs operacionais" eram
  // duas seções separadas mostrando a mesma tabela por ângulos diferentes —
  // difícil entender a ordem real dos eventos. Aqui elas viram uma única
  // linha do tempo, ordenada por data, cada item com sua origem marcada.
  // Eventos anteriores à ponte n8n ser desligada (Fase 3B.4, "busca nativa")
  // que mencionam "n8n" no texto são marcados como histórico/resolvido —
  // não representam mais o estado atual do sistema.
  type EventoTimeline = {
    quando: string; origem: 'erro' | 'log'; rotulo: string; detalhe: string; historico: boolean;
  };
  const timeline: EventoTimeline[] = [
    ...(errosRecentes ?? []).map((e): EventoTimeline => ({
      quando: e.criado_em,
      origem: 'erro',
      rotulo: (e.status as string).replace(/_/g, ' '),
      detalhe: String(e.provider ?? ''),
      historico: false,
    })),
    ...(logsOp ?? []).map((l): EventoTimeline => {
      const texto = (l.motivo_bloqueio as string) ?? '';
      const componente = texto.split(':')[0] ?? 'geral';
      const soCliente = perfil.papel !== 'super_admin';
      const resumo = soCliente
        ? texto.replace(/\[[^\]]*\]/g, '').replace(/cid:[^\s]*/g, '').slice(0, 160)
        : texto.slice(0, 240);
      return {
        quando: l.criado_em,
        origem: 'log',
        rotulo: componente.toUpperCase(),
        detalhe: resumo || '(sem detalhe)',
        historico: /n8n/i.test(texto),
      };
    }),
  ].sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime()).slice(0, 20);

  // BUG CONFIRMADO (2026-08-13): esta query selecionava a coluna `tipo`, que
  // nunca existiu em `inbound_eventos` (colunas reais: tipo_mensagem;
  // tipo_evento só existe após a migration 019 da Fase 3C, ainda não
  // deployada). PostgREST rejeita a query inteira por coluna inexistente,
  // `data` vem null, e a UI mostrava "sem eventos recentes" mesmo com
  // eventos reais gravados (confirmado: 8 linhas em produção, incluindo um
  // opt-out real). Corrigido para as colunas que de fato existem.
  const inboundRecentes = perfil.conta_id
    ? await admin
        .from('inbound_eventos')
        .select('criado_em, provider, tipo_mensagem')
        .eq('conta_id', perfil.conta_id)
        .order('criado_em', { ascending: false })
        .limit(5)
    : { data: null, error: null };

  if (inboundRecentes.error) {
    console.error('[status] falha ao consultar inbound_eventos:', inboundRecentes.error.message);
  }

  let canaisDetalhe: { id: number; nome: string; provider: string; status: string; ativo: boolean }[] = [];

  if (perfil.conta_id) {
    const { data: cred } = await admin
      .from('conta_credenciais').select('serpapi_key, evolution_url, evolution_key, ia_key')
      .eq('conta_id', perfil.conta_id).maybeSingle();
    const { data: canais } = await admin
      .from('whatsapp_canais').select('id, nome, provider, status, ativo')
      .eq('conta_id', perfil.conta_id).order('padrao', { ascending: false });
    canaisDetalhe = canais ?? [];

    // BUG CONFIRMADO (2026-08-14, QA de produção): este card checava só se
    // `conta_credenciais.evolution_url/evolution_key` existiam — campos legados
    // que podem ficar preenchidos mesmo sem nenhum canal Evolution realmente
    // conectado hoje (confirmado em produção: Guinffer tem essas credenciais
    // salvas, mas nenhuma linha provider='evolution' em whatsapp_canais — o
    // único canal real é WAHA). Isso mostrava "Evolution: OK" mesmo sem canal
    // vivo, exatamente o falso-positivo que a Saúde não deve mostrar. Corrigido
    // para checar o canal real em whatsapp_canais (mesma fonte de verdade do
    // card "WhatsApp — canais" logo abaixo), não a credencial legada isolada.
    const evolutionConectada = (canais ?? []).some(
      (c) => c.provider === 'evolution' && c.status === 'conectado' && c.ativo,
    );
    const evolutionCredenciada = !!(cred?.evolution_url && cred?.evolution_key);
    itens.push(
      { nome: 'Busca (SerpAPI)', ok: !!cred?.serpapi_key, detalhe: cred?.serpapi_key ? 'chave cadastrada' : 'sem chave — teste em Configurações' },
      {
        nome: 'WhatsApp (Evolution)',
        ok: evolutionConectada,
        detalhe: evolutionConectada
          ? 'canal conectado'
          : evolutionCredenciada
            ? 'credenciais salvas, mas nenhum canal Evolution conectado agora'
            : 'sem configuração — conecte em Configurações → WhatsApp',
      },
      { nome: 'IA', ok: !!cred?.ia_key, detalhe: cred?.ia_key ? 'chave cadastrada' : 'sem chave — só necessária no modo "A IA escreve"' },
    );

    const totalCanais = canais?.length ?? 0;
    const canaisAtivos = (canais ?? []).filter((c) => c.ativo).length;
    const canaisConectados = (canais ?? []).filter((c) => c.status === 'conectado').length;
    itens.push({
      nome: `WhatsApp — canais (${totalCanais})`,
      ok: totalCanais > 0 && canaisAtivos > 0,
      detalhe: totalCanais === 0
        ? 'nenhum canal conectado — adicione em Configurações → WhatsApp'
        : `${canaisAtivos} ativo(s), ${canaisConectados} conectado(s) de ${totalCanais}`,
    });

    const inbound = inboundRecentes?.data ?? [];
    itens.push({
      nome: 'Inbound / webhooks',
      ok: true,
      detalhe: inbound.length
        ? `${inbound.length} evento(s) recente(s) — ${[...new Set(inbound.map((e) => e.provider))].join(', ')}`
        : 'sem eventos recentes',
    });
  }

  const tudoOk = itens.every((i) => i.ok);

  return (
    <div className="pagina pagina-larga">
      <section className="secao">
        <h2>Saúde</h2>
        <p className="resumo-secao">
          {tudoOk ? 'Tudo funcionando.' : 'Alguma coisa precisa de atenção — veja abaixo.'}
        </p>

        <div className="grade-saude">
          {itens.map((i) => (
            <div key={i.nome} className="cartaocfg cartao-saude">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{i.nome}</span>
                <span className="selo" style={{ borderColor: i.ok ? 'var(--green)' : 'var(--red)', color: i.ok ? 'var(--green)' : 'var(--red)' }}>
                  {i.ok ? 'OK' : 'Atenção'}
                </span>
              </div>
              <p style={{ color: 'var(--ink-3)', fontSize: 13, margin: '6px 0 0' }}>{i.detalhe}</p>
            </div>
          ))}
        </div>

        {!perfil.conta_id && (
          <p className="ajuda" style={{ marginTop: 14 }}>
            Busca, WhatsApp e IA são configurados por conta de cliente — entre numa conta pra ver o
            status delas.
          </p>
        )}
      </section>

      {canaisDetalhe.length > 0 && (
        <section className="secao">
          <h2>WhatsApp — status por canal</h2>
          <p className="resumo-secao">Estado real de cada número conectado, direto de whatsapp_canais.</p>
          <table className="tabela">
            <thead>
              <tr><th>Canal</th><th>Provider</th><th>Status</th><th>Ativo</th></tr>
            </thead>
            <tbody>
              {canaisDetalhe.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td style={{ color: 'var(--ink-2)' }}>{c.provider}</td>
                  <td>
                    <span className="selo" style={{
                      borderColor: c.status === 'conectado' ? 'var(--green)' : 'var(--red)',
                      color: c.status === 'conectado' ? 'var(--green)' : 'var(--red)',
                    }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ color: c.ativo ? 'var(--green)' : 'var(--ink-3)' }}>{c.ativo ? 'sim' : 'não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="secao">
        <h2>Linha do tempo — erros e eventos operacionais</h2>
        <p className="resumo-secao">
          Erros de envio/bloqueio e logs de Busca, WhatsApp, Inbound, IA e Banco, numa timeline única
          por ordem de acontecimento. Texto sanitizado — nenhuma credencial ou dado sensível é
          exibido. Eventos marcados <b>histórico</b> são da época da ponte n8n (desligada) e não
          refletem o funcionamento atual.
          {perfil.papel !== 'super_admin' && ' Detalhe técnico adicional é restrito à equipe Figueira.'}
        </p>
        <div className="cartaocfg">
          {timeline.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {timeline.map((ev, idx) => (
                <li key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: ev.historico ? 0.6 : 1 }}>
                  <span className="selo" style={{ borderColor: 'var(--rule-2)', color: 'var(--ink-2)' }}>
                    {ev.rotulo}
                  </span>
                  {ev.historico && (
                    <span className="selo" style={{ borderColor: 'var(--ink-3)', color: 'var(--ink-3)' }}>histórico</span>
                  )}
                  <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                    {new Date(ev.quando).toLocaleString('pt-BR')} · {ev.detalhe}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ajuda">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
