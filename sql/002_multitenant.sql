-- Harvest AI — contas, usuários, papéis e isolamento por RLS
-- Fase 1 do roadmap. Idempotente.
--
-- Modelo: uma linha em `contas` por empresa cliente. Cada usuário pertence a
-- uma conta, exceto o super_admin, que tem conta_id nulo e enxerga todas.

-- ---------------------------------------------------------------- contas
create table if not exists public.contas (
  id         uuid        primary key default gen_random_uuid(),
  criado_em  timestamptz not null default now(),
  nome       text        not null,
  slug       text        not null unique,   -- usado na URL e para achar a conta
  logo_url   text,
  ativo      boolean     not null default true
);

-- ---------------------------------------------------------------- papéis
do $$ begin
  create type public.papel as enum ('super_admin', 'admin', 'operador');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- perfis
-- Estende auth.users. O id É o id do usuário no GoTrue.
create table if not exists public.perfis (
  id         uuid        primary key references auth.users(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  conta_id   uuid        references public.contas(id) on delete cascade,
  nome       text,
  email      text,
  papel      public.papel not null default 'operador'
);

create index if not exists perfis_conta_idx on public.perfis (conta_id);

-- super_admin não pertence a conta nenhuma; todo o resto pertence a uma.
alter table public.perfis drop constraint if exists perfis_conta_coerente;
alter table public.perfis add constraint perfis_conta_coerente check (
  (papel = 'super_admin' and conta_id is null) or
  (papel <> 'super_admin' and conta_id is not null)
);

-- Cria o perfil junto com o usuário. O super admin passa nome, conta e papel
-- em user_metadata na chamada da API admin do GoTrue.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.perfis (id, email, nome, conta_id, papel)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nome',
    nullif(new.raw_user_meta_data->>'conta_id', '')::uuid,
    coalesce((new.raw_user_meta_data->>'papel')::public.papel, 'operador')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------- credenciais por conta
-- É aqui que as chaves saem do navegador. Só admin e super_admin leem.
create table if not exists public.conta_credenciais (
  conta_id            uuid primary key references public.contas(id) on delete cascade,
  atualizado_em       timestamptz not null default now(),
  serpapi_key         text,
  evolution_url       text,
  evolution_instancia text,
  evolution_key       text,
  openai_key          text
);

-- ------------------------------------------------- configuração de envio
create table if not exists public.conta_config_envio (
  conta_id       uuid primary key references public.contas(id) on delete cascade,
  atualizado_em  timestamptz not null default now(),
  modo           text    not null default 'ia',   -- fixa | rodizio | ia
  mensagens      jsonb   not null default '[]'::jsonb,
  contexto       text,
  intervalo_min  integer not null default 30,
  intervalo_max  integer not null default 60,
  constraint intervalo_coerente check (intervalo_min >= 5 and intervalo_min < intervalo_max)
);

-- ------------------------------------------- conta_id nas tabelas atuais
-- Nulo por enquanto, de propósito: o workflow em produção ainda não envia
-- conta_id, e torná-lo obrigatório agora quebraria o disparo do cliente.
-- Vira NOT NULL na Fase 4, quando o n8n passar a mandar.
alter table public.prospecta_leads     add column if not exists conta_id uuid references public.contas(id) on delete cascade;
alter table public.prospecta_buscas    add column if not exists conta_id uuid references public.contas(id) on delete cascade;
alter table public.prospecta_mensagens add column if not exists conta_id uuid references public.contas(id) on delete cascade;

create index if not exists prospecta_leads_conta_idx     on public.prospecta_leads (conta_id);
create index if not exists prospecta_buscas_conta_idx    on public.prospecta_buscas (conta_id);
create index if not exists prospecta_mensagens_conta_idx on public.prospecta_mensagens (conta_id);

-- ------------------------------------------------------------- helpers
-- security definer para não recursar: a policy de `perfis` chamaria a função
-- que lê `perfis`, e a leitura dispararia a policy de novo.
create or replace function public.minha_conta() returns uuid
language sql stable security definer set search_path = public as $$
  select conta_id from public.perfis where id = auth.uid()
$$;

create or replace function public.meu_papel() returns public.papel
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid()
$$;

create or replace function public.sou_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'super_admin' from public.perfis where id = auth.uid()), false)
$$;

