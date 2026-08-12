-- Segundo provedor de WhatsApp (WAHA, engine NOWEB) além da Evolution.
-- 'evolution' continua sendo o default — contas existentes não mudam de
-- comportamento. Idempotente.

alter table public.conta_credenciais add column if not exists whatsapp_provider text not null default 'evolution';

notify pgrst, 'reload schema';
