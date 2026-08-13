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
  const [{ data: campanhas }, { data: mensagens }, { data: bloqueios }, { data: canais }] = await Promise.all([
    admin.from('prospecta_campanhas').select('*').eq('conta_id', perfil.conta_id).order('criado_em', { ascending: false }),
    admin.from('prospecta_mensagens')
      .select('status, prospecta_leads(campanha_id)')
      .eq('conta_id', perfil.conta_id).eq('direcao', 'saida'),
    admin.from('historico_contato')
      .select('campanha_id, status')
      .eq('conta_id', perfil.conta_id)
      .in('status', ['optout', 'bloqueado_supressao', 'bloqueado_optout']),
    admin.from('whatsapp_canais').select('*').eq('conta_id', perfil.conta_id)
      .order('padrao', { ascending: false }).order('id'),
  ]);

  const contagem: Record<number, { enviadas: number; erros: number }> = {};
  for (const m of (mensagens ?? []) as any[]) {
    const campanhaId = m.prospecta_leads?.campanha_id;
    if (!campanhaId) continue;
    contagem[campanhaId] ??= { enviadas: 0, erros: 0 };
    if (m.status === 'enviada') contagem[campanhaId].enviadas++;
    else if (m.status === 'erro') contagem[campanhaId].erros++;
  }

  const bloqueioPorCampanha: Record<number, number> = {};
  for (const h of (bloqueios ?? []) as any[]) {
    if (!h.campanha_id) continue;
    bloqueioPorCampanha[h.campanha_id] = (bloqueioPorCampanha[h.campanha_id] ?? 0) + 1;
  }

  const comFunil = (campanhas ?? []).map((c) => ({
    ...c,
    enviadas: contagem[c.id]?.enviadas ?? 0,
    erros: contagem[c.id]?.erros ?? 0,
    bloqueados: bloqueioPorCampanha[c.id] ?? 0,
  }));

  return (
    <Campanhas
      campanhas={comFunil}
      podeConfigurar={perfil.papel !== 'operador'}
      canais={canais ?? []}
    />
  );
}
