import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Chamados from '@/componentes/Chamados';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  const admin = supabaseAdmin();
  let query = admin
    .from('conversas')
    .select('id, conta_id, assunto, categoria, status, criado_em, prazo_sla, respondido_em, contas(nome)')
    .order('criado_em', { ascending: false });

  if (perfil.conta_id) query = query.eq('conta_id', perfil.conta_id);
  else if (perfil.papel !== 'super_admin') {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Chamados</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, maxWidth: 460 }}>
          Escolha uma conta em Contas para abrir ou ver chamados.
        </p>
      </div>
    );
  }

  const { data } = await query;

  return (
    <Chamados
      conversas={(data as any) ?? []}
      mostrarConta={!perfil.conta_id}
      podeAbrir={!!perfil.conta_id}
    />
  );
}
