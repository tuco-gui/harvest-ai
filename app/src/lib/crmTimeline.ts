/**
 * CRM: linha do tempo de uma oportunidade, inspirada na experiência Deskcomm/Kommo.
 * Somente composição dos registros JÁ EXISTENTES do Harvest, sem copiar dados.
 */
export type EventoTimeline = {
  id: string;
  origem: 'atividade' | 'entrada' | 'saida';
  titulo: string;
  texto: string;
  data: string;
  status: string | null;
  vencimento: string | null;
  autor: string | null;
};

export type AtividadeTimeline = {
  id: number; tipo: string; titulo: string; descricao: string | null;
  concluida: boolean; vence_em: string | null; criado_em: string;
  autor_id?: string | null;
};
export type EntradaTimeline = {
  id: number; mensagem: string | null; tipo_mensagem: string | null;
  tipo_evento: string | null; recebido_em: string; nome_contato: string | null;
};
export type SaidaTimeline = {
  id: number; conteudo: string | null; status: string | null;
  criado_em: string; enviado_em: string | null; erro: string | null;
};

function textoResumido(value: string | null | undefined, fallback: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? v.slice(0, 4096) : fallback;
}

/**
 * A mesma mensagem enviada pode existir em prospecta_mensagens e crm_atividades.
 * Neste caso priorizamos a mensagem original e evitamos contar a atividade
 * whatsapp gerada no mesmo envio duas vezes. Não apagamos qualquer registro.
 */
export function montarTimeline(
  atividades: AtividadeTimeline[],
  entradas: EntradaTimeline[],
  saidas: SaidaTimeline[],
  autores: Record<string, string> = {},
  limite = 250,
): EventoTimeline[] {
  const conteudosEnviados = new Set(saidas.map(m => (m.conteudo ?? '').trim()).filter(Boolean));
  const eventos: EventoTimeline[] = [
    ...atividades
      .filter(a => !(a.tipo === 'whatsapp' && a.descricao && conteudosEnviados.has(a.descricao.trim())))
      .map(a => ({
        id: `a-${a.id}`, origem: 'atividade' as const,
        titulo: a.titulo || a.tipo, texto: textoResumido(a.descricao, ''),
        data: a.criado_em, status: a.tipo === 'tarefa'
          ? (a.concluida ? 'Concluída' : 'Pendente')
          : a.tipo === 'whatsapp' ? (a.concluida ? 'Enviada' : 'Falhou') : a.tipo,
        vencimento: a.vence_em, autor: a.autor_id ? autores[a.autor_id] ?? null : null,
      })),
    ...entradas.map(m => ({
      id: `e-${m.id}`, origem: 'entrada' as const,
      titulo: 'WhatsApp recebido', texto: textoResumido(m.mensagem, `[${m.tipo_mensagem || 'Mensagem sem texto'}]`),
      data: m.recebido_em, status: m.tipo_evento, vencimento: null,
      autor: m.nome_contato || null,
    })),
    ...saidas.map(m => ({
      id: `s-${m.id}`, origem: 'saida' as const,
      titulo: 'WhatsApp enviado', texto: textoResumido(m.conteudo, 'Mensagem sem texto'),
      data: m.enviado_em || m.criado_em, status: m.status === 'erro' && m.erro
        ? `Falha: ${m.erro.slice(0, 160)}` : m.status,
      vencimento: null, autor: null,
    })),
  ];
  return eventos
    .filter(e => !!e.data && !Number.isNaN(Date.parse(e.data)))
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data) || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(250, Math.trunc(limite))));
}

export function filtrarTimeline(eventos: EventoTimeline[], filtro: 'todos' | 'mensagens' | 'atividades') {
  if (filtro === 'mensagens') return eventos.filter(e => e.origem !== 'atividade');
  if (filtro === 'atividades') return eventos.filter(e => e.origem === 'atividade');
  return eventos;
}
