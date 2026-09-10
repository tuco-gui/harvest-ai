import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Funis from '@/componentes/Funis';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');
  if (!perfil.conta_id) redirect('/');
  if (perfil.papel === 'operador') redirect('/');

  const admin = supabaseAdmin();

  const { data: funis } = await admin
    .from('funis')
    .select('id, nome, ativo, criado_em')
    .eq('conta_id', perfil.conta_id)
    .order('nome');

  // Buscar contagem de estágios por funil
  const funilIds = (funis ?? []).map((f) => f.id);
  const { data: estagios } = funilIds.length
    ? await admin.from('funil_estagios').select('funil_id, id').in('funil_id', funilIds)
    : { data: [] };

  const contagem = new Map<number, number>();
  for (const e of estagios ?? []) {
    contagem.set(e.funil_id, (contagem.get(e.funil_id) ?? 0) + 1);
  }

  const funisComContagem = (funis ?? []).map((f) => ({
    ...f,
    total_estagios: contagem.get(f.id) ?? 0,
  }));

  return <Funis funis={funisComContagem} />;
}
