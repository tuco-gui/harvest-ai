import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { crmBackend } from '@/lib/twenty';
import { perfilTemModulo } from '@/lib/autorizacao';
import { isAdmin } from '@/lib/crmControleAcesso';
import CrmPipeline from '@/componentes/CrmPipeline';
import { carregarCanais } from '@/lib/whatsappCanais';

export default async function PaginaCrm() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/contas');

  const admin = supabaseAdmin();
  if (!(await perfilTemModulo(admin, perfil, 'crm'))) redirect('/');

  const backend = await crmBackend(perfil.conta_id);
  const [ops, ownersData, campanhasData, canais] = await Promise.all([
    backend.listar(perfil.conta_id),
    admin
      .from('perfis')
      .select('id, nome, email')
      .eq('conta_id', perfil.conta_id)
      .order('nome'),
    admin.from('prospecta_campanhas').select('id, nome')
      .eq('conta_id', perfil.conta_id).order('criado_em', { ascending: false }).limit(100),
    carregarCanais(admin, perfil.conta_id),
  ]);

  const owners = (ownersData.data ?? []).map((p: any) => ({
    id: p.id,
    nome: p.nome ?? p.email ?? p.id,
  }));

  const opsFiltradas = isAdmin(perfil.papel)
    ? ops
    : ops.filter(o => o.owner_id === perfil.id);

  return (
    <div className="pagina pagina-larga crm-pagina">
      <header className="cabecalho-pagina">
        <p className="label">Comercial</p>
        <h1>Pipeline de vendas</h1>
        <p className="ajuda">
          Acompanhe oportunidades, próximas ações e conversas em um único lugar.
        </p>
      </header>
      <CrmPipeline
        oportunidades={opsFiltradas}
        owners={owners}
        campanhas={(campanhasData.data ?? []) as { id: number; nome: string }[]}
        canais={canais.filter((c) => c.ativo && c.status === 'conectado').map((c) => ({
          id: c.id, nome: c.nome, numero: c.numero, provider: c.provider,
        }))}
        papel={perfil.papel}
        perfilId={perfil.id}
      />
    </div>
  );
}
