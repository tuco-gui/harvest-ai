import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Configuracoes from '@/componentes/Configuracoes';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  // Operador não alcança credencial nem regra de envio — é o que impede
  // quem opera no dia a dia de quebrar a configuração sem querer.
  if (perfil.papel === 'operador') {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, letterSpacing: '-.02em' }}>
          Configurações
        </h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
          Só o administrador da conta altera chaves e regras de envio. Fale com ele se algo precisa mudar.
        </p>
      </div>
    );
  }

  if (!perfil.conta_id) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Configurações</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, maxWidth: 460 }}>
          Configurações são por conta de cliente. Escolha uma no seletor ao lado do logo, ou vá em
          Contas para criar a primeira.
        </p>
      </div>
    );
  }

  const admin = supabaseAdmin();
  const [{ data: cred }, { data: envio }, { data: mensagensErro }, { data: leadsComErro }, { data: canais }, { data: conta }] = await Promise.all([
    admin.from('conta_credenciais').select('*').eq('conta_id', perfil.conta_id).single(),
    admin.from('conta_config_envio').select('*').eq('conta_id', perfil.conta_id).single(),
    admin.from('prospecta_mensagens')
      .select('criado_em, erro, prospecta_leads(empresa)')
      .eq('conta_id', perfil.conta_id).eq('status', 'erro')
      .order('criado_em', { ascending: false }).limit(50),
    admin.from('prospecta_leads')
      .select('empresa, erro_enriquecimento, enriquecido_em')
      .eq('conta_id', perfil.conta_id).not('erro_enriquecimento', 'is', null)
      .order('enriquecido_em', { ascending: false }).limit(50),
    admin.from('whatsapp_canais').select('*').eq('conta_id', perfil.conta_id)
      .order('padrao', { ascending: false }).order('id'),
    admin.from('contas').select('modulos_habilitados').eq('id', perfil.conta_id).maybeSingle(),
  ]);

  const erros = [
    ...(mensagensErro ?? []).map((m: any) => ({
      tipo: 'Disparo',
      empresa: m.prospecta_leads?.empresa ?? 'Lead removido',
      erro: m.erro ?? 'Sem detalhe.',
      quando: new Date(m.criado_em).toLocaleString('pt-BR'),
      quandoOrdenar: m.criado_em,
    })),
    ...(leadsComErro ?? []).map((l: any) => ({
      tipo: 'Enriquecimento',
      empresa: l.empresa,
      erro: l.erro_enriquecimento,
      quando: l.enriquecido_em ? new Date(l.enriquecido_em).toLocaleString('pt-BR') : '—',
      quandoOrdenar: l.enriquecido_em ?? '',
    })),
  ].sort((a, b) => (a.quandoOrdenar < b.quandoOrdenar ? 1 : -1));

  // Módulos habilitados: enriquecimento interno só para quem tem o módulo
  // (super_admin sempre tem — definido em lib/autorizacao).
  const modulos = new Set<string>((conta?.modulos_habilitados as string[] | null) ?? []);
  const mostraEnriquecimento = perfil.papel === 'super_admin' || modulos.has('enriquecimento');

  return (
    <Configuracoes
      temSerpapi={!!cred?.serpapi_key}
      evolutionUrl={cred?.evolution_url ?? ''}
      evolutionInstancia={cred?.evolution_instancia ?? ''}
      temEvolutionKey={!!cred?.evolution_key}
      whatsappProvider={cred?.whatsapp_provider ?? 'evolution'}
      temIa={!!cred?.ia_key}
      iaProvedor={cred?.ia_provedor ?? 'groq'}
      iaModelo={cred?.ia_modelo ?? ''}
      temPerplexity={!!cred?.perplexity_key}
      decisorProvedor={cred?.decisor_provedor ?? 'perplexity'}
      temSerper={!!cred?.serper_key}
      temTavily={!!cred?.tavily_key}
      linkedinProvedor={cred?.linkedin_provedor ?? 'serper'}
      emailProvedor={cred?.email_provedor ?? 'anymail'}
      temAnymail={!!cred?.anymail_key}
      temApollo={!!cred?.apollo_key}
      temSnov={!!cred?.snov_client_id && !!cred?.snov_client_secret}
      modo={envio?.modo ?? 'ia'}
      mensagens={(envio?.mensagens as string[]) ?? []}
      contexto={envio?.contexto ?? ''}
      intervaloMin={envio?.intervalo_min ?? 30}
      intervaloMax={envio?.intervalo_max ?? 60}
      erros={erros}
      canais={canais ?? []}
      mostraEnriquecimento={mostraEnriquecimento}
      eSuperAdmin={perfil.papel === 'super_admin'}
    />
  );
}
