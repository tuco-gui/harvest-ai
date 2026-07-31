import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Topo from '@/componentes/Topo';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  let conta = 'Figueira Marketing';
  if (perfil.conta_id) {
    const { data } = await supabaseAdmin().from('contas').select('nome').eq('id', perfil.conta_id).single();
    if (data?.nome) conta = data.nome;
  }

  const iniciais = (perfil.nome ?? perfil.email ?? '?')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  return (
    <>
      <Topo conta={conta} iniciais={iniciais} papel={perfil.papel} />
      {children}
    </>
  );
}
