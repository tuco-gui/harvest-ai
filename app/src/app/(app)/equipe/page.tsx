import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Equipe from '@/componentes/Equipe';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const admin = supabaseAdmin();

  // Tentar via conta_usuarios (multi-workspace)
  const { data: superAdminMembers, error: memError } = await admin
    .from('conta_usuarios')
    .select('user_id')
    .eq('papel', 'super_admin')
    .eq('ativo', true);

  let superAdminIds: string[] = [];

  if (!memError && superAdminMembers) {
    // Tabela existe
    superAdminIds = superAdminMembers.map((m: any) => m.user_id);
  } else {
    // Fallback: buscar via perfis.papel (legado)
    const { data: perfisSuperAdmin } = await admin
      .from('perfis')
      .select('id')
      .eq('papel', 'super_admin');
    superAdminIds = (perfisSuperAdmin ?? []).map((p: any) => p.id);
  }

  const { data: equipe } = superAdminIds.length > 0
    ? await admin
        .from('perfis').select('id, nome, email').in('id', superAdminIds).order('criado_em')
    : { data: [] };

  return <Equipe equipe={equipe ?? []} meuId={perfil.id} />;
}
