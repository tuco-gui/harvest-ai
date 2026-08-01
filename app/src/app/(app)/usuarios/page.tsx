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
          Usuários são por conta de cliente. Escolha uma em Contas e clique em "Trabalhar nesta conta".
        </p>
      </div>
    );
  }

  const admin = supabaseAdmin();
  const [{ data: usuarios }, { data: conta }, { data: smtp }] = await Promise.all([
    admin.from('perfis').select('id, nome, email, papel').eq('conta_id', perfil.conta_id).order('criado_em'),
    admin.from('contas').select('nome').eq('id', perfil.conta_id).single(),
    admin.from('config_sistema').select('smtp_senha').eq('id', 1).maybeSingle(),
  ]);

  return (
    <Usuarios
      usuarios={usuarios ?? []}
      contaNome={conta?.nome ?? ''}
      meuId={perfil.id}
      temSmtp={!!smtp?.smtp_senha}
    />
  );
}
