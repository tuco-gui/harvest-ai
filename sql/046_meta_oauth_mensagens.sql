-- 046 Meta Messaging: tokens de cada workspace criptografados em repouso.
-- OAuth sempre por fonte/funil/operador. Sem aproveitamento do token de Ads.
BEGIN;
ALTER TABLE public.crm_fontes_funil
 ADD COLUMN IF NOT EXISTS meta_token_cifrado text NULL,
 ADD COLUMN IF NOT EXISTS meta_expira_em timestamptz NULL,
 ADD COLUMN IF NOT EXISTS meta_escopos text[] NOT NULL DEFAULT ARRAY[]::text[];
CREATE TABLE IF NOT EXISTS public.crm_meta_oauth_estados(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 funil_id bigint NOT NULL REFERENCES public.funis(id) ON DELETE CASCADE,
 fonte_id uuid NOT NULL,
 perfil_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
 plataforma text NOT NULL CHECK(plataforma IN ('instagram_dm','facebook_messenger')),
 estado text NOT NULL DEFAULT 'iniciado'
  CHECK(estado IN ('iniciado','escolher_pagina','concluido')),
 opcoes_cifradas text NULL,
 expira_em timestamptz NOT NULL DEFAULT(now()+interval '10 minutes'),
 consumido_em timestamptz NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conta_id,fonte_id) REFERENCES public.crm_fontes_funil(conta_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS crm_meta_oauth_exp_idx
 ON public.crm_meta_oauth_estados(expira_em);
CREATE OR REPLACE FUNCTION public.crm_validar_oauth_fonte()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.crm_fontes_funil
  WHERE id=NEW.fonte_id AND conta_id=NEW.conta_id
    AND funil_id=NEW.funil_id AND tipo=NEW.plataforma)
 OR NOT EXISTS(SELECT 1 FROM public.perfis
  WHERE id=NEW.perfil_id AND conta_id=NEW.conta_id) THEN
  RAISE EXCEPTION 'OAuth deve pertencer a mesma workspace, fonte e funil'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_validar_oauth_fonte_tg ON public.crm_meta_oauth_estados;
CREATE TRIGGER crm_validar_oauth_fonte_tg BEFORE INSERT OR UPDATE OF
 conta_id,fonte_id,funil_id,perfil_id,plataforma
 ON public.crm_meta_oauth_estados FOR EACH ROW
 EXECUTE FUNCTION public.crm_validar_oauth_fonte();
ALTER TABLE public.crm_meta_oauth_estados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_meta_oauth_estados FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.crm_meta_oauth_estados TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
