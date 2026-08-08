-- HAI-001A — Isolamento multi-tenant: place_id passa a ser único POR CONTA.
-- EPIC HAI-001, Tarefa 1. Idempotente.
--
-- Antes: `place_id` tinha UNIQUE global — a conta B não conseguia salvar um
-- lead com o mesmo place_id do Google Maps que a conta A (o upsert de B
-- atualizava/colidia com a linha de A). Depois: `unique(conta_id, place_id)`.
--
-- Rode com: ./scripts/sql.sh -f sql/014_isolamento_place_id.sql
--
-- Pré-requisito: a coluna conta_id já existe em prospecta_leads (002).

-- ---------------------------------------------------------------- checagem
-- Se já houver duplicatas (conta_id, place_id) o ALTER abaixo falharia. Não
-- deveria existir (o UNIQUE global impedia), mas paramos com mensagem clara.
do $$
begin
  if exists (
    select 1 from (
      select conta_id, place_id
      from public.prospecta_leads
      where place_id is not null
      group by conta_id, place_id
      having count(*) > 1
    ) duplicados
  ) then
    raise exception 'HAI-001A: existem duplicatas (conta_id, place_id) em prospecta_leads. Resolva antes de aplicar a migração.';
  end if;
end $$;

-- Remove o UNIQUE global criado pelo inline `place_id text unique` no 001.
alter table public.prospecta_leads
  drop constraint if exists prospecta_leads_place_id_key;

-- Cria o UNIQUE composto por conta (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prospecta_leads_conta_place_id_key'
      and conrelid = 'public.prospecta_leads'::regclass
  ) then
    alter table public.prospecta_leads
      add constraint prospecta_leads_conta_place_id_key unique (conta_id, place_id);
  end if;
end $$;

-- Índice de consulta por conta (mantém rápidas as buscas de dedupe/leads).
create index if not exists prospecta_leads_conta_idx on public.prospecta_leads (conta_id);
