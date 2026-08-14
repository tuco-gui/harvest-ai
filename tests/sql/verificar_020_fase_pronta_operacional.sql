-- Verificação não destrutiva de 020_fase_pronta_operacional.sql.
-- Rode com: ./scripts/sql.sh -f tests/sql/verificar_020_fase_pronta_operacional.sql
-- Mesmo padrão de verificar_018/019: transação + ROLLBACK, nada fica gravado.

begin;

do $$
declare
  conta_a uuid := gen_random_uuid();
  camp_lista bigint;
  camp_camp bigint;
begin
  if (select 1 from information_schema.columns
      where table_name='prospecta_campanhas' and column_name='tipo') is null then
    raise exception 'FALHOU: prospecta_campanhas.tipo não existe (rode 020 antes).';
  end if;
  if (select 1 from information_schema.columns
      where table_name='prospecta_campanhas' and column_name='status') is null then
    raise exception 'FALHOU: prospecta_campanhas.status não existe (rode 020 antes).';
  end if;

  insert into public.contas (id, nome, slug, ativo)
    values (conta_a, 'QA 020', '020-teste-' || replace(conta_a::text, '-', ''), true);

  -- tipo default = campanha (compatibilidade retroativa)
  insert into public.prospecta_campanhas (conta_id, nome) values (conta_a, 'Campanha padrão')
    returning id into camp_camp;
  if (select tipo from public.prospecta_campanhas where id = camp_camp) <> 'campanha' then
    raise exception 'FALHOU: default de tipo deveria ser campanha.';
  end if;

  -- lista explícita
  insert into public.prospecta_campanhas (conta_id, nome, tipo) values (conta_a, 'Lista QA', 'lista')
    returning id into camp_lista;
  if (select tipo from public.prospecta_campanhas where id = camp_lista) <> 'lista' then
    raise exception 'FALHOU: tipo lista não gravou.';
  end if;

  -- tipo inválido é rejeitado
  begin
    insert into public.prospecta_campanhas (conta_id, nome, tipo) values (conta_a, 'Inválida', 'xyz');
    raise exception 'FALHOU: tipo inválido deveria ser rejeitado pela constraint.';
  exception when check_violation then
    null; -- esperado
  end;

  -- cadência personalizada exige min/max coerentes
  begin
    insert into public.prospecta_campanhas (conta_id, nome, cadencia_modo)
      values (conta_a, 'Cadência ruim', 'personalizada');
    raise exception 'FALHOU: cadência personalizada sem min/max deveria ser rejeitada.';
  exception when check_violation then
    null; -- esperado
  end;

  update public.prospecta_campanhas
    set cadencia_modo = 'personalizada', cadencia_min = 40, cadencia_max = 90
    where id = camp_camp;
  if (select cadencia_max from public.prospecta_campanhas where id = camp_camp) <> 90 then
    raise exception 'FALHOU: cadência personalizada válida deveria gravar.';
  end if;

  raise notice 'OK: 020 verificado (tipo, status, cadência).';
end $$;

rollback;
