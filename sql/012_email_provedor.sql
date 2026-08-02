-- Apollo.io e Snov.io como alternativa ao Anymail Finder pra achar e-mail —
-- nenhum dos três sai, é sempre por escolha da conta. Snov.io autentica por
-- client_id+client_secret (OAuth2), não por uma chave só, por isso os dois
-- campos. Idempotente.

alter table public.conta_credenciais add column if not exists email_provedor text not null default 'anymail';
alter table public.conta_credenciais add column if not exists apollo_key text;
alter table public.conta_credenciais add column if not exists snov_client_id text;
alter table public.conta_credenciais add column if not exists snov_client_secret text;

notify pgrst, 'reload schema';
