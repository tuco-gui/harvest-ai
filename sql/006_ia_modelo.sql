-- Modelo customizável por conta: nome de modelo muda de ritmo próprio em
-- cada provedor, então em vez de travar num só, deixa a conta sobrescrever.
alter table public.conta_credenciais add column if not exists ia_modelo text;

notify pgrst, 'reload schema';
