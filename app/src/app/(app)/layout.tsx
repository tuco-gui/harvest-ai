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

  // Carregar workspaces do usuário
  // Se conta_usuarios não existe, fallback para lista completa (super_admin)
  let contas: { id: string; nome: string }[] = [];

  const { data: memberships, error: memError } = await admin
    .from('conta_usuarios')
    .select('conta_id, papel, contas(id, nome, ativo)')
    .eq('user_id', perfil.id)
    .eq('ativo', true);

  if (!memError && memberships) {
    // Tabela existe — usar memberships
    contas = (memberships ?? [])
      .filter((m: any) => m.contas?.ativo)
      .map((m: any) => ({ id: m.conta_id, nome: m.contas.nome }));
  } else if (ehSuper) {
    // Tabela não existe ou erro — super admin vê todas as contas
    const { data } = await admin.from('contas').select('id, nome').eq('ativo', true).order('nome');
    contas = data ?? [];
  }

  let contaNome = 'Selecione uma conta';
  if (perfil.conta_id) {
    const { data } = await admin.from('contas').select('nome').eq('id', perfil.conta_id).single();
    if (data?.nome) contaNome = data.nome;
  } else if (contas.length === 1) {
    contaNome = contas[0].nome;
  } else if (ehSuper) {
    contaNome = 'Todas as contas';
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
        contas={contas}
        ehSuperAdmin={ehSuper}
        modulos={[...modulos]}
      />
      {children}
    </>
  );
}
