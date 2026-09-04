import Link from 'next/link';
import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import ContaDetalhe from '@/componentes/ContaDetalhe';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/contas');

  const admin = supabaseAdmin();
  const [
    { data: conta },
    { data: usuarios },
    { data: cred },
    { data: campanhas },
    { data: mensagensErro },
    { data: leadsComErro },
    { data: conversas },
  ] = await Promise.all([
    admin.from('contas').select('id, nome, slug, ativo, modulos_habilitados, ambiente, whatsapp_qa_whitelist').eq('id', id).single(),
    admin.from('conta_usuarios').select('user_id, papel, criado_em, perfis(id, nome, email)')
      .eq('conta_id', id).eq('ativo', true).order('criado_em'),
    admin.from('conta_credenciais').select('*').eq('conta_id', id).maybeSingle(),
    admin.from('prospecta_campanhas').select('id, nome, origem, criado_em, encontradas, com_whatsapp')
      .eq('conta_id', id).order('criado_em', { ascending: false }),
    admin.from('prospecta_mensagens')
      .select('criado_em, erro, prospecta_leads(empresa)')
      .eq('conta_id', id).eq('status', 'erro')
      .order('criado_em', { ascending: false }).limit(30),
    admin.from('prospecta_leads').select('empresa, erro_enriquecimento, enriquecido_em')
      .eq('conta_id', id).not('erro_enriquecimento', 'is', null)
      .order('enriquecido_em', { ascending: false }).limit(30),
    admin.from('conversas').select('id, assunto, categoria, status, criado_em, prazo_sla')
      .eq('conta_id', id).order('criado_em', { ascending: false }),
  ]);

  if (!conta) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Conta não encontrada</h2>
        <p className="ajuda"><Link href="/contas">Voltar para Contas</Link></p>
      </div>
    );
  }

  // Mapear memberships para formato de exibição
  const usuariosFormatados = (usuarios ?? [])
    .filter((m: any) => m.perfis)
    .map((m: any) => ({
      id: m.perfis.id,
      nome: m.perfis.nome,
      email: m.perfis.email,
      papel: m.papel,
      criado_em: m.criado_em,
    }));

  const erros = [
    ...(mensagensErro ?? []).map((m: any) => ({
      tipo: 'Disparo', empresa: m.prospecta_leads?.empresa ?? 'Lead removido',
      erro: m.erro ?? 'Sem detalhe.', quando: new Date(m.criado_em).toLocaleString('pt-BR'), quandoOrdenar: m.criado_em,
    })),
    ...(leadsComErro ?? []).map((l: any) => ({
      tipo: 'Enriquecimento', empresa: l.empresa, erro: l.erro_enriquecimento,
      quando: l.enriquecido_em ? new Date(l.enriquecido_em).toLocaleString('pt-BR') : '—',
      quandoOrdenar: l.enriquecido_em ?? '',
    })),
  ].sort((a, b) => (a.quandoOrdenar < b.quandoOrdenar ? 1 : -1));

  return (
    <ContaDetalhe
      conta={conta}
      usuarios={usuariosFormatados}
      integracoes={{
        serpapi: !!cred?.serpapi_key,
        whatsapp: !!(cred?.evolution_url && cred?.evolution_instancia && cred?.evolution_key),
        ia: !!cred?.ia_key,
        decisor: cred?.decisor_provedor === 'gratis' ? 'grátis' : !!cred?.perplexity_key ? 'Perplexity' : null,
        linkedin: cred?.linkedin_provedor === 'tavily' ? !!cred?.tavily_key : !!cred?.serper_key,
        email: !!cred?.anymail_key || !!cred?.apollo_key || !!(cred?.snov_client_id && cred?.snov_client_secret),
      }}
      campanhas={campanhas ?? []}
      erros={erros}
      chamados={(conversas as any) ?? []}
    />
  );
}
