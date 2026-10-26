-- 047: estado real de inscrição da página no webhook Meta (não confundir com OAuth).
BEGIN;
ALTER TABLE public.crm_fontes_funil
 ADD COLUMN IF NOT EXISTS meta_assinatura_status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.crm_fontes_funil
 ADD COLUMN IF NOT EXISTS meta_assinatura_em timestamptz NULL;
ALTER TABLE public.crm_fontes_funil
 ADD CONSTRAINT crm_fonte_meta_assinatura_status_ck
 CHECK (meta_assinatura_status IN ('pendente','inscrita','falha'));
NOTIFY pgrst,'reload schema';
COMMIT;
