import { notFound, redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import ChamadoDetalhe from '@/componentes/ChamadoDetalhe';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  const admin = supabaseAdmin();
  const { data: conversa } = await admin
    .from('conversas')
    .select('id, conta_id, assunto, categoria, status, criado_em, prazo_sla, contas(nome)')
    .eq('id', id).single();

  if (!conversa) notFound();
  if (conversa.conta_id !== perfil.conta_id && perfil.papel !== 'super_admin') {
    return (
      <div className="pagina">
        <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Esse chamado não é da sua conta.</p>
      </div>
    );
  }

  const { data: mensagens } = await admin
    .from('conversa_mensagens')
    .select('id, conteudo, criado_em, perfis(nome, email, papel)')
    .eq('conversa_id', id).order('criado_em');

  return <ChamadoDetalhe conversa={conversa as any} mensagens={(mensagens as any) ?? []} />;
}
