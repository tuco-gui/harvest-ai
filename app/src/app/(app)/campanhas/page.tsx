import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Campanhas from '@/componentes/Campanhas';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  if (!perfil.conta_id) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Campanhas</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, maxWidth: 460 }}>
          Campanhas são por conta de cliente. Escolha uma em Contas e clique em "Trabalhar nesta conta".
        </p>
      </div>
    );
  }

  const admin = supabaseAdmin();
  const [{ data: campanhas }, { data: mensagens }] = await Promise.all([
    admin.from('prospecta_campanhas').select('*').eq('conta_id', perfil.conta_id).order('criado_em', { ascending: false }),
    admin.from('prospecta_mensagens')
      .select('status, prospecta_leads(campanha_id)')
      .eq('conta_id', perfil.conta_id).eq('direcao', 'saida'),
  ]);

  const contagem: Record<number, { enviadas: number; erros: number }> = {};
  for (const m of (mensagens ?? []) as any[]) {
    const campanhaId = m.prospecta_leads?.campanha_id;
    if (!campanhaId) continue;
    contagem[campanhaId] ??= { enviadas: 0, erros: 0 };
    if (m.status === 'enviada') contagem[campanhaId].enviadas++;
    else if (m.status === 'erro') contagem[campanhaId].erros++;
  }

  const comFunil = (campanhas ?? []).map((c) => ({
    ...c,
    enviadas: contagem[c.id]?.enviadas ?? 0,
    erros: contagem[c.id]?.erros ?? 0,
  }));

  return <Campanhas campanhas={comFunil} />;
}
