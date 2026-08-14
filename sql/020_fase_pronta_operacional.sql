-- Fase "Prontidão operacional" (entrega Guinffer Pratas) — pesquisa ≠
-- campanha, configuração de campanha (mensagem/cadência/agendamento) e
-- estado durável de execução. Idempotente. LOCAL — não aplicado em
-- produção nesta entrega (ver RELATORIO_ENTREGAS.md, Entrega 12).
-- Rode com: ./scripts/sql.sh -f sql/020_fase_pronta_operacional.sql
--
-- Reaproveita schema existente (prospecta_campanhas, campanha_leads) em vez
-- de criar tabelas novas para "lista" — uma lista é uma
-- `prospecta_campanhas` com tipo='lista': mesma tabela, mesmo vínculo N:N
-- via campanha_leads, sem duplicar entidade. "Criar campanha" a partir de
-- uma pesquisa ou de uma lista salva sempre cria uma linha tipo='campanha'
-- nova (nunca promove a lista em si) — a lista continua reutilizável.

-- ---------------------------------------------------- prospecta_campanhas.tipo
alter table public.prospecta_campanhas
  add column if not exists tipo text not null default 'campanha';
alter table public.prospecta_campanhas
  drop constraint if exists prospecta_campanhas_tipo_check;
alter table public.prospecta_campanhas
  add constraint prospecta_campanhas_tipo_check check (tipo in ('lista', 'campanha'));
create index if not exists prospecta_campanhas_conta_tipo_idx
  on public.prospecta_campanhas (conta_id, tipo);

-- --------------------------------------------------- estado/agendamento
alter table public.prospecta_campanhas
  add column if not exists status text not null default 'rascunho';
alter table public.prospecta_campanhas
  drop constraint if exists prospecta_campanhas_status_check;
alter table public.prospecta_campanhas
  add constraint prospecta_campanhas_status_check
    check (status in ('rascunho', 'agendada', 'em_execucao', 'pausada', 'concluida', 'cancelada'));

alter table public.prospecta_campanhas
  add column if not exists agendado_para timestamptz;
alter table public.prospecta_campanhas
  add column if not exists agendado_timezone text not null default 'America/Sao_Paulo';

-- Campanhas já existentes (todas as anteriores a esta migration) são
-- tratadas como já "em execução/histórico" — não têm rascunho/agendamento;
-- não voltam para rascunho por causa desta migration.
update public.prospecta_campanhas set status = 'em_execucao'
  where status = 'rascunho' and criado_em < now();

-- ----------------------------------------------- estratégia de mensagem
-- null = "usar configuração padrão da conta" (conta_config_envio). Só
-- quando a campanha sobrescreve é que estes campos têm efeito — ver
-- app/src/app/api/disparo/route.ts (Entrega 12).
alter table public.prospecta_campanhas
  add column if not exists mensagem_modo text;
alter table public.prospecta_campanhas
  drop constraint if exists prospecta_campanhas_mensagem_modo_check;
alter table public.prospecta_campanhas
  add constraint prospecta_campanhas_mensagem_modo_check
    check (mensagem_modo is null or mensagem_modo in ('padrao', 'fixa', 'rodizio', 'ia'));
alter table public.prospecta_campanhas
  add column if not exists mensagens jsonb not null default '[]'::jsonb;
alter table public.prospecta_campanhas
  add column if not exists contexto_ia text;

-- --------------------------------------------------------------- cadência
alter table public.prospecta_campanhas
  add column if not exists cadencia_modo text not null default 'padrao';
alter table public.prospecta_campanhas
  drop constraint if exists prospecta_campanhas_cadencia_modo_check;
alter table public.prospecta_campanhas
  add constraint prospecta_campanhas_cadencia_modo_check
    check (cadencia_modo in ('padrao', 'rapida', 'moderada', 'conservadora', 'personalizada'));
alter table public.prospecta_campanhas
  add column if not exists cadencia_min integer;
alter table public.prospecta_campanhas
  add column if not exists cadencia_max integer;
alter table public.prospecta_campanhas
  drop constraint if exists prospecta_campanhas_cadencia_check;
alter table public.prospecta_campanhas
  add constraint prospecta_campanhas_cadencia_check
    check (
      cadencia_modo <> 'personalizada'
      or (cadencia_min is not null and cadencia_max is not null
          and cadencia_min > 0 and cadencia_max > cadencia_min)
    );
