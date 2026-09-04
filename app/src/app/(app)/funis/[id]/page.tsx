import { redirect } from 'next/navigation';
import Link from 'next/link';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import FunilDetalhe from '@/componentes/FunilDetalhe';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/');

  const admin = supabaseAdmin();

  const [{ data: funil }, { data: estagios }] = await Promise.all([
    admin.from('funis').select('id, nome, ativo, criado_em')
      .eq('id', id).eq('conta_id', perfil.conta_id).maybeSingle(),
    admin.from('funil_estagios').select('*')
      .eq('funil_id', id).order('ordem'),
  ]);

  if (!funil) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Funil não encontrado</h2>
        <p className="ajuda"><Link href="/funis">Voltar para Funis</Link></p>
      </div>
    );
  }

  return <FunilDetalhe funil={funil} estagios={estagios ??[]} />;
}
