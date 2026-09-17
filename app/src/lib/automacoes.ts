import type { SupabaseClient } from '@supabase/supabase-js';
import { crmBackend } from './twenty';

/**
 * Motor de automações do funil — LEGACY, scheduled for removal.
 *
 * IMPORTANTE: Este motor está sendo substituído por:
 * - Twenty Workflows (CRM pipeline automations)
 * - Chatwoot Automations (conversational automations)
 *
 * NÃO adicionar novos gatilhos ou ações aqui.
 * Novas automações devem usar os motores nativos.
 *
 * Princípios:
 *  - Idempotente: reprocessar o mesmo evento não executa a mesma automação
 *    duas vezes (checagem via automacao_execucoes).
 *  - Seguro: falha em uma automação não bloqueia as outras nem o inbound.
 *  - Usa crmBackend() para movimentação — que pode ser Twenty ou Supabase.
 */

// ---------- Tipos ----------

export type GatilhoAutomacao =
  | 'mensagem_recebida'
  | 'mensagem_enviada'
  | 'resposta_positiva'
  | 'resposta_negativa'
  | 'opt_out'
  | 'oportunidade_entrando_estagio'
  | 'oportunidade_saindo_estagio';

export type AcaoAutomacao =
  | 'mover_estagio'
  | 'atribuir_responsavel'
  | 'atribuir_equipe'
  | 'adicionar_etiqueta'
  | 'registrar_atividade'
  | 'notificar_usuario'
  | 'iniciar_bot'
  | 'encerrar_oportunidade';

export type Automacao = {
  id: number;
  conta_id: string;
  funil_id: number;
  estagio_id: number;
  nome: string;
  ativo: boolean;
  gatilho: GatilhoAutomacao;
  condicao: Record<string, unknown>;
  acao: AcaoAutomacao;
  acao_parametros: Record<string, unknown>;
};

export type ContextoEvento = {
  contaId: string;
  telefone: string;
  mensagem: string | null;
  leadId: number | null;
  campanhaId: number | null;
  oportunidadeId: number | null;
  estagioAtual: string | null;
  classificacao: 'resposta' | 'negativa' | 'optout';
  agora: string;
  /** ID do evento inbound (inbound_eventos.id) — usado para idempotência por evento, não por oportunidade. */
  eventoInboundId?: number | null;
};

// ---------- Carregamento ----------

/**
 * Carrega automações ativas para um funil+estágio.
 * Filtra por conta (multi-tenant) e só retorna ativas.
 */
export async function carregarAutomacoes(
  admin: SupabaseClient,
  contaId: string,
  funilId: number,
  estagioId: number,
): Promise<Automacao[]> {
  const { data } = await admin
    .from('funil_automacoes')
    .select('*')
    .eq('conta_id', contaId)
    .eq('funil_id', funilId)
    .eq('estagio_id', estagioId)
    .eq('ativo', true)
    .order('id');
  return (data as Automacao[] | null) ?? [];
}

/**
 * Carrega TODAS as automações ativas da conta (para evaluation por funil).
 */
export async function carregarAutomacoesConta(
  admin: SupabaseClient,
  contaId: string,
): Promise<Automacao[]> {
  const { data } = await admin
    .from('funil_automacoes')
    .select('*')
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .order('id');
  return (data as Automacao[] | null) ?? [];
}

// ---------- Avaliação de triggers ----------

function correspondeGatilho(auto: Automacao, ctx: ContextoEvento): boolean {
  switch (auto.gatilho) {
    case 'mensagem_recebida':
      // Dispara para qualquer mensagem recebida (resposta, negativa ou opt-out)
      return true;

    case 'mensagem_enviada':
      // Dispara quando uma mensagem é enviada do CRM (outbound)
      return true;

    case 'resposta_positiva':
      // Dispara quando classificação é 'resposta' (não opt-out, não negativa)
      return ctx.classificacao === 'resposta';

    case 'resposta_negativa':
      // Dispara quando classificação é 'negativa' (resposta negativa comercial)
      return ctx.classificacao === 'negativa';

    case 'opt_out':
      return ctx.classificacao === 'optout';

    case 'oportunidade_entrando_estagio':
    case 'oportunidade_saindo_estagio':
      // Esses gatilhos são chamados por código dedicado (não pelo inbound direto).
      return true;

    default:
      return false;
  }
}

