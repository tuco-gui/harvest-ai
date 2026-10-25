import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import CentralAtendimentosCrm from '@/componentes/CentralAtendimentosCrm';
import { telefoneAtendimento } from '@/lib/crmAtendimentos';

export default async function PaginaAtendimentosCrm({
  searchParams,
}: { searchParams: Promise<{ telefone?: string }> }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/contas');
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) redirect('/crm');
  const dados = await searchParams;
  const numero = telefoneAtendimento(dados.telefone);
  return <CentralAtendimentosCrm telefoneInicial={numero ?? undefined} />;
}
