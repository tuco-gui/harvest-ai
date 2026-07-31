import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Contas from '@/componentes/Contas';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const admin = supabaseAdmin();
  const [{ data: contas }, { data: perfis }] = await Promise.all([
    admin.from('contas').select('id, nome, slug, ativo, criado_em').order('criado_em'),
    admin.from('perfis').select('id, nome, email, papel, conta_id').order('criado_em'),
  ]);

  return (
    <Contas
      contas={contas ?? []}
      perfis={perfis ?? []}
      contaAtiva={perfil.conta_id}
      meuId={perfil.id}
    />
  );
}