create or replace function public.sou_admin_da_conta(alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select papel in ('admin', 'super_admin') and (conta_id = alvo or papel = 'super_admin')
    from public.perfis where id = auth.uid()
  ), false)
$$;

-- ------------------------------------------------------------------ RLS
alter table public.contas             enable row level security;
alter table public.perfis             enable row level security;
alter table public.conta_credenciais  enable row level security;
alter table public.conta_config_envio enable row level security;

-- contas: cada um vê a sua; super_admin vê e gerencia todas
drop policy if exists contas_leitura on public.contas;
create policy contas_leitura on public.contas for select to authenticated
  using (id = public.minha_conta() or public.sou_super_admin());

drop policy if exists contas_escrita on public.contas;
create policy contas_escrita on public.contas for all to authenticated
  using (public.sou_super_admin()) with check (public.sou_super_admin());

-- perfis: vejo os colegas da minha conta; só admin da conta mexe
drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis for select to authenticated
  using (id = auth.uid() or conta_id = public.minha_conta() or public.sou_super_admin());

drop policy if exists perfis_escrita on public.perfis;
create policy perfis_escrita on public.perfis for all to authenticated
  using (public.sou_admin_da_conta(conta_id))
  with check (public.sou_admin_da_conta(conta_id));

-- credenciais: o operador NÃO alcança. É a regra que impede o cliente de
-- quebrar a configuração sem querer.
drop policy if exists credenciais_admin on public.conta_credenciais;
create policy credenciais_admin on public.conta_credenciais for all to authenticated
  using (public.sou_admin_da_conta(conta_id))
  with check (public.sou_admin_da_conta(conta_id));

-- config de envio: operador lê (precisa saber o que vai sair), só admin edita
drop policy if exists envio_leitura on public.conta_config_envio;
create policy envio_leitura on public.conta_config_envio for select to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin());

drop policy if exists envio_escrita on public.conta_config_envio;
create policy envio_escrita on public.conta_config_envio for all to authenticated
  using (public.sou_admin_da_conta(conta_id))
  with check (public.sou_admin_da_conta(conta_id));

-- dados de prospecção: isolados por conta.
-- Linha com conta_id nulo é resquício da fase anterior — só super_admin vê.
drop policy if exists leads_por_conta on public.prospecta_leads;
create policy leads_por_conta on public.prospecta_leads for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

drop policy if exists buscas_por_conta on public.prospecta_buscas;
create policy buscas_por_conta on public.prospecta_buscas for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

drop policy if exists mensagens_por_conta on public.prospecta_mensagens;
create policy mensagens_por_conta on public.prospecta_mensagens for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

-- --------------------------------------------------------------- grants
-- authenticated passa a alcançar as tabelas; quem filtra é a RLS acima.
grant usage on schema public to authenticated;

grant select                         on public.contas             to authenticated;
grant select, insert, update, delete on public.perfis             to authenticated;
grant select, insert, update, delete on public.conta_credenciais  to authenticated;
grant select, insert, update, delete on public.conta_config_envio to authenticated;
grant select, insert, update, delete on public.prospecta_leads     to authenticated;
grant select, insert, update, delete on public.prospecta_buscas    to authenticated;
grant select, insert, update, delete on public.prospecta_mensagens to authenticated;

grant usage, select on sequence public.prospecta_leads_id_seq     to authenticated;
grant usage, select on sequence public.prospecta_buscas_id_seq    to authenticated;
grant usage, select on sequence public.prospecta_mensagens_id_seq to authenticated;

-- service_role (n8n) segue com tudo e continua ignorando RLS.
grant all privileges on public.contas             to service_role;
grant all privileges on public.perfis             to service_role;
grant all privileges on public.conta_credenciais  to service_role;
grant all privileges on public.conta_config_envio to service_role;

notify pgrst, 'reload schema';
