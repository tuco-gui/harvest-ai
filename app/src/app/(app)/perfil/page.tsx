import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import Perfil from '@/componentes/Perfil';

export default async function PaginaPerfil() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  return (
    <Perfil nome={perfil.nome} email={perfil.email} telefone={perfil.telefone} avatarUrl={perfil.avatar_url} />
  );
}
