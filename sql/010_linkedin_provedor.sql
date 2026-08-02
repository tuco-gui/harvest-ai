-- Tavily como alternativa ao Serper pra achar o LinkedIn do decisor.
-- Mesmo padrão do ia_provedor/ia_key. Idempotente.

alter table public.conta_credenciais add column if not exists tavily_key text;
alter table public.conta_credenciais add column if not exists linkedin_provedor text not null default 'serper';

notify pgrst, 'reload schema';
