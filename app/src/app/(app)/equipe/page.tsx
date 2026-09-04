import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Equipe from '@/componentes/Equipe';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  // Super admins são identificados pela membership papel='super_admin'
  const { data: superAdminMembers } = await supabaseAdmin()
    .from('conta_usuarios')
    .select('user_id')
    .eq('papel', 'super_admin')
    .eq('ativo', true);

  const superAdminIds = (superAdminMembers ?? []).map((m: any) => m.user_id);

  const { data: equipe } = superAdminIds.length > 0
    ? await supabaseAdmin()
        .from('perfis').select('id, nome, email').in('id', superAdminIds).order('criado_em')
    : { data: [] };

  return <Equipe equipe={equipe ?? []} meuId={perfil.id} />;
}
