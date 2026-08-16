-- Adiciona campo reply-to ao config_sistema para headers SMTP
-- Idempotente.

alter table public.config_sistema add column if not exists smtp_reply_to text;

comment on column public.config_sistema.smtp_reply_to is 'Endereço Reply-To para e-mails transacionais (ex: contato@figueiramarketing.com.br)';

notify pgrst, 'reload schema';