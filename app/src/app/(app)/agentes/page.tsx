import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import PainelAgentes from '@/componentes/PainelAgentes';

export default async function PaginaAgentes() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/contas');
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'agentes'))) redirect('/');
  return <PainelAgentes editavel={perfil.papel !== 'operador'} />;
}
