import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Prospeccao from '@/componentes/Prospeccao';

export default async function Pagina() {
  const perfil = await perfilAtual();

  let intervaloMin = 30;
  let intervaloMax = 60;
  let historico: { termo: string; quando: string; totalResultados: number; novosLeads: number }[] = [];
  if (perfil?.conta_id) {
    const admin = supabaseAdmin();
    const [{ data: envio }, { data: buscas }] = await Promise.all([
      admin.from('conta_config_envio').select('intervalo_min, intervalo_max').eq('conta_id', perfil.conta_id).maybeSingle(),
      admin.from('prospecta_buscas').select('termo, criado_em, total_resultados, novos_leads')
        .eq('conta_id', perfil.conta_id).order('criado_em', { ascending: false }).limit(15),
    ]);
    if (envio?.intervalo_min) intervaloMin = envio.intervalo_min;
    if (envio?.intervalo_max) intervaloMax = envio.intervalo_max;
    historico = (buscas ?? []).map((b) => ({
      termo: b.termo,
      quando: new Date(b.criado_em).toLocaleString('pt-BR'),
      totalResultados: b.total_resultados ?? 0,
      novosLeads: b.novos_leads ?? 0,
    }));
  }

  return (
    <Prospeccao
      podeConfigurar={perfil?.papel !== 'operador'}
      intervaloMin={intervaloMin}
      intervaloMax={intervaloMax}
      historico={historico}
    />
  );
}
