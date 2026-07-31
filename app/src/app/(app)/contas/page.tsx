import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Contas from '@/componentes/Contas';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const admin = supabaseAdmin();
  const [{ data: contas }, { data: perfis }, { data: smtp }] = await Promise.all([
    admin.from('contas').select('id, nome, slug, ativo, criado_em').order('criado_em'),
    admin.from('perfis').select('id, nome, email, papel, conta_id').order('criado_em'),
    admin.from('config_sistema').select('smtp_host, smtp_porta, smtp_usuario, smtp_remetente, smtp_senha').eq('id', 1).maybeSingle(),
  ]);

  return (
    <Contas
      contas={contas ?? []}
      perfis={perfis ?? []}
      contaAtiva={perfil.conta_id}
      meuId={perfil.id}
      smtp={{
        host: smtp?.smtp_host ?? '',
        porta: smtp?.smtp_porta ?? 587,
        usuario: smtp?.smtp_usuario ?? '',
        remetente: smtp?.smtp_remetente ?? '',
        // a senha em si nunca sai do servidor — só se ela existe ou não
        temSenha: !!smtp?.smtp_senha,
      }}
    />
  );
}
