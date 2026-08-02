-- Guarda o motivo quando o enriquecimento não acha nada ou falha, pra
-- aparecer no log de erros junto com os de disparo. Idempotente.

alter table public.prospecta_leads add column if not exists erro_enriquecimento text;

notify pgrst, 'reload schema';
