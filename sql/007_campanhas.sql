-- Campanha: o nome que o cliente dá pra uma leva de prospecção (busca,
-- planilha ou manual), pra depois ver o funil inteiro dela — quantas achou,
-- quantas tinham WhatsApp, quantas saíram, quantas deram erro. Idempotente.

create table if not exists public.prospecta_campanhas (
  id            bigserial primary key,
  conta_id      uuid not null references public.contas(id) on delete cascade,
  criado_por    uuid references public.perfis(id) on delete set null,
  criado_em     timestamptz not null default now(),
  nome          text not null,
  origem        text not null default 'busca',  -- busca | planilha | manual
  encontradas   integer not null default 0,
  com_whatsapp  integer not null default 0
);
create index if not exists prospecta_campanhas_conta_idx on public.prospecta_campanhas (conta_id);

alter table public.prospecta_leads
  add column if not exists campanha_id bigint references public.prospecta_campanhas(id) on delete set null;
create index if not exists prospecta_leads_campanha_idx on public.prospecta_leads (campanha_id);

alter table public.prospecta_campanhas enable row level security;

drop policy if exists campanhas_por_conta on public.prospecta_campanhas;
create policy campanhas_por_conta on public.prospecta_campanhas for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

grant select, insert, update, delete on public.prospecta_campanhas to authenticated;
grant usage, select on sequence public.prospecta_campanhas_id_seq to authenticated;
grant all privileges on public.prospecta_campanhas to service_role;
grant usage, select on sequence public.prospecta_campanhas_id_seq to service_role;

notify pgrst, 'reload schema';
