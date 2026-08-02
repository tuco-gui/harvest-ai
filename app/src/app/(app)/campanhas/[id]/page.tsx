import Link from 'next/link';
import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import CampanhaDetalhe from '@/componentes/CampanhaDetalhe';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/campanhas');

  const admin = supabaseAdmin();
  const [{ data: campanha }, { data: leads }, { data: envio }] = await Promise.all([
    admin.from('prospecta_campanhas').select('*').eq('id', id).eq('conta_id', perfil.conta_id).single(),
    admin.from('prospecta_leads')
      .select('id, place_id, empresa, telefone, telefone_original, endereco, especialidades, rating, reviews, site, tem_whatsapp, cnpj, decisor_nome, linkedin, email, email_status, erro_enriquecimento, disparo')
      .eq('campanha_id', id).eq('conta_id', perfil.conta_id)
      .order('empresa'),
    admin.from('conta_config_envio').select('intervalo_min, intervalo_max').eq('conta_id', perfil.conta_id).maybeSingle(),
  ]);

  if (!campanha) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Campanha não encontrada</h2>
        <p className="ajuda"><Link href="/campanhas">Voltar para Campanhas</Link></p>
      </div>
    );
  }

  return (
    <CampanhaDetalhe
      campanha={campanha}
      leads={leads ?? []}
      intervaloMin={envio?.intervalo_min ?? 30}
      intervaloMax={envio?.intervalo_max ?? 60}
    />
  );
}
