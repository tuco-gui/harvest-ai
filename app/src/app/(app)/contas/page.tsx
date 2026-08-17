import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Contas from '@/componentes/Contas';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const admin = supabaseAdmin();
  const [{ data: contas }, { data: perfis }] = await Promise.all([
    admin.from('contas').select('id, nome, slug, ativo, criado_em, modulos_habilitados').order('criado_em'),
    admin.from('perfis').select('conta_id').not('conta_id', 'is', null),
  ]);

  const nUsuariosPorConta: Record<string, number> = {};
  for (const p of perfis ?? []) {
    if (p.conta_id) nUsuariosPorConta[p.conta_id] = (nUsuariosPorConta[p.conta_id] ?? 0) + 1;
  }

  return (
    <Contas
      contas={contas ?? []}
      contaAtiva={perfil.conta_id}
      nUsuariosPorConta={nUsuariosPorConta}
    />
  );
}
