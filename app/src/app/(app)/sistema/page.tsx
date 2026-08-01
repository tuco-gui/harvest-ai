import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Sistema from '@/componentes/Sistema';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (perfil.papel !== 'super_admin') redirect('/');

  const { data: smtp } = await supabaseAdmin()
    .from('config_sistema')
    .select('smtp_host, smtp_porta, smtp_usuario, smtp_remetente, smtp_senha')
    .eq('id', 1).maybeSingle();

  return (
    <Sistema
      smtp={{
        host: smtp?.smtp_host ?? '',
        porta: smtp?.smtp_porta ?? 587,
        usuario: smtp?.smtp_usuario ?? '',
        remetente: smtp?.smtp_remetente ?? '',
        temSenha: !!smtp?.smtp_senha,
      }}
    />
  );
}
