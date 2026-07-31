import { perfilAtual } from '@/lib/supabase/server';
import Prospeccao from '@/componentes/Prospeccao';

export default async function Pagina() {
  const perfil = await perfilAtual();
  return <Prospeccao podeConfigurar={perfil?.papel !== 'operador'} />;
}
