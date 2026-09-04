import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Contas from '@/componentes/Contas';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const admin = supabaseAdmin();
  const [{ data: contas }, { data: memberships }] = await Promise.all([
    admin.from('contas').select('id, nome, slug, ativo, criado_em, modulos_habilitados').order('criado_em'),
    admin.from('conta_usuarios').select('conta_id').eq('ativo', true),
  ]);

  const nUsuariosPorConta: Record<string, number> = {};
  for (const m of memberships ?? []) {
    nUsuariosPorConta[m.conta_id] = (nUsuariosPorConta[m.conta_id] ?? 0) + 1;
  }

  return (
    <Contas
      contas={contas ?? []}
      contaAtiva={perfil.conta_id}
      nUsuariosPorConta={nUsuariosPorConta}
    />
  );
}
