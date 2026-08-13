-- Fase 3B — Verificação não destrutiva de 017_inbound_eventos.sql.
-- Rode com: ./scripts/sql.sh -f tests/sql/verificar_017_inbound_eventos.sql
--
-- Mesmo padrão de tests/sql/verificar_016_base_outbound_protecao.sql: cria
-- conta/leads/eventos de teste DENTRO DE UMA TRANSAÇÃO e termina com
-- ROLLBACK — nada fica gravado em produção, falhando ou passando. Se algum
-- assert falhar, o DO block sobe exceção; o ROLLBACK final ainda roda (é
-- válido mesmo com a transação em estado abortado) e limpa tudo.

begin;

do $$
declare
  conta_a     uuid;
  conta_b     uuid;
  lead_1      bigint;
  evento_1    bigint;
  n           integer;
begin
  -- 0. tabela existe?
  if to_regclass('public.inbound_eventos') is null then
    raise exception 'FALHOU: tabela inbound_eventos não existe.';
  end if;

  conta_a := gen_random_uuid();
  conta_b := gen_random_uuid();
  insert into public.contas (id, nome, slug, ativo) values
    (conta_a, '3B Teste A', '3b-teste-a-' || replace(conta_a::text, '-', ''), true),
    (conta_b, '3B Teste B', '3b-teste-b-' || replace(conta_b::text, '-', ''), true);

  insert into public.prospecta_leads (conta_id, place_id, empresa, telefone, origem)
    values (conta_a, '3B_TESTE_PLACE', 'Empresa 3B Teste', '5511999990000', 'teste')
    returning id into lead_1;

  -- 1. inserir evento inbound normal (com lead_id resolvido).
  insert into public.inbound_eventos
    (conta_id, provider, telefone, mensagem, message_id_externo, tipo_mensagem, lead_id, payload_bruto)
    values (conta_a, 'waha', '5511999990000', 'Oi, tenho interesse', '3B_MSG_1', 'texto', lead_1, '{"teste": true}'::jsonb)
    returning id into evento_1;

  select count(*) into n from public.inbound_eventos where id = evento_1;
  if n <> 1 then
    raise exception 'FALHOU: evento inbound não foi gravado.';
  end if;

  -- 2. idempotência: mesmo (conta_id, provider, message_id_externo) é bloqueado.
  begin
    insert into public.inbound_eventos
      (conta_id, provider, telefone, message_id_externo, payload_bruto)
      values (conta_a, 'waha', '5511999990000', '3B_MSG_1', '{}'::jsonb);
    raise exception 'FALHOU: inseriu (conta_a, waha, 3B_MSG_1) duplicado sem erro.';
  exception
    when unique_violation then
      raise notice 'OK: duplicata (conta_id, provider, message_id_externo) bloqueada.';
  end;

  -- 3. mesmo message_id em OUTRA conta não conflita (unique é por conta, não global)
  --    — cada instância WAHA/Evolution é de uma conta só, mas a constraint não
  --    deve impedir por acidente um id de mensagem coincidir entre contas.
  insert into public.inbound_eventos (conta_id, provider, telefone, message_id_externo, payload_bruto)
    values (conta_b, 'waha', '5511999990000', '3B_MSG_1', '{}'::jsonb);

  select count(*) into n from public.inbound_eventos where message_id_externo = '3B_MSG_1';
  if n <> 2 then
    raise exception 'FALHOU: esperava 2 linhas para o mesmo message_id em contas diferentes, achei %', n;
  end if;

  -- 4. mesmo provider, message_id diferente, mesma conta: não conflita.
  insert into public.inbound_eventos (conta_id, provider, telefone, message_id_externo, payload_bruto)
    values (conta_a, 'waha', '5511999990000', '3B_MSG_2', '{}'::jsonb);
  select count(*) into n from public.inbound_eventos where conta_id = conta_a;
  if n <> 2 then
    raise exception 'FALHOU: esperava 2 eventos para conta_a (mensagens diferentes), achei %', n;
  end if;

  -- 5. isolamento por conta: evento da conta_a não aparece em consulta escopada pra conta_b.
  if exists (
    select 1 from public.inbound_eventos
    where conta_id = conta_b and message_id_externo = '3B_MSG_2'
  ) then
    raise exception 'FALHOU: vazamento de evento entre contas.';
  end if;

  -- 6. lead_id nulo é aceito (telefone desconhecido, sem inventar vínculo).
  insert into public.inbound_eventos (conta_id, provider, telefone, message_id_externo, lead_id, payload_bruto)
    values (conta_a, 'evolution', '5511900001111', '3B_MSG_3', null, '{}'::jsonb);
  select count(*) into n from public.inbound_eventos where conta_id = conta_a and message_id_externo = '3B_MSG_3' and lead_id is null;
  if n <> 1 then
    raise exception 'FALHOU: evento com telefone desconhecido (lead_id null) não foi aceito.';
  end if;

  raise notice 'OK: Fase 3B validada — inbound_eventos idempotente por (conta_id, provider, message_id_externo), isolado por conta, aceita telefone sem lead.';
end $$;

-- Sempre roda, mesmo se o DO acima subiu exceção. Zero dados de teste
-- sobrevivem em produção.
rollback;
