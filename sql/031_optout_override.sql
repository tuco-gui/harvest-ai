-- Harvest AI — Opt-out como preferência (não bloqueio absoluto)
-- Migração 031: substitui modelo de supressão rígido por opt-out configurável.
-- Idempotente: pode ser executada múltiplas vezes sem erro.
--
-- Modelo novo:
--   opt_outs              → registro rico de opt-out (substitui conta_supressao para novo fluxo)
--   opt_out_overrides     → auditoria de envio apesar de opt-out
--   contas.ext            → política de override por workspace
--   perfis.ext            → permissão granular por operador
--
-- CONTINUIDADE: conta_supressao continua existindo e sendo populada para
-- retrocompatibilidade. Novos fluxos usam opt_outs + estaEmOptOut().

-- ================================================================ TABELAS

-- 1) Opt-outs registrados (substitui semanticamente conta_supressao)
create table if not exists public.opt_outs (
  id              bigserial primary key,
  conta_id        uuid not null references public.contas(id) on delete cascade,
  telefone        text not null,
  status          text not null default 'ativo' check (status in ('ativo', 'removido')),
  motivo          text not null default 'mensagem',  -- mensagem | manual | reclamacao
  mensagem_geradora text,
  criado_por      uuid references public.perfis(id) on delete set null,
  criado_por_tipo text not null default 'contato' check (criado_por_tipo in ('contato', 'operador', 'admin', 'automacao', 'sistema')),
  criado_em       timestamptz not null default now(),
  removido_por    uuid references public.perfis(id) on delete set null,
  motivo_remocao  text,
  removido_em     timestamptz,
  origem          text not null default 'inbound',  -- inbound | manual | importacao
  workspace_id    uuid references public.contas(id) on delete cascade,
  constraint opt_outs_conta_telefone_unico unique (conta_id, telefone)
);

create index if not exists opt_outs_conta_idx on public.opt_outs (conta_id);
create index if not exists opt_outs_conta_telefone_idx on public.opt_outs (conta_id, telefone);
create index if not exists opt_outs_conta_status_idx on public.opt_outs (conta_id, status) where status = 'ativo';

alter table public.opt_outs enable row level security;
do $$ begin
  create policy opt_outs_por_conta on public.opt_outs
    for all using (conta_id = (current_setting('request.jwt.claims', true)::json->>'conta_id')::uuid);
exception when duplicate_object then null;
end $$;
grant select, insert, update on public.opt_outs to authenticated;
grant all on public.opt_outs to service_role;

-- 2) Overrides (auditoria de envio apesar de opt-out)
create table if not exists public.opt_out_overrides (
  id              bigserial primary key,
  conta_id        uuid not null references public.contas(id) on delete cascade,
  opt_out_id      bigint not null references public.opt_outs(id) on delete cascade,
  telefone        text not null,
  autorizado_por  uuid not null references public.perfis(id) on delete set null,
  autorizado_por_tipo text not null check (autorizado_por_tipo in ('admin', 'super_admin', 'operador_autorizado')),
  enviado_por     uuid references public.perfis(id) on delete set null,
  data_hora       timestamptz not null default now(),
  motivo          text not null,
  campanha_id     bigint,
  oportunidade_id bigint,
  canal_id        bigint,
  canal_nome      text
);

create index if not exists opt_out_overrides_conta_idx on public.opt_out_overrides (conta_id);
create index if not exists opt_out_overrides_opt_out_idx on public.opt_out_overrides (opt_out_id);

alter table public.opt_out_overrides enable row level security;
do $$ begin
  create policy opt_out_overrides_por_conta on public.opt_out_overrides
    for all using (conta_id = (current_setting('request.jwt.claims', true)::json->>'conta_id')::uuid);
exception when duplicate_object then null;
end $$;
grant select, insert on public.opt_out_overrides to authenticated;
grant all on public.opt_out_overrides to service_role;

-- 3) Política de override por workspace (extensão da tabela contas)
alter table public.contas add column if not exists optout_override_policy text
  not null default 'admin'
  check (optout_override_policy in ('nenhum', 'admin', 'admin_operadores', 'qualquer'));

-- 4) Permissão granular por operador (extensão da tabela perfis)
alter table public.perfis add column if not exists pode_enviar_optout boolean
  not null default false;

-- ================================================================ DADOS INICIAIS

-- Figueira QA: política mais permissiva para testes
update public.contas
set optout_override_policy = 'qualquer'
where slug = 'figueira-qa';

-- ================================================================ VERIFICAÇÃO
do $$ begin
  raise notice '031: opt_outs=%, overrides=%, policy%',
    (select count(*) from public.opt_outs),
    (select count(*) from public.opt_out_overrides),
    (select optout_override_policy from public.contas where slug = 'figueira-qa');
end $$;
