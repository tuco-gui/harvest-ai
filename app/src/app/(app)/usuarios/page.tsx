import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Usuarios from '@/componentes/Usuarios';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel === 'operador') redirect('/');

  if (!perfil.conta_id) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Usuários</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, maxWidth: 460 }}>
          Escolha uma workspace no seletor do topo para gerenciar usuários.
        </p>
      </div>
    );
  }

  const admin = supabaseAdmin();
  let usuarios: { id: string; nome: string | null; email: string | null; papel: string }[] = [];

  // Tentar via conta_usuarios (multi-workspace)
  const { data: memberships, error: memError } = await admin
    .from('conta_usuarios')
    .select('user_id, papel, ativo, criado_em, perfis(id, nome, email)')
    .eq('conta_id', perfil.conta_id)
    .order('criado_em');

  if (!memError && memberships) {
    // Tabela existe — usar memberships
    usuarios = (memberships ?? [])
      .filter((m: any) => m.perfis && m.ativo)
      .map((m: any) => ({
        id: m.perfis.id,
        nome: m.perfis.nome,
        email: m.perfis.email,
        papel: m.papel,
      }));
  } else {
    // Fallback: buscar via perfis.conta_id (legado)
    const { data: perfisLegado } = await admin
      .from('perfis')
      .select('id, nome, email, papel')
      .eq('conta_id', perfil.conta_id)
      .order('criado_em');
    usuarios = (perfisLegado ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      papel: p.papel,
    }));
  }

  const [{ data: conta }, { data: smtp }] = await Promise.all([
    admin.from('contas').select('nome').eq('id', perfil.conta_id).single(),
    admin.from('config_sistema').select('smtp_senha').eq('id', 1).maybeSingle(),
  ]);

  return (
    <Usuarios
      usuarios={usuarios}
      contaNome={conta?.nome ?? ''}
      meuId={perfil.id}
      temSmtp={!!smtp?.smtp_senha}
    />
  );
}
