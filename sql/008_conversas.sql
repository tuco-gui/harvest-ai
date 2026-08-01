-- Caixa de mensagens: hoje só chamado de suporte, desenhada de forma
-- genérica (conversas + mensagens) pra no futuro também servir de conversa
-- interna dentro da própria equipe do cliente, sem precisar mudar o schema.
-- Idempotente.

do $$ begin
  create type public.conversa_status as enum ('aberta', 'respondida', 'fechada');
exception when duplicate_object then null; end $$;

create table if not exists public.conversas (
  id             bigserial primary key,
  conta_id       uuid not null references public.contas(id) on delete cascade,
  aberto_por     uuid references public.perfis(id) on delete set null,
  assunto        text not null,
  tipo           text not null default 'suporte',   -- suporte | interna (futuro)
  categoria      text not null default 'duvida',    -- duvida | tecnico | financeiro | outro
  status         public.conversa_status not null default 'aberta',
  criado_em      timestamptz not null default now(),
  prazo_sla      timestamptz not null,
  respondido_em  timestamptz
);
create index if not exists conversas_conta_idx on public.conversas (conta_id);

create table if not exists public.conversa_mensagens (
  id           bigserial primary key,
  conversa_id  bigint not null references public.conversas(id) on delete cascade,
  autor_id     uuid references public.perfis(id) on delete set null,
  conteudo     text not null,
  criado_em    timestamptz not null default now()
);
create index if not exists conversa_mensagens_conversa_idx on public.conversa_mensagens (conversa_id);

alter table public.conversas enable row level security;
alter table public.conversa_mensagens enable row level security;

drop policy if exists conversas_por_conta on public.conversas;
create policy conversas_por_conta on public.conversas for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

-- conversa_mensagens não tem conta_id direto — a policy olha pela conversa dona
drop policy if exists conversa_mensagens_por_conta on public.conversa_mensagens;
create policy conversa_mensagens_por_conta on public.conversa_mensagens for all to authenticated
  using (exists (
    select 1 from public.conversas c
    where c.id = conversa_id and (c.conta_id = public.minha_conta() or public.sou_super_admin())
  ))
  with check (exists (
    select 1 from public.conversas c
    where c.id = conversa_id and (c.conta_id = public.minha_conta() or public.sou_super_admin())
  ));

grant select, insert, update, delete on public.conversas          to authenticated;
grant select, insert, update, delete on public.conversa_mensagens to authenticated;
grant usage, select on sequence public.conversas_id_seq          to authenticated;
grant usage, select on sequence public.conversa_mensagens_id_seq to authenticated;

grant all privileges on public.conversas          to service_role;
grant all privileges on public.conversa_mensagens to service_role;
grant usage, select on sequence public.conversas_id_seq          to service_role;
grant usage, select on sequence public.conversa_mensagens_id_seq to service_role;

notify pgrst, 'reload schema';
