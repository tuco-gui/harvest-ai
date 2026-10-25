import { redirect } from 'next/navigation';
import Link from 'next/link';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import FunilDetalhe from '@/componentes/FunilDetalhe';
import { carregarCanais } from '@/lib/whatsappCanais';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/');

  const admin = supabaseAdmin();

  const [{ data: funil }, { data: estagios }, canais] = await Promise.all([
    admin.from('funis').select('id, nome, ativo, criado_em, canal_padrao_id')
      .eq('id', id).eq('conta_id', perfil.conta_id).maybeSingle(),
    admin.from('funil_estagios').select('*')
      .eq('funil_id', id).order('ordem'),
    carregarCanais(admin, perfil.conta_id),
  ]);

  if (!funil) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Funil não encontrado</h2>
        <p className="ajuda"><Link href="/funis">Voltar para Funis</Link></p>
      </div>
    );
  }

  return <FunilDetalhe funil={funil} estagios={estagios ??[]} canais={canais.filter(c=>c.ativo).map(c=>({id:c.id,nome:c.nome,numero:c.numero,status:c.status,provider:c.provider,padrao:c.padrao}))} />;
}
