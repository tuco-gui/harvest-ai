import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Contas from '@/componentes/Contas';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const admin = supabaseAdmin();
  const { data: contas } = await admin
    .from('contas')
    .select('id, nome, slug, ativo, criado_em, modulos_habilitados')
    .order('criado_em');

  // Contar usuários por conta via conta_usuarios (com fallback legado)
  const nUsuariosPorConta: Record<string, number> = {};

  const { data: memberships, error: memError } = await admin
    .from('conta_usuarios')
    .select('conta_id')
    .eq('ativo', true);

  if (!memError && memberships) {
    for (const m of memberships) {
      nUsuariosPorConta[m.conta_id] = (nUsuariosPorConta[m.conta_id] ?? 0) + 1;
    }
  } else {
    // Fallback: contar via perfis.conta_id (legado)
    const { data: perfis } = await admin
      .from('perfis')
      .select('conta_id')
      .not('conta_id', 'is', null);
    for (const p of perfis ?? []) {
      if (p.conta_id) nUsuariosPorConta[p.conta_id] = (nUsuariosPorConta[p.conta_id] ?? 0) + 1;
    }
  }

  return (
    <Contas
      contas={contas ?? []}
      contaAtiva={perfil.conta_id}
      nUsuariosPorConta={nUsuariosPorConta}
    />
  );
}
