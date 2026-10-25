import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import { normalizarTelefone } from '@/lib/telefone';
import Inbox from '@/componentes/Inbox';

export default async function PaginaInbox({ searchParams }: { searchParams: Promise<{ telefone?: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/');

  const parametros = await searchParams;
  const tel = typeof parametros.telefone === 'string' ? normalizarTelefone(parametros.telefone) : '';
  return <Inbox telefoneInicial={tel || undefined} />;
}
