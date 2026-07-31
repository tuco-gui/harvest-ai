import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Prospeccao from '@/componentes/Prospeccao';

export default async function Pagina() {
  const perfil = await perfilAtual();

  let intervaloMin = 30;
  let intervaloMax = 60;
  if (perfil?.conta_id) {
    const { data } = await supabaseAdmin()
      .from('conta_config_envio').select('intervalo_min, intervalo_max').eq('conta_id', perfil.conta_id).maybeSingle();
    if (data?.intervalo_min) intervaloMin = data.intervalo_min;
    if (data?.intervalo_max) intervaloMax = data.intervalo_max;
  }

  return (
    <Prospeccao
      podeConfigurar={perfil?.papel !== 'operador'}
      intervaloMin={intervaloMin}
      intervaloMax={intervaloMax}
    />
  );
}
