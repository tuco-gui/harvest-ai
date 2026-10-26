BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_zernio_estados(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 fonte_id uuid NOT NULL,
 funil_id bigint NOT NULL REFERENCES public.funis(id) ON DELETE CASCADE,
 plataforma text NOT NULL CHECK(plataforma IN ('instagram_dm','facebook_messenger')),
 perfil_zernio text NOT NULL,
 expira_em timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 consumido_em timestamptz NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conta_id,fonte_id) REFERENCES public.crm_fontes_funil(conta_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS crm_zernio_estados_exp_idx ON public.crm_zernio_estados(expira_em);
ALTER TABLE public.crm_zernio_estados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_zernio_estados FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.crm_zernio_estados TO service_role;
ALTER TABLE public.crm_fontes_funil
 ADD COLUMN IF NOT EXISTS zernio_account_id text NULL,
 ADD COLUMN IF NOT EXISTS zernio_profile_id text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_fontes_zernio_conta_unique
 ON public.crm_fontes_funil(conta_id,zernio_account_id)
 WHERE zernio_account_id IS NOT NULL;
NOTIFY pgrst,'reload schema';
COMMIT;
