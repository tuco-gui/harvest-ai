import Link from 'next/link';
import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { normalizarTelefone } from '@/lib/telefone';
import CampanhaDetalhe from '@/componentes/CampanhaDetalhe';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  const admin = supabaseAdmin();
  const { data: campanha } = await admin.from('prospecta_campanhas').select('*').eq('id', id).single();

  // Super admin acessa a campanha de qualquer cliente sem precisar "trabalhar
  // nessa conta" antes; admin/operador só a da própria conta ativa.
  const podeVer = campanha && (perfil.papel === 'super_admin' || campanha.conta_id === perfil.conta_id);

  const CAMPOS_LEAD = 'id, place_id, empresa, telefone, telefone_original, endereco, especialidades, rating, reviews, site, tem_whatsapp, cnpj, decisor_nome, linkedin, email, email_status, erro_enriquecimento, disparo';

  const [{ data: leadsPorFk }, { data: vinculos }, { data: envio }, { data: canais }, { data: historico }, { data: supressoes }] = podeVer
    ? await Promise.all([
        // Compatibilidade retroativa: campanhas antigas só têm o vínculo por
        // prospecta_leads.campanha_id (1ª campanha em que o lead apareceu).
        admin.from('prospecta_leads').select(CAMPOS_LEAD)
          .eq('campanha_id', id).eq('conta_id', campanha!.conta_id),
        // Fonte robusta (Entrega 12): N:N via campanha_leads — não quebra
        // quando o mesmo lead pertence a mais de uma campanha (bug da classe
        // "PRATA 925 ATIBAIA": contagem por campanha_id não bate com a
        // realidade quando há reuso do lead entre campanhas).
        admin.from('campanha_leads').select('lead_id').eq('campanha_id', id),
        admin.from('conta_config_envio').select('intervalo_min, intervalo_max').eq('conta_id', campanha!.conta_id).maybeSingle(),
        admin.from('whatsapp_canais').select('*').eq('conta_id', campanha!.conta_id)
          .order('padrao', { ascending: false }).order('id'),
        // Métricas duráveis (Entrega 12): calculadas no servidor a partir do
        // histórico real, não de estado do navegador — sobrevivem a refresh.
        admin.from('historico_contato').select('status, lead_id').eq('campanha_id', id),
        // Entrega 22: para "elegíveis" (tem telefone válido e não está
        // suprimido) — supressão é por telefone normalizado dentro da conta,
        // não por lead (ver lib/supressao.ts).
        admin.from('conta_supressao').select('telefone').eq('conta_id', campanha!.conta_id),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }];

  if (!podeVer) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Campanha não encontrada</h2>
        <p className="ajuda"><Link href="/campanhas">Voltar para Campanhas</Link></p>
      </div>
    );
  }

  const idsExtras = (vinculos ?? [])
    .map((v) => v.lead_id)
    .filter((leadId) => !(leadsPorFk ?? []).some((l) => l.id === leadId));

  const { data: leadsExtras } = idsExtras.length
    ? await admin.from('prospecta_leads').select(CAMPOS_LEAD).in('id', idsExtras)
    : { data: [] };

  const leads = [...(leadsPorFk ?? []), ...(leadsExtras ?? [])].sort((a, b) => a.empresa.localeCompare(b.empresa));

  // "Mensagens enviadas" (total de envios, pode ter reenvio pro mesmo lead)
  // vs. "Leads contatados" (quantos leads DISTINTOS já receberam pelo menos
  // um envio) — a confusão entre essas duas contagens era a causa do
  // relatório "2 leads → 4 enviadas" (Entrega 11/12).
  const linhasHistorico = historico ?? [];
  const enviadas = linhasHistorico.filter((h) => h.status === 'enviado').length;
  const leadsContatados = new Set(linhasHistorico.filter((h) => h.status === 'enviado' && h.lead_id).map((h) => h.lead_id)).size;
  const erros = linhasHistorico.filter((h) => h.status === 'erro').length;
  const bloqueados = linhasHistorico.filter((h) => h.status === 'bloqueado_supressao').length;
  const respondidos = linhasHistorico.filter((h) => h.status === 'recebido').length;
  const optouts = linhasHistorico.filter((h) => h.status === 'optout').length;

  // Elegível = tem telefone que normaliza para um formato válido E esse
  // telefone não está em conta_supressao. OPT-OUT ≠ ERRO e BLOQUEADO não é
  // necessariamente OPT-OUT (podem ser leads que nunca chegaram a
  // "responder SAIR", só foram barrados pela regra de supressão em outro
  // momento) — por isso essa contagem é sobre elegibilidade agora, não um
  // proxy de nenhuma das métricas de historico_contato acima.
  const telefonesSuprimidos = new Set((supressoes ?? []).map((s) => s.telefone));
  const elegiveis = leads.filter((l) => {
    const norm = normalizarTelefone(l.telefone_original ?? l.telefone ?? '');
    return norm && !telefonesSuprimidos.has(norm);
  }).length;

  return (
    <CampanhaDetalhe
      campanha={campanha}
      leads={leads}
      intervaloMin={envio?.intervalo_min ?? 30}
      intervaloMax={envio?.intervalo_max ?? 60}
      canais={canais ?? []}
      metricas={{ enviadas, leadsContatados, erros, bloqueados, respondidos, optouts, elegiveis }}
    />
  );
}
