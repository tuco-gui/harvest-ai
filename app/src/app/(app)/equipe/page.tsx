import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Equipe from '@/componentes/Equipe';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const { data: equipe } = await supabaseAdmin()
    .from('perfis').select('id, nome, email').eq('papel', 'super_admin').order('criado_em');

  return <Equipe equipe={equipe ?? []} meuId={perfil.id} />;
}
