-- CRM pós-qualificação (P0). Espelho local das oportunidades do Twenty.
-- O Harvest é a experiência unificada (ADR-007); o Twenty é a fonte de verdade
-- remota. Enquanto a credencial Twenty não estiver disponível, o Supabase do
-- Harvest opera como backend do Pipeline (padrão BFF da auditoria VineCRM).
-- Quando o Twenty entrar, lib/twenty.ts troca o backend sem mexer nas rotas.

create table if not exists public.oportunidades (
  id                bigserial primary key,
  conta_id          uuid not null references public.contas(id) on delete cascade,
  lead_id           bigint unique references public.prospecta_leads(id) on delete set null,
  empresa           text not null default '',
  contato           text not null default '',
  telefone          text,
  email             text,
  origem            text not null default 'prospeccao',
  estagio           text not null default 'novo',
  owner_id          uuid references public.perfis(id) on delete set null,
  valor             numeric(12,2) not null default 0,
  proxima_acao      text,
  observacoes       text,
  previsao_fechamento date,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists oportunidades_conta_idx on public.oportunidades (conta_id);
create index if not exists oportunidades_estagio_idx on public.oportunidades (conta_id, estagio);
create index if not exists oportunidades_lead_idx on public.oportunidades (lead_id);

alter table public.oportunidades enable row level security;

drop policy if exists oportunidades_por_conta on public.oportunidades;
create policy oportunidades_por_conta on public.oportunidades for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

grant select, insert, update, delete on public.oportunidades to authenticated;
grant all privileges on public.oportunidades to service_role;
grant usage, select on sequence public.oportunidades_id_seq to authenticated;
grant usage, select on sequence public.oportunidades_id_seq to service_role;

notify pgrst, 'reload schema';
