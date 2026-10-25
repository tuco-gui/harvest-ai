import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import CentralTarefasCrm from '@/componentes/CentralTarefasCrm';

export default async function PaginaTarefasCrm() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/contas');

  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) redirect('/crm');

  const { data } = await admin.from('perfis').select('id,nome,email')
    .eq('conta_id', perfil.conta_id).order('nome');
  const owners = (data ?? []).map(o => ({ id: o.id, nome: o.nome || o.email || 'Usuário' }));

  return <CentralTarefasCrm
    owners={owners}
    perfilId={perfil.id}
    podeEditar={true}
  />;
}
