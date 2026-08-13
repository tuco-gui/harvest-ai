import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { carregarModulos, modulosDaConta } from '@/lib/autorizacao';
import Topo from '@/componentes/Topo';
import DefinirSenha from '@/componentes/DefinirSenha';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  // Senha provisória ("NomeDaEmpresa1234") não navega em lugar nenhum até
  // virar uma senha de verdade — nem o super admin escapa disso.
  if (perfil.senha_provisoria) return <DefinirSenha email={perfil.email ?? ''} />;

  const admin = supabaseAdmin();
  const ehSuper = perfil.papel === 'super_admin';

  const { data: contas } = ehSuper
    ? await admin.from('contas').select('id, nome').eq('ativo', true).order('nome')
    : { data: [] as { id: string; nome: string }[] };

  let contaNome = ehSuper ? 'Nenhuma conta' : 'Figueira Marketing';
  if (perfil.conta_id) {
    const { data } = await admin.from('contas').select('nome').eq('id', perfil.conta_id).single();
    if (data?.nome) contaNome = data.nome;
  }

  const iniciais = (perfil.nome ?? perfil.email ?? '?')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  // Módulos habilitados para a conta (camada de autorização de visibilidade).
  const modulosHabilitados = await carregarModulos(admin, perfil);
  const modulos = modulosDaConta(modulosHabilitados, perfil.papel);

  return (
    <>
      <Topo
        nome={perfil.nome ?? ''}
        email={perfil.email ?? ''}
        papel={perfil.papel}
        iniciais={iniciais}
        avatarUrl={perfil.avatar_url}
        contaNome={contaNome}
        contas={contas ?? []}
        ehSuperAdmin={ehSuper}
        modulos={[...modulos]}
      />
      {children}
    </>
  );
}
