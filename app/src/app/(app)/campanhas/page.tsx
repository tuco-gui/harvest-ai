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
  const [{ data: campanhas }, { data: historico }, { data: canais }] = await Promise.all([
    admin.from('prospecta_campanhas').select('*').eq('conta_id', perfil.conta_id).order('criado_em', { ascending: false }),
    // Métricas via historico_contato (Entrega 12): `campanha_id` é gravado
    // explicitamente em cada tentativa de disparo (ver /api/disparo), então
    // não depende de prospecta_leads.campanha_id (que é só "1ª campanha em
    // que o lead apareceu" — a mesma classe de bug do caso "PRATA 925
    // ATIBAIA": contagem por essa FK subestima quando o lead é reaproveitado
    // em outra campanha).
    admin.from('historico_contato').select('campanha_id, status, lead_id').eq('conta_id', perfil.conta_id),
    admin.from('whatsapp_canais').select('*').eq('conta_id', perfil.conta_id)
      .order('padrao', { ascending: false }).order('id'),
  ]);

  const enviadasPorCampanha: Record<number, number> = {};
  const contatadosPorCampanha: Record<number, Set<number>> = {};
  const errosPorCampanha: Record<number, number> = {};
  const bloqueioPorCampanha: Record<number, number> = {};
  const respondeuPorCampanha: Record<number, number> = {};
  for (const h of (historico ?? []) as any[]) {
    if (!h.campanha_id) continue;
    if (h.status === 'enviado') {
      enviadasPorCampanha[h.campanha_id] = (enviadasPorCampanha[h.campanha_id] ?? 0) + 1;
      if (h.lead_id) {
        (contatadosPorCampanha[h.campanha_id] ??= new Set()).add(h.lead_id);
      }
    } else if (h.status === 'erro') {
      errosPorCampanha[h.campanha_id] = (errosPorCampanha[h.campanha_id] ?? 0) + 1;
    } else if (h.status === 'bloqueado_supressao') {
      bloqueioPorCampanha[h.campanha_id] = (bloqueioPorCampanha[h.campanha_id] ?? 0) + 1;
    } else if (h.status === 'recebido') {
      respondeuPorCampanha[h.campanha_id] = (respondeuPorCampanha[h.campanha_id] ?? 0) + 1;
    }
  }

  const todasComFunil = (campanhas ?? []).map((c) => ({
    ...c,
    // "Mensagens enviadas" (total de envios) e "leads contatados"
    // (distintos) são métricas diferentes — ver CampanhaDetalhe.tsx.
    enviadas: enviadasPorCampanha[c.id] ?? 0,
    leadsContatados: contatadosPorCampanha[c.id]?.size ?? 0,
    erros: errosPorCampanha[c.id] ?? 0,
    bloqueados: bloqueioPorCampanha[c.id] ?? 0,
    respondeu: respondeuPorCampanha[c.id] ?? 0,
  }));

  // Pesquisa ≠ campanha (Entrega 12): campanhas de verdade (tipo='campanha'
  // ou sem tipo — compatibilidade com registros anteriores à migration 020)
  // ficam na lista principal; "listas" salvas (tipo='lista') ficam à parte,
  // para reaproveitar depois em "Criar campanha".
  const comFunil = todasComFunil.filter((c) => c.tipo !== 'lista');
  const listas = todasComFunil.filter((c) => c.tipo === 'lista');

  return (
    <Campanhas
      campanhas={comFunil}
      listas={listas}
      podeConfigurar={perfil.papel !== 'operador'}
      canais={canais ?? []}
    />
  );
}
