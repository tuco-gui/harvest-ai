-- Dry-run transacional de 019 (corrigido) + verificador, tudo com ROLLBACK.
begin;

alter table public.inbound_eventos
  add column if not exists tipo_evento text not null default 'mensagem';

create index if not exists prospecta_leads_respondeu_idx
  on public.prospecta_leads (conta_id, respondeu_em) where respondeu_em is not null;
create index if not exists historico_contato_resposta_idx
  on public.historico_contato (conta_id, telefone, origem);
create index if not exists inbound_eventos_optout_idx
  on public.inbound_eventos (conta_id, telefone, tipo_evento)
  where tipo_evento = 'optout';

do $$
begin
  if (select 1 from information_schema.columns
      where table_name='inbound_eventos' and column_name='tipo_evento') is null then
    raise exception 'FALHOU: tipo_evento nao existe apos a migration.';
  end if;
  if (select 1 from pg_indexes where indexname='inbound_eventos_optout_idx') is null then
    raise exception 'FALHOU: indice parcial nao foi criado.';
  end if;
  raise notice 'OK: dry-run 019 verificado.';
end $$;

rollback;
