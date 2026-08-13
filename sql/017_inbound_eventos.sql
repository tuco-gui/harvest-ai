-- Fase 3B — Inbound multiprovedor. EPIC roadmap comercial, etapa 2.
-- Idempotente. Rode com: ./scripts/sql.sh -f sql/017_inbound_eventos.sql
--
-- Uma linha por mensagem inbound recebida (WAHA ou Evolution), já resolvida
-- para a conta correta e, quando possível com segurança, ligada a
-- lead/campanha. Idempotência via unique(conta_id, provider,
-- message_id_externo): reprocessar o mesmo webhook (retry do provider) não
-- duplica.
--
-- Eventos que não puderam ser associados a uma conta com segurança NÃO
-- entram aqui (ver lib/inboundConta.ts) — não existe conta_id "desconhecido"
-- nesta tabela por design, porque ela é multi-tenant com RLS por conta_id.
--
-- Alteração é 100% aditiva: cria 1 tabela nova, não altera/dropa nenhuma
-- tabela existente, não escreve em nenhuma tabela existente. Nenhum dado
-- de nenhum outro módulo é tocado.
--
-- ROLLBACK (só se necessário, e só antes de haver tráfego real gravado —
-- depois disso, dropar a tabela apaga eventos inbound reais, o que exige
-- nova avaliação, mesma regra aplicada à 016):
--   drop policy if exists inbound_eventos_por_conta on public.inbound_eventos;
--   drop table if exists public.inbound_eventos;
-- Nenhuma outra tabela precisa de reversão — nada além desta foi criado ou
-- alterado por esta migration.

create table if not exists public.inbound_eventos (
  id                  bigserial primary key,
  conta_id            uuid not null references public.contas(id) on delete cascade,
  provider            text not null,                     -- waha | evolution
  telefone            text not null,                      -- normalizado (dígitos + DDI 55)
  mensagem            text,                                -- corpo em texto, null para mídia/outros
  message_id_externo  text not null,                       -- id da mensagem no provider
  tipo_mensagem       text not null default 'texto',       -- texto | midia | outro
  nome_contato        text,
  lead_id             bigint references public.prospecta_leads(id) on delete set null,
  campanha_id         bigint references public.prospecta_campanhas(id) on delete set null,
  payload_bruto       jsonb not null,                      -- payload original do provider, só auditoria
  recebido_em         timestamptz not null default now(),  -- timestamp do provider, quando disponível
  criado_em           timestamptz not null default now(),
  constraint inbound_eventos_conta_provider_msg_key unique (conta_id, provider, message_id_externo)
);
create index if not exists inbound_eventos_conta_idx     on public.inbound_eventos (conta_id);
create index if not exists inbound_eventos_telefone_idx  on public.inbound_eventos (conta_id, telefone);
create index if not exists inbound_eventos_lead_idx      on public.inbound_eventos (lead_id);

-- ------------------------------------------------------------------------- RLS
alter table public.inbound_eventos enable row level security;

drop policy if exists inbound_eventos_por_conta on public.inbound_eventos;
create policy inbound_eventos_por_conta on public.inbound_eventos for all to authenticated
  using (conta_id = public.minha_conta() or public.sou_super_admin())
  with check (conta_id = public.minha_conta() or public.sou_super_admin());

-- --------------------------------------------------------------------- grants
grant select, insert, update, delete on public.inbound_eventos to authenticated;
grant usage, select on sequence public.inbound_eventos_id_seq to authenticated;

grant all privileges on public.inbound_eventos to service_role;
grant usage, select on sequence public.inbound_eventos_id_seq to service_role;

notify pgrst, 'reload schema';
