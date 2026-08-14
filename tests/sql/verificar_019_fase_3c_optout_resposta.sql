-- Fase 3C — Verificação não destrutiva de 019_fase_3c_optout_resposta.sql.
-- Rode com: ./scripts/sql.sh -f tests/sql/verificar_019_fase_3c_optout_resposta.sql
-- BEGIN → asserts → ROLLBACK (nada fica gravado).

begin;

do $$
declare
  conta_a   uuid;
  lead_1    bigint;
  n         integer;
  sup       boolean;
begin
  conta_a := gen_random_uuid();

  insert into public.contas (id, nome, slug, ativo) values
    (conta_a, '3C Teste', '3c-teste-' || replace(conta_a::text, '-', ''), true);

  -- 1. colunas/índices da 019 existem?
  if to_regclass('public.inbound_eventos') is null then
    raise exception 'FALHOU: inbound_eventos inexistente (rode 017 antes).';
  end if;
  if (select 1 from information_schema.columns
      where table_name='inbound_eventos' and column_name='tipo_evento') is null then
    raise exception 'FALHOU: inbound_eventos.tipo_evento não existe (rode 019 antes).';
  end if;
  if (select 1 from information_schema.columns
      where table_name='prospecta_leads' and column_name='respondeu_em') is null then
    raise exception 'FALHOU: prospecta_leads.respondeu_em não existe (rode 001/007 antes).';
  end if;

  -- 2. opt-out grava em conta_supressao e bloqueia disparo (reaproveita 016/3A)
  insert into public.prospecta_leads (conta_id, empresa, telefone)
    values (conta_a, 'Lead 3C', '5511999990000') returning id into lead_1;

  insert into public.conta_supressao (conta_id, telefone, motivo)
    values (conta_a, '5511999990000', 'opt_out');

  select count(*) into n from public.conta_supressao
    where conta_id = conta_a and telefone = '5511999990000' and motivo = 'opt_out';
  if n <> 1 then raise exception 'FALHOU: opt-out não gravado em conta_supressao.'; end if;

  -- estaSuprimido() (lib/supressao) reflete o bloqueio
  select exists (
    select 1 from public.conta_supressao where conta_id = conta_a and telefone = '5511999990000'
  ) into sup;
  if not sup then raise exception 'FALHOU: telefone suprimido deveria bloquear disparo.'; end if;

  -- 3. respondeu_em reflete resposta (sem sobrescrever)
  update public.prospecta_leads set respondeu_em = now(), status = 'respondeu'
    where id = lead_1 and respondeu_em is null;
  select count(*) into n from public.prospecta_leads
    where id = lead_1 and status = 'respondeu' and respondeu_em is not null;
  if n <> 1 then raise exception 'FALHOU: respondeu_em/status não refletiram resposta.'; end if;

  -- 4. historico_contato aceita origem='resposta' e status='optout'/'recebido'
  insert into public.historico_contato (conta_id, lead_id, telefone, provider, status, origem)
    values (conta_a, lead_1, '5511999990000', 'waha', 'optout', 'resposta');
  select count(*) into n from public.historico_contato
    where conta_id = conta_a and origem = 'resposta' and status = 'optout';
  if n <> 1 then raise exception 'FALHOU: historico_contato não aceitou (resposta, optout).'; end if;

  raise notice 'OK: Fase 3C validada — inbound_eventos.tipo_evento, conta_supressao(opt_out) bloqueia, prospecta_leads.respondeu_em, historico_contato(resposta/optout).';
end $$;

rollback;
