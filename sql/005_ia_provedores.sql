-- Troca "só OpenAI" por um provedor à escolha da conta. Idempotente.

alter table public.conta_credenciais add column if not exists ia_provedor text not null default 'openai';
alter table public.conta_credenciais add column if not exists ia_key text;

-- migra quem já tinha chave da OpenAI cadastrada, sem perder nada
update public.conta_credenciais set ia_key = openai_key where ia_key is null and openai_key is not null;

alter table public.conta_credenciais drop column if exists openai_key;

notify pgrst, 'reload schema';
