-- Dry-run combinado: aplica 020 + roda verificação, tudo dentro de uma
-- transação com ROLLBACK no final. NADA é persistido no banco (produção
-- continua sem a migration até autorização explícita de deploy). Usado só
-- para provar localmente que a migration 020 é válida antes de deploy.
-- Rode com: ./scripts/sql.sh -f tests/sql/dryrun_020_combinado.sql

begin;

-- ---- início: conteúdo de sql/020_fase_pronta_operacional.sql ----
alter table public.prospecta_campanhas
  add column if not exists tipo text not null default 'campanha';
alter table public.prospecta_campanhas
  drop constraint if exists prospecta_campanhas_tipo_check;
alter table public.prospecta_campanhas
  add constraint prospecta_campanhas_tipo_check check (tipo in ('lista', 'campanha'));
create index if not exists prospecta_campanhas_conta_tipo_idx
  on public.prospecta_campanhas (conta_id, tipo);

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

update public.prospecta_campanhas set status = 'em_execucao'
  where status = 'rascunho' and criado_em < now();

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
-- ---- fim: conteúdo de sql/020_fase_pronta_operacional.sql ----

-- ---- início: verificação (tests/sql/verificar_020_fase_pronta_operacional.sql) ----
do $$
declare
  conta_a uuid := gen_random_uuid();
  camp_lista bigint;
  camp_camp bigint;
begin
  if (select 1 from information_schema.columns
      where table_name='prospecta_campanhas' and column_name='tipo') is null then
    raise exception 'FALHOU: prospecta_campanhas.tipo não existe.';
  end if;
  if (select 1 from information_schema.columns
      where table_name='prospecta_campanhas' and column_name='status') is null then
    raise exception 'FALHOU: prospecta_campanhas.status não existe.';
  end if;

  insert into public.contas (id, nome, slug, ativo)
    values (conta_a, 'QA 020', '020-teste-' || replace(conta_a::text, '-', ''), true);

  insert into public.prospecta_campanhas (conta_id, nome) values (conta_a, 'Campanha padrão')
    returning id into camp_camp;
  if (select tipo from public.prospecta_campanhas where id = camp_camp) <> 'campanha' then
    raise exception 'FALHOU: default de tipo deveria ser campanha.';
  end if;

  insert into public.prospecta_campanhas (conta_id, nome, tipo) values (conta_a, 'Lista QA', 'lista')
    returning id into camp_lista;
  if (select tipo from public.prospecta_campanhas where id = camp_lista) <> 'lista' then
    raise exception 'FALHOU: tipo lista não gravou.';
  end if;

  begin
    insert into public.prospecta_campanhas (conta_id, nome, tipo) values (conta_a, 'Inválida', 'xyz');
    raise exception 'FALHOU: tipo inválido deveria ser rejeitado pela constraint.';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.prospecta_campanhas (conta_id, nome, cadencia_modo)
      values (conta_a, 'Cadência ruim', 'personalizada');
    raise exception 'FALHOU: cadência personalizada sem min/max deveria ser rejeitada.';
  exception when check_violation then
    null;
  end;

  update public.prospecta_campanhas
    set cadencia_modo = 'personalizada', cadencia_min = 40, cadencia_max = 90
    where id = camp_camp;
  if (select cadencia_max from public.prospecta_campanhas where id = camp_camp) <> 90 then
    raise exception 'FALHOU: cadência personalizada válida deveria gravar.';
  end if;

  raise notice 'OK: dry-run 020 verificado (tipo, status, cadência) — nada persistido (rollback no final).';
end $$;
-- ---- fim: verificação ----

rollback;
