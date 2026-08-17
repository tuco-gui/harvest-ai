import Link from 'next/link';
import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import CampanhaEditar from '@/componentes/CampanhaEditar';
import { carregarCanais } from '@/lib/whatsappCanais';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  if (perfil.papel === 'operador') {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Sem permissão</h2>
        <p className="ajuda">Seu perfil não edita campanhas. <Link href={`/campanhas/${id}`}>Voltar</Link></p>
      </div>
    );
  }

  const admin = supabaseAdmin();
  const { data: campanha } = await admin.from('prospecta_campanhas').select('*').eq('id', id).single();
  const podeVer = campanha && (perfil.papel === 'super_admin' || campanha.conta_id === perfil.conta_id);

  if (!podeVer) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Campanha não encontrada</h2>
        <p className="ajuda"><Link href="/campanhas">Voltar para Campanhas</Link></p>
      </div>
    );
  }

  const [{ data: leadsPorFk }, { data: vinculos }, { data: envio }, { data: canais }] = await Promise.all([
    admin.from('prospecta_leads').select('id, empresa, telefone_original')
      .eq('campanha_id', id).eq('conta_id', campanha.conta_id),
    admin.from('campanha_leads').select('lead_id').eq('campanha_id', id),
    admin.from('conta_config_envio').select('intervalo_min, intervalo_max').eq('conta_id', campanha.conta_id).maybeSingle(),
    carregarCanais(admin, campanha.conta_id).then((data) => ({ data })),
  ]);

  const idsExtras = (vinculos ?? [])
    .map((v) => v.lead_id)
    .filter((leadId) => !(leadsPorFk ?? []).some((l) => l.id === leadId));

  const { data: leadsExtras } = idsExtras.length
    ? await admin.from('prospecta_leads').select('id, empresa, telefone_original').in('id', idsExtras)
    : { data: [] };

  const leads = [...(leadsPorFk ?? []), ...(leadsExtras ?? [])].sort((a, b) => a.empresa.localeCompare(b.empresa));

  return (
    <CampanhaEditar
      campanha={campanha}
      leadsIniciais={leads}
      intervaloMin={envio?.intervalo_min ?? 30}
      intervaloMax={envio?.intervalo_max ?? 60}
      canais={canais ?? []}
    />
  );
}
