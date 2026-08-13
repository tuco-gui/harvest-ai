-- Fase 3A — Base outbound e proteção. EPIC roadmap comercial, etapa 1.
-- Idempotente. Rode com: ./scripts/sql.sh -f sql/016_base_outbound_protecao.sql
--
-- Três peças:
--   1. campanha_leads      — relação N:N lead<->campanha, preserva histórico
--      (prospecta_leads.campanha_id continua existindo como "campanha de
--      origem"; esta tabela é quem passa a valer para "esteve em quais
--      campanhas", sem depender só daquela coluna).
--   2. historico_contato   — uma linha por tentativa de disparo (campanha,
--      provider, status, quando), chave de consulta é o telefone — não o
--      lead_id — porque o mesmo telefone pode aparecer sob leads diferentes.
--   3. conta_supressao     — supressão central por conta+telefone, independe
--      de campanha e de provider (WAHA/Evolution).

-- ---------------------------------------------------------- campanha_leads
create table if not exists public.campanha_leads (
  id             bigserial primary key,
  conta_id       uuid not null references public.contas(id) on delete cascade,
  campanha_id    bigint not null references public.prospecta_campanhas(id) on delete cascade,
  lead_id        bigint not null references public.prospecta_leads(id) on delete cascade,
  origem         text not null default 'busca',  -- busca | planilha | manual | disparo
  adicionado_em  timestamptz not null default now(),
  constraint campanha_leads_campanha_lead_key unique (campanha_id, lead_id)
);
create index if not exists campanha_leads_conta_idx     on public.campanha_leads (conta_id);
create index if not exists campanha_leads_campanha_idx  on public.campanha_leads (campanha_id);
create index if not exists campanha_leads_lead_idx      on public.campanha_leads (lead_id);

-- Backfill: toda linha que já tem campanha_id ganha o vínculo N:N equivalente.
insert into public.campanha_leads (conta_id, campanha_id, lead_id, origem)
select l.conta_id, l.campanha_id, l.id, coalesce(l.origem, 'busca')
from public.prospecta_leads l
where l.campanha_id is not null and l.conta_id is not null
on conflict (campanha_id, lead_id) do nothing;

-- --------------------------------------------------------- historico_contato
-- Uma linha por tentativa (sucesso, erro ou bloqueio). telefone é o campo de
-- busca principal: é o que identifica "esse contato já foi abordado", não o
-- lead_id (o mesmo número pode reaparecer sob place_id/lead diferente).
create table if not exists public.historico_contato (
  id               bigserial primary key,
  conta_id         uuid not null references public.contas(id) on delete cascade,
  lead_id          bigint references public.prospecta_leads(id) on delete set null,
  campanha_id      bigint references public.prospecta_campanhas(id) on delete set null,
  mensagem_id      bigint references public.prospecta_mensagens(id) on delete set null,
  telefone         text not null,                    -- normalizado (dígitos + DDI 55)
  provider         text not null,                     -- waha | evolution
  canal            text not null default 'whatsapp',
  status           text not null default 'tentativa', -- tentativa | enviado | erro | bloqueado_supressao
  motivo_bloqueio  text,
  origem           text not null default 'disparo',
  criado_em        timestamptz not null default now()
);
create index if not exists historico_contato_conta_idx     on public.historico_contato (conta_id);
create index if not exists historico_contato_telefone_idx  on public.historico_contato (conta_id, telefone);
create index if not exists historico_contato_lead_idx      on public.historico_contato (lead_id);
create index if not exists historico_contato_campanha_idx  on public.historico_contato (campanha_id);

-- ------------------------------------------------------------ conta_supressao
-- Supressão central: um telefone suprimido não recebe disparo de NENHUMA
-- campanha, independente de qual provider (WAHA/Evolution) está configurado
-- na conta. unique(conta_id, telefone) é o que torna a checagem O(1).
create table if not exists public.conta_supressao (
  id           bigserial primary key,
  conta_id     uuid not null references public.contas(id) on delete cascade,
  telefone     text not null,                    -- normalizado (dígitos + DDI 55)
  motivo       text not null default 'opt_out',  -- opt_out | manual | reclamacao | invalido
  observacao   text,
  criado_por   uuid references public.perfis(id) on delete set null,
  criado_em    timestamptz not null default now(),
  constraint conta_supressao_conta_telefone_key unique (conta_id, telefone)
);
create index if not exists conta_supressao_conta_idx     on public.conta_supressao (conta_id);
create index if not exists conta_supressao_telefone_idx  on public.conta_supressao (conta_id, telefone);

-- ------------------------------------------------------------------------- RLS
alter table public.campanha_leads   enable row level security;
alter table public.historico_contato enable row level security;
alter table public.conta_supressao   enable row level security;

drop policy if exists campanha_leads_por_conta on public.campanha_leads;
create policy campanha_leads_por_conta on public.campanha_leads for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

drop policy if exists historico_contato_por_conta on public.historico_contato;
create policy historico_contato_por_conta on public.historico_contato for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

drop policy if exists conta_supressao_por_conta on public.conta_supressao;
create policy conta_supressao_por_conta on public.conta_supressao for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

-- --------------------------------------------------------------------- grants
grant select, insert, update, delete on public.campanha_leads    to authenticated;
grant select, insert, update, delete on public.historico_contato to authenticated;
grant select, insert, update, delete on public.conta_supressao   to authenticated;

grant usage, select on sequence public.campanha_leads_id_seq    to authenticated;
grant usage, select on sequence public.historico_contato_id_seq to authenticated;
grant usage, select on sequence public.conta_supressao_id_seq   to authenticated;

grant all privileges on public.campanha_leads    to service_role;
grant all privileges on public.historico_contato to service_role;
grant all privileges on public.conta_supressao   to service_role;

grant usage, select on sequence public.campanha_leads_id_seq    to service_role;
grant usage, select on sequence public.historico_contato_id_seq to service_role;
grant usage, select on sequence public.conta_supressao_id_seq   to service_role;

notify pgrst, 'reload schema';
