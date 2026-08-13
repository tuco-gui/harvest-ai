import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

type Item = { nome: string; ok: boolean; detalhe: string };

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  const admin = supabaseAdmin();
  const inicio = Date.now();
  const { error: erroBanco } = await admin.from('contas').select('id').limit(1);
  const tempoBanco = Date.now() - inicio;

  const { data: smtp } = await admin.from('config_sistema').select('smtp_senha').eq('id', 1).maybeSingle();

  const itens: Item[] = [
    {
      nome: 'Banco de dados',
      ok: !erroBanco,
      detalhe: erroBanco ? erroBanco.message : `respondendo em ${tempoBanco} ms`,
    },
    {
      nome: 'E-mail do sistema (SMTP)',
      ok: !!smtp?.smtp_senha,
      detalhe: smtp?.smtp_senha ? 'configurado' : 'não configurado — convites e senhas aparecem só na tela',
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

  const inboundRecentes = perfil.conta_id
    ? await admin
        .from('inbound_eventos')
        .select('criado_em, provider, tipo')
        .eq('conta_id', perfil.conta_id)
        .order('criado_em', { ascending: false })
        .limit(5)
    : { data: null };

  if (perfil.conta_id) {
    const { data: cred } = await admin
      .from('conta_credenciais').select('serpapi_key, evolution_url, evolution_key, ia_key')
      .eq('conta_id', perfil.conta_id).maybeSingle();
    const { data: canais } = await admin
      .from('whatsapp_canais').select('id, nome, provider, status, ativo')
      .eq('conta_id', perfil.conta_id).order('padrao', { ascending: false });

    itens.push(
      { nome: 'Busca (SerpAPI)', ok: !!cred?.serpapi_key, detalhe: cred?.serpapi_key ? 'chave cadastrada' : 'sem chave — teste em Configurações' },
      { nome: 'WhatsApp (Evolution)', ok: !!(cred?.evolution_url && cred?.evolution_key), detalhe: cred?.evolution_url && cred?.evolution_key ? 'configurado' : 'sem configuração — teste em Configurações' },
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
    <div className="pagina">
      <section className="secao">
        <h2>Status</h2>
        <p className="resumo-secao">
          {tudoOk ? 'Tudo funcionando.' : 'Alguma coisa precisa de atenção — veja abaixo.'}
        </p>

        <table className="tabela">
          <tbody>
            {itens.map((i) => (
              <tr key={i.nome}>
                <td>{i.nome}</td>
                <td>
                  <span className="selo" style={{ borderColor: i.ok ? 'var(--green)' : 'var(--red)', color: i.ok ? 'var(--green)' : 'var(--red)' }}>
                    {i.ok ? 'OK' : 'Atenção'}
                  </span>
                </td>
                <td style={{ color: 'var(--ink-3)' }}>{i.detalhe}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!perfil.conta_id && (
          <p className="ajuda" style={{ marginTop: 14 }}>
            Busca, WhatsApp e IA são configurados por conta de cliente — entre numa conta pra ver o
            status delas.
          </p>
        )}
      </section>

      <section className="secao">
        <h2>Erros recentes</h2>
        <p className="resumo-secao">
          Últimas tentativas de envio com falha ou bloqueio. Nenhuma credencial ou dado sensível é exibido.
        </p>
        <div className="cartaocfg">
          {errosRecentes?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {errosRecentes.map((e, idx) => (
                <li key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="selo" style={{ borderColor: 'var(--rule-2)', color: 'var(--ink-2)' }}>
                    {(e.status as string).replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                    {new Date(e.criado_em).toLocaleString('pt-BR')} · {e.provider}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ajuda">Nenhum erro recente.</p>
          )}
        </div>
      </section>

      <section className="secao">
        <h2>Logs operacionais</h2>
        <p className="resumo-secao">
          Eventos recentes de Busca, WhatsApp, Inbound, IA e Banco. Texto sanitizado — nenhuma
          credencial ou dado sensível é exibido.
          {perfil.papel !== 'super_admin' && ' Detalhe técnico adicional é restrito à equipe Figueira.'}
        </p>
        <div className="cartaocfg">
          {logsOp?.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {logsOp.map((l, idx) => {
                const texto = (l.motivo_bloqueio as string) ?? '';
                const componente = texto.split(':')[0] ?? 'geral';
                const soCliente = perfil.papel !== 'super_admin';
                const resumo = soCliente
                  ? texto.replace(/\[[^\]]*\]/g, '').replace(/cid:[^\s]*/g, '').slice(0, 160)
                  : texto.slice(0, 240);
                return (
                  <li key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="selo" style={{ borderColor: 'var(--rule-2)', color: 'var(--ink-2)' }}>
                      {(componente as string).toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                      {new Date(l.criado_em).toLocaleString('pt-BR')} · {resumo || '(sem detalhe)'}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ajuda">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
