import Link from 'next/link';
import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
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

  const [{ data: leads }, { data: envio }, { data: canais }] = podeVer
    ? await Promise.all([
        admin.from('prospecta_leads')
          .select('id, place_id, empresa, telefone, telefone_original, endereco, especialidades, rating, reviews, site, tem_whatsapp, cnpj, decisor_nome, linkedin, email, email_status, erro_enriquecimento, disparo')
          .eq('campanha_id', id).eq('conta_id', campanha!.conta_id)
          .order('empresa'),
        admin.from('conta_config_envio').select('intervalo_min, intervalo_max').eq('conta_id', campanha!.conta_id).maybeSingle(),
        admin.from('whatsapp_canais').select('*').eq('conta_id', campanha!.conta_id)
          .order('padrao', { ascending: false }).order('id'),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  if (!podeVer) {
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
      canais={canais ?? []}
    />
  );
}
