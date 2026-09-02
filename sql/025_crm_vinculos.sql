-- HAI-002 Seção 3 — camada mínima de referências multi-tenant para a cadeia
-- Harvest conta → Twenty workspace → Chatwoot account → Chatwoot inbox →
-- WhatsApp canal (whatsapp_canais já existe e já referencia conta_id).
--
-- Guarda só IDENTIFICADORES, nunca segredos: TWENTY_API_KEY e
-- CHATWOOT_API_TOKEN continuam em env var, nunca nesta tabela. Não duplica
-- People/Company/Opportunity/Conversation/Message do Twenty/Chatwoot — só a
-- referência para o Harvest saber qual workspace/conta remota consultar.
--
-- Um conta_id pode ter no máximo um vínculo (1 workspace Twenty + 1 account
-- Chatwoot por conta Harvest, hoje). "Chatwoot inbox(es)" fica em
-- chatwoot_inbox_whatsapp_id como a inbox padrão; se um dia uma conta
-- precisar de múltiplas inboxes, essa coluna vira uma tabela própria — não
-- antecipado aqui (YAGNI).
--
-- Idempotente. Rode com: ./scripts/sql.sh -f sql/025_crm_vinculos.sql

create table if not exists public.crm_vinculos (
  conta_id                   uuid primary key references public.contas(id) on delete cascade,
  twenty_workspace_id        text,
  chatwoot_account_id        integer,
  chatwoot_inbox_whatsapp_id integer,
  ativo                      boolean     not null default true,
  criado_em                  timestamptz not null default now(),
  atualizado_em              timestamptz not null default now()
);

comment on table public.crm_vinculos is
  'Referências não-sensíveis por conta Harvest para os workspaces/accounts remotos do Twenty e Chatwoot (plano HAI-002, Seção 3). Nenhum segredo é armazenado aqui.';

-- Rollback:
--   drop table if exists public.crm_vinculos;
