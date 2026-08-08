-- HAI-001A — Verificação não destrutiva do isolamento (conta_id, place_id).
-- Rode com: ./scripts/sql.sh -f tests/sql/verificar_hai_001a.sql
--
-- Tudo roda numa única transação: se qualquer assert falhar, o DO block sobe
-- exceção e NADA fica gravado no banco (rollback automático).

do $$
declare
  conta_a uuid;
  conta_b uuid;
  n      integer;
begin
  -- 1. constraint composta existe?
  if not exists (
    select 1 from pg_constraint
    where conname = 'prospecta_leads_conta_place_id_key'
      and conrelid = 'public.prospecta_leads'::regclass
  ) then
    raise exception 'FALHOU: constraint prospecta_leads_conta_place_id_key não existe.';
  end if;

  -- 2. o UNIQUE global antigo foi removido?
  if exists (
    select 1 from pg_constraint
    where conname = 'prospecta_leads_place_id_key'
      and conrelid = 'public.prospecta_leads'::regclass
  ) then
    raise exception 'FALHOU: constraint global prospecta_leads_place_id_key ainda existe.';
  end if;

  -- 3. duas contas conseguem guardar o MESMO place_id?
  conta_a := gen_random_uuid();
  conta_b := gen_random_uuid();

  insert into public.contas (id, nome, slug, ativo) values
    (conta_a, 'HAI-001A Teste A', 'hai-001a-teste-a-' || replace(conta_a::text, '-', ''), true),
    (conta_b, 'HAI-001A Teste B', 'hai-001a-teste-b-' || replace(conta_b::text, '-', ''), true);

  insert into public.prospecta_leads (conta_id, place_id, empresa, origem) values
    (conta_a, 'ChIJ_TESTE_HAI_001A', 'Empresa Teste A', 'teste'),
    (conta_b, 'ChIJ_TESTE_HAI_001A', 'Empresa Teste B', 'teste');

  select count(*) into n
    from public.prospecta_leads
    where place_id = 'ChIJ_TESTE_HAI_001A';
  if n <> 2 then
    raise exception 'FALHOU: esperava 2 leads com o mesmo place_id, achei %', n;
  end if;

  -- 4. duplicar (conta, place_id) na MESMA conta continua bloqueado.
  begin
    insert into public.prospecta_leads (conta_id, place_id, empresa, origem) values
      (conta_a, 'ChIJ_TESTE_HAI_001A', 'Duplicado', 'teste');
    raise exception 'FALHOU: inseriu duplicata (conta_a, place_id) sem erro.';
  exception
    when unique_violation then
      raise notice 'OK: duplicata na mesma conta bloqueada (unique_violation).';
  end;

  raise notice 'OK: HAI-001A validado — duas contas compartilham place_id; duplicata por conta bloqueada.';
end $$;
