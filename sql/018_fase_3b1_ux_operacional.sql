-- Fase 3B.1 — UX operacional e WhatsApp multicanal. Antecipação parcial da
-- Fase 3F, urgente para entrega da conta Guinffer Pratas. Idempotente.
-- Rode com: ./scripts/sql.sh -f sql/018_fase_3b1_ux_operacional.sql
--
-- Três peças:
--   1. contas.modulos_habilitados — habilitação de recurso por conta, para
--      não depender só do papel (super_admin/admin/operador) na hora de
--      decidir o que uma conta cliente enxerga. Hoje só é lido (nenhuma UI
--      de administração dele existe ainda — ver Entrega 07 do RELATORIO).
--   2. whatsapp_canais — entidade de canal/número de WhatsApp da conta, para
--      a conta poder ter N números no futuro. Nasce com 1 linha por conta
--      já configurada (backfill de conta_credenciais), pois hoje o produto
--      ainda só conecta um provider por vez.
--   3. historico_contato.canal_id e prospecta_campanhas.{modo_envio_numero,
--      canal_ids} — rastreabilidade de qual canal foi usado, e preparo para
--      seleção fixo/rodízio no disparo.

-- ------------------------------------------------------- contas.modulos_habilitados
alter table public.contas
  add column if not exists modulos_habilitados text[] not null
    default array['whatsapp','ia','usuarios','chamados','status']::text[];

-- ------------------------------------------------------------- whatsapp_canais
create table if not exists public.whatsapp_canais (
  id                    bigserial primary key,
  conta_id              uuid not null references public.contas(id) on delete cascade,
  nome                  text not null default 'Principal',
  provider              text not null,               -- waha | evolution
  numero                text,                          -- normalizado, quando conhecido
  identificador_externo text,                          -- sessão WAHA ou instância Evolution
  status                text not null default 'desconhecido', -- conectado | desconectado | desconhecido
  ativo                 boolean not null default true,
  padrao                boolean not null default true,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
create index if not exists whatsapp_canais_conta_idx on public.whatsapp_canais (conta_id);
create index if not exists whatsapp_canais_conta_padrao_idx on public.whatsapp_canais (conta_id, padrao);

-- Backfill: uma linha "Principal" por conta que já tem provider configurado.
insert into public.whatsapp_canais (conta_id, nome, provider, identificador_externo, status, ativo, padrao)
select
  cc.conta_id,
  'Principal',
  cc.whatsapp_provider,
  case when cc.whatsapp_provider = 'evolution' then cc.evolution_instancia else null end,
  'desconhecido',
  true,
  true
from public.conta_credenciais cc
where cc.whatsapp_provider is not null
  and not exists (select 1 from public.whatsapp_canais wc where wc.conta_id = cc.conta_id);

-- ------------------------------------------------------- historico_contato.canal_id
alter table public.historico_contato
  add column if not exists canal_id bigint references public.whatsapp_canais(id) on delete set null;
create index if not exists historico_contato_canal_idx on public.historico_contato (canal_id);

-- ------------------------------------------------- prospecta_campanhas (seleção de canal)
alter table public.prospecta_campanhas
  add column if not exists modo_envio_numero text not null default 'fixo'; -- fixo | rodizio
alter table public.prospecta_campanhas
  add column if not exists canal_ids bigint[] not null default '{}'::bigint[];

-- ------------------------------------------------------------------------- RLS
alter table public.whatsapp_canais enable row level security;

drop policy if exists whatsapp_canais_por_conta on public.whatsapp_canais;
create policy whatsapp_canais_por_conta on public.whatsapp_canais for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

-- --------------------------------------------------------------------- grants
grant select, insert, update, delete on public.whatsapp_canais to authenticated;
grant usage, select on sequence public.whatsapp_canais_id_seq to authenticated;
grant all privileges on public.whatsapp_canais to service_role;
grant usage, select on sequence public.whatsapp_canais_id_seq to service_role;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------- rollback
-- Aditivo, nenhuma tabela existente foi tocada além de colunas novas (com
-- default, então nada quebra em linha já existente). Se precisar desfazer
-- ANTES de tráfego real usar essas colunas:
--   alter table public.prospecta_campanhas drop column if exists canal_ids;
--   alter table public.prospecta_campanhas drop column if exists modo_envio_numero;
--   alter table public.historico_contato drop column if exists canal_id;
--   drop policy if exists whatsapp_canais_por_conta on public.whatsapp_canais;
--   drop table if exists public.whatsapp_canais;
--   alter table public.contas drop column if exists modulos_habilitados;
