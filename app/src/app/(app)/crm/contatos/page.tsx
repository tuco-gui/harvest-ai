import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import { crmBackend } from '@/lib/twenty';
import ContatosCrm from '@/componentes/ContatosCrm';
import CadastrosCRM from '@/componentes/CadastrosCRM';

export default async function PaginaContatosCrm() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/contas');
  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm')) ||
      !(await perfilTemModulo(admin, perfil, 'crm_avancado'))) redirect('/crm');
  const [backend, donos] = await Promise.all([
    crmBackend(perfil.conta_id),
    admin.from('perfis').select('id,nome,email').eq('conta_id', perfil.conta_id).order('nome'),
  ]);
  const todas = await backend.listar(perfil.conta_id);
  const oportunidades = isAdmin(perfil.papel)
    ? todas : todas.filter(o => o.owner_id === perfil.id);
  const owners = (donos.data ?? []).map(o => ({
    id: o.id, nome: o.nome || o.email || 'Responsável',
  }));
  return isAdmin(perfil.papel)
    ? <CadastrosCRM entidade="contatos" oportunidadesRelacionadas={oportunidades} />
    : <ContatosCrm oportunidades={oportunidades} owners={owners}/>;
}