// ---------- Execução de ações ----------

async function executarAcao(
  admin: SupabaseClient,
  auto: Automacao,
  ctx: ContextoEvento,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    switch (auto.acao) {
      case 'mover_estagio': {
        const destinoId = auto.acao_parametros.estagio_destino_id as number | undefined;
        if (!destinoId || !ctx.oportunidadeId) return { ok: true }; // sem oportunidade, nada a fazer

        // Buscar nome do estágio destino
        const { data: estDestino } = await admin
          .from('funil_estagios')
          .select('nome, probabilidade, grupo')
          .eq('id', destinoId)
          .maybeSingle();
        if (!estDestino) return { ok: false, erro: `Estágio destino ${destinoId} não encontrado` };

        // Usar crmBackend() — pode ser Twenty ou Supabase dependendo da conta
        try {
          const backend = await crmBackend(ctx.contaId);
          await backend.atualizar(ctx.contaId, ctx.oportunidadeId, {
            estagio: estDestino.nome,
            probabilidade: estDestino.probabilidade,
          });
        } catch (e) {
          // Fallback: atualizar diretamente no Supabase se backend falhar
          console.warn(`[automacao] crmBackend falhou, usando Supabase direto:`, e);
          await admin.from('oportunidades')
            .update({
              estagio: estDestino.nome,
              probabilidade: estDestino.probabilidade,
              funil_estagio_id: destinoId,
              atualizado_em: ctx.agora,
            })
            .eq('id', ctx.oportunidadeId)
            .eq('conta_id', ctx.contaId);
        }

        console.log(`[automacao] mover_estagio: oportunidade ${ctx.oportunidadeId} → ${estDestino.nome}`);
        return { ok: true };
      }

      case 'encerrar_oportunidade': {
        if (!ctx.oportunidadeId) return { ok: true };
        const estagioEncerramento = (auto.acao_parametros.estagio as string) || 'Perdido';

        try {
          const backend = await crmBackend(ctx.contaId);
          await backend.atualizar(ctx.contaId, ctx.oportunidadeId, {
            estagio: estagioEncerramento,
            probabilidade: 0,
          });
        } catch (e) {
          console.warn(`[automacao] crmBackend falhou para encerrar, usando Supabase direto:`, e);
          await admin.from('oportunidades')
            .update({
              estagio: estagioEncerramento,
              probabilidade: 0,
              atualizado_em: ctx.agora,
            })
            .eq('id', ctx.oportunidadeId)
            .eq('conta_id', ctx.contaId);
        }

        console.log(`[automacao] encerrar_oportunidade: ${ctx.oportunidadeId} → ${estagioEncerramento}`);
        return { ok: true };
      }

      case 'adicionar_etiqueta': {
        if (!ctx.oportunidadeId) return { ok: true };
        const etiqueta = auto.acao_parametros.etiqueta as string;
        if (!etiqueta) return { ok: true };

        // Buscar etiquetas existentes e adicionar (append)
        const { data: op } = await admin
          .from('oportunidades')
          .select('etiquetas')
          .eq('id', ctx.oportunidadeId)
          .maybeSingle();

        const etiquetasAtuais: string[] = Array.isArray(op?.etiquetas) ? op.etiquetas : [];
        if (!etiquetasAtuais.includes(etiqueta)) {
          await admin.from('oportunidades')
            .update({ etiquetas: [...etiquetasAtuais, etiqueta], atualizado_em: ctx.agora })
            .eq('id', ctx.oportunidadeId)
            .eq('conta_id', ctx.contaId);
        }

        console.log(`[automacao] adicionar_etiqueta: oportunidade ${ctx.oportunidadeId} += ${etiqueta}`);
        return { ok: true };
      }

      case 'registrar_atividade': {
        // Registrar no historico_contato como atividade
        if (!ctx.leadId) return { ok: true };
        const nota = auto.acao_parametros.nota as string || 'Atividade automática';

        await admin.from('historico_contato').insert({
          conta_id: ctx.contaId,
          lead_id: ctx.leadId,
          campanha_id: ctx.campanhaId,
          telefone: ctx.telefone,
          provider: 'sistema',
          canal: 'automacao',
          status: 'atividade',
          origem: 'automacao',
          motivo_bloqueio: nota,
        });

        console.log(`[automacao] registrar_atividade: lead ${ctx.leadId} — ${nota}`);
        return { ok: true };
      }

      // Ações que requerem integração externa (Chatwoot, Twenty, notificações)
      // Implementação futura:
      case 'atribuir_responsavel':
      case 'atribuir_equipe':
      case 'notificar_usuario':
      case 'iniciar_bot':
        console.log(`[automacao] ${auto.acao}: ação '${auto.acao}' ainda não implementada (pendência P1/P3)`);
        return { ok: true };

      default:
        console.warn(`[automacao] ação desconhecida: ${auto.acao}`);
        return { ok: false, erro: `Ação '${auto.acao}' não suportada` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error(`[automacao] falha ao executar ação ${auto.acao} da automação ${auto.id}:`, msg);
    return { ok: false, erro: msg };
  }
}

// ---------- Pipeline principal ----------

/**
 * Processa automações para um evento inbound.
 *
 * Fluxo:
 * 1. Carrega automações ativas do estágio atual da oportunidade
 * 2. Para cada automação, avalia se o gatilho corresponde ao evento
 * 3. Se corresponde e não foi executada antes (idempotência), executa a ação
 * 4. Registra execução em automacao_execucoes
 *
 * Falha segura: erro em uma automação não bloqueia as outras.
 */
export async function processarAutomacoes(
  admin: SupabaseClient,
  ctx: ContextoEvento,
): Promise<void> {
  if (!ctx.oportunidadeId) { console.log('[automacao] skip: sem oportunidade'); return; }

  // Buscar oportunidade para saber funil + estágio atual
  const { data: oportunidade } = await admin
    .from('oportunidades')
    .select('funil_id, funil_estagio_id, estagio')
    .eq('id', ctx.oportunidadeId)
    .eq('conta_id', ctx.contaId)
    .maybeSingle();

  if (!oportunidade?.funil_id) { console.log(`[automacao] skip: op ${ctx.oportunidadeId} sem funil`); return; }

  const estagioId = oportunidade.funil_estagio_id;
  if (!estagioId) { console.log(`[automacao] skip: op ${ctx.oportunidadeId} sem funil_estagio_id`); return; }

  // Carregar automações do estágio
  const automacoes = await carregarAutomacoes(admin, ctx.contaId, oportunidade.funil_id, estagioId);
  console.log(`[automacao] op=${ctx.oportunidadeId} funil=${oportunidade.funil_id} estagio=${estagioId} autoCount=${automacoes.length} inboundId=${ctx.eventoInboundId} classificacao=${ctx.classificacao}`);
  if (!automacoes.length) return;

  for (const auto of automacoes) {
    // Avaliar gatilho
    if (!correspondeGatilho(auto, ctx)) continue;

    // Idempotência: usar eventoInboundId (único por mensagem) em vez de oportunidadeId.
    // Isso permite que a mesma automação dispare para mensagens diferentes na mesma oportunidade.
    const eventoChave = ctx.eventoInboundId ?? ctx.oportunidadeId;
    console.log(`[automacao] eval auto=${auto.id} gatilho=${auto.gatilho} eventoChave=${eventoChave} (inbound=${ctx.eventoInboundId} op=${ctx.oportunidadeId})`);
    const { data: existente } = await admin
      .from('automacao_execucoes')
      .select('id')
      .eq('automacao_id', auto.id)
      .eq('evento_id', eventoChave)
      .maybeSingle();
    if (existente) continue;

    // Executar ação
    const resultado = await executarAcao(admin, auto, ctx);

    // Registrar execução
    const { error: insertErr } = await admin.from('automacao_execucoes').insert({
      automacao_id: auto.id,
      conta_id: ctx.contaId,
      evento_tipo: 'inbound',
      evento_id: eventoChave,
      resultado: resultado.ok ? 'sucesso' : 'erro',
      erro: resultado.erro ?? null,
    });
    if (insertErr) {
      console.error(`[automacao] falha ao registrar execução auto=${auto.id} evento=${eventoChave}:`, insertErr.message);
    }
  }
}
