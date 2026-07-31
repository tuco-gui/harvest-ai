-- Telefone no perfil, senha provisória (força troca no primeiro login) e a
-- configuração de SMTP do sistema. Idempotente.

alter table public.perfis add column if not exists telefone text;
alter table public.perfis add column if not exists senha_provisoria boolean not null default false;

-- Singleton: uma linha só, sempre id=1. É configuração do sistema, não de
-- uma conta — um único GoTrue serve todas as contas, então só existe um SMTP.
create table if not exists public.config_sistema (
  id             int primary key default 1,
  smtp_host      text,
  smtp_porta     int,
  smtp_usuario   text,
  smtp_senha     text,
  smtp_remetente text,
  atualizado_em  timestamptz not null default now(),
  constraint config_sistema_singleton check (id = 1)
);
insert into public.config_sistema (id) values (1) on conflict (id) do nothing;

alter table public.config_sistema enable row level security;

drop policy if exists config_sistema_super on public.config_sistema;
create policy config_sistema_super on public.config_sistema for all to authenticated
  using (public.sou_super_admin()) with check (public.sou_super_admin());

grant select, insert, update, delete on public.config_sistema to authenticated;

notify pgrst, 'reload schema';
