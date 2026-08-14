-- Fase 3C — Opt-out e status de resposta.
-- Rode com: ./scripts/sql.sh -f sql/019_fase_3c_optout_resposta.sql
--
-- Fecha o loop aberto pela Fase 3B: o inbound já é capturado em
-- inbound_eventos, mas NADA ainda detecta "o lead respondeu" nem "o lead
-- pediu opt-out". Esta migration só prepara o banco (índices e colunas de
-- apoio); a lógica de detecção vive em lib/optoutResposta.ts e no pipeline
-- inbound (lib/inbound.ts).
--
-- Reaproveita o que já existe (sem duplicar):
--   * conta_supressao (016) já guarda opt-out (motivo='opt_out') e bloqueia
--     disparo via lib/supressao.ts.
--   * prospecta_leads já tem respondeu_em + status='respondeu' (001/007).
--   * historico_contato (016) já grava contato; aqui só passamos a registrar
--     entrada de resposta (origem='resposta') e opt-out (status='optout').
--
-- Idempotente: safe re-run (create index if not exists / add column if not exists).

-- 1) índices para as consultas de resposta/opt-out (Fase 3C)
create index if not exists prospecta_leads_respondeu_idx
  on public.prospecta_leads (conta_id, respondeu_em) where respondeu_em is not null;

create index if not exists historico_contato_resposta_idx
  on public.historico_contato (conta_id, telefone, origem);

create index if not exists inbound_eventos_optout_idx
  on public.inbound_eventos (conta_id, telefone, tipo_evento)
  where tipo_evento = 'optout';

-- 2) coluna de apoio em inbound_eventos: marca se o evento foi classificado
--    como opt-out (palavra-chave), para QA/auditoria sem re-varrer o texto.
alter table public.inbound_eventos
  add column if not exists tipo_evento text not null default 'mensagem';
  -- 'mensagem' | 'optout'

-- 3) garante que o enum textual de historico_contato aceita os novos estados
--    usados pela 3C. Não há CHECK constraint hoje (status é text livre), então
--    só documentamos os valores aceitos:
--      origem: ... | 'resposta'  (entrada vinda de inbound)
--      status: ... | 'optout'    (pedido de parada / não perturbe)

-- 4) Reversibilidade (descomente para desfazer esta migration):
--   alter table public.inbound_eventos drop column if exists tipo_evento;
--   drop index if exists prospecta_leads_respondeu_idx;
--   drop index if exists historico_contato_resposta_idx;
--   drop index if exists inbound_eventos_optout_idx;
