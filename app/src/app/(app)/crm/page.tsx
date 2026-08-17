import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { crmBackend } from '@/lib/twenty';
import { perfilTemModulo } from '@/lib/autorizacao';
import CrmPipeline from '@/componentes/CrmPipeline';

export default async function PaginaCrm() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel === 'operador') redirect('/');
  if (!perfil.conta_id) redirect('/contas');

  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm'))) redirect('/');

  const backend = crmBackend();
  const [ops, ownersData] = await Promise.all([
    backend.listar(perfil.conta_id),
    admin
      .from('perfis')
      .select('id, nome, email')
      .eq('conta_id', perfil.conta_id)
      .order('nome'),
  ]);

  const owners = (ownersData.data ?? []).map((p: any) => ({
    id: p.id,
    nome: p.nome ?? p.email ?? p.id,
  }));

  return (
    <div className="pagina pagina-larga">
      <header className="cabecalho-pagina">
        <h1>CRM</h1>
        <p className="ajuda">
          Pipeline de oportunidades. Arraste os cards entre os estágios. Clique para abrir a ficha.
        </p>
      </header>
      <CrmPipeline oportunidades={ops} owners={owners} />
    </div>
  );
}
