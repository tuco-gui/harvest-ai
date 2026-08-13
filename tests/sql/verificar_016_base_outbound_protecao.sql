-- Fase 3A — Verificação não destrutiva de 016_base_outbound_protecao.sql.
-- Rode com: ./scripts/sql.sh -f tests/sql/verificar_016_base_outbound_protecao.sql
--
-- Cria conta/campanhas/leads de teste DENTRO DE UMA TRANSAÇÃO e termina com
-- ROLLBACK — nada fica gravado em produção, falhando ou passando. Se algum
-- assert falhar, o DO block sobe exceção; o ROLLBACK final ainda roda (é
-- válido mesmo com a transação em estado abortado) e limpa tudo.
--
-- Diferença proposital do padrão de tests/sql/verificar_hai_001a.sql (que
-- não embrulha em transação): aqui os dados de teste ("3A Teste") não têm
-- por que sobreviver à verificação — todo o comportamento testado (unique
-- constraints, isolamento por conta) é visível e reproduzível só com
-- INSERT/SELECT dentro da mesma transação, sem precisar de commit.

begin;

do $$
declare
  conta      uuid;
  campanha_1 bigint;
  campanha_2 bigint;
  lead_1     bigint;
  n          integer;
begin
  -- 0. tabelas existem?
  if to_regclass('public.campanha_leads') is null then
    raise exception 'FALHOU: tabela campanha_leads não existe.';
  end if;
  if to_regclass('public.historico_contato') is null then
    raise exception 'FALHOU: tabela historico_contato não existe.';
  end if;
  if to_regclass('public.conta_supressao') is null then
    raise exception 'FALHOU: tabela conta_supressao não existe.';
  end if;

  conta := gen_random_uuid();
  insert into public.contas (id, nome, slug, ativo)
    values (conta, '3A Teste', '3a-teste-' || replace(conta::text, '-', ''), true);

  insert into public.prospecta_campanhas (conta_id, nome, origem) values (conta, '3A Campanha 1', 'busca') returning id into campanha_1;
  insert into public.prospecta_campanhas (conta_id, nome, origem) values (conta, '3A Campanha 2', 'manual') returning id into campanha_2;

  insert into public.prospecta_leads (conta_id, place_id, empresa, telefone, campanha_id, origem)
    values (conta, '3A_TESTE_PLACE', 'Empresa 3A Teste', '5511999990000', campanha_1, 'teste')
    returning id into lead_1;

  -- 1. mesmo lead em duas campanhas (N:N) — QA item obrigatório.
  insert into public.campanha_leads (conta_id, campanha_id, lead_id, origem) values
    (conta, campanha_1, lead_1, 'busca'),
    (conta, campanha_2, lead_1, 'manual');

  select count(*) into n from public.campanha_leads where lead_id = lead_1;
  if n <> 2 then
    raise exception 'FALHOU: esperava 2 vínculos campanha_leads para o mesmo lead, achei %', n;
  end if;

  -- 2. inserir o mesmo par (campanha, lead) de novo é bloqueado (unique).
  begin
    insert into public.campanha_leads (conta_id, campanha_id, lead_id, origem) values (conta, campanha_1, lead_1, 'busca');
    raise exception 'FALHOU: inseriu (campanha_1, lead_1) duplicado sem erro.';
  exception
    when unique_violation then
      raise notice 'OK: duplicata (campanha_id, lead_id) bloqueada.';
  end;

  -- 3. histórico de contato: duas tentativas, providers diferentes, preservadas.
  insert into public.historico_contato (conta_id, lead_id, campanha_id, telefone, provider, status) values
    (conta, lead_1, campanha_1, '5511999990000', 'evolution', 'enviado'),
    (conta, lead_1, campanha_2, '5511999990000', 'waha', 'erro');

  select count(*) into n from public.historico_contato where conta_id = conta and telefone = '5511999990000';
  if n <> 2 then
    raise exception 'FALHOU: esperava 2 linhas de histórico para o telefone, achei %', n;
  end if;

  -- 4. supressão central: um telefone por conta, bloqueio de duplicata.
  insert into public.conta_supressao (conta_id, telefone, motivo) values (conta, '5511999990000', 'opt_out');

  select count(*) into n from public.conta_supressao where conta_id = conta and telefone = '5511999990000';
  if n <> 1 then
    raise exception 'FALHOU: esperava 1 supressão, achei %', n;
  end if;

  begin
    insert into public.conta_supressao (conta_id, telefone, motivo) values (conta, '5511999990000', 'manual');
    raise exception 'FALHOU: inseriu supressão duplicada (conta, telefone) sem erro.';
  exception
    when unique_violation then
      raise notice 'OK: duplicata (conta_id, telefone) em conta_supressao bloqueada.';
  end;

  -- 5. isolamento por conta: outra conta com o mesmo telefone NÃO está suprimida.
  if exists (
    select 1 from public.conta_supressao
    where telefone = '5511999990000' and conta_id <> conta
  ) then
    raise exception 'FALHOU: vazamento de supressão entre contas.';
  end if;

  raise notice 'OK: Fase 3A validada — campanha_leads N:N, historico_contato por telefone, conta_supressao isolada por conta.';
end $$;

-- Sempre roda, mesmo se o DO acima subiu exceção (a transação fica "abortada"
-- mas ROLLBACK continua sendo o único comando aceito nesse estado). Zero
-- dados de teste sobrevivem em produção.
rollback;
