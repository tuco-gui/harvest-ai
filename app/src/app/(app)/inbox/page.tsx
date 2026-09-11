import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import Inbox from '@/componentes/Inbox';

export default async function PaginaInbox() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/');

  return <Inbox />;
}
