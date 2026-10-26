-- 045: Fontes de lead multicanal dentro dos funis, sem alterar WhatsApp existente.
-- Apenas contas com crm_avancado podem criar/ler através das APIs.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_fontes_funil (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 funil_id bigint NOT NULL REFERENCES public.funis(id) ON DELETE CASCADE,
 tipo text NOT NULL CHECK (tipo IN (
  'instagram_dm','facebook_messenger','whatsapp_cloud_api','webchat',
  'google_business_reviews'
 )),
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 100),
 identificador_externo text NULL CHECK(length(identificador_externo)<=255),
 dominio text NULL CHECK(length(dominio)<=253),
 status text NOT NULL DEFAULT 'aguardando_autorizacao'
  CHECK(status IN ('aguardando_autorizacao','pronto','pausado')),
 token_publico uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_fontes_identidade_idx
 ON public.crm_fontes_funil(conta_id,tipo,identificador_externo)
 WHERE identificador_externo IS NOT NULL AND status<>'pausado';
CREATE INDEX IF NOT EXISTS crm_fontes_funil_idx
 ON public.crm_fontes_funil(conta_id,funil_id,tipo,status);

CREATE OR REPLACE FUNCTION public.crm_conferir_fonte_funil()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.funis WHERE id=NEW.funil_id
  AND conta_id=NEW.conta_id) THEN
   RAISE EXCEPTION 'Fonte e funil de workspaces diferentes'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_conferir_fonte_funil_tg ON public.crm_fontes_funil;
CREATE TRIGGER crm_conferir_fonte_funil_tg BEFORE INSERT OR UPDATE OF conta_id,funil_id
 ON public.crm_fontes_funil FOR EACH ROW EXECUTE FUNCTION public.crm_conferir_fonte_funil();

CREATE TABLE IF NOT EXISTS public.crm_conversas_externas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 fonte_id uuid NOT NULL,
 visitante_id text NOT NULL CHECK(length(visitante_id) BETWEEN 10 AND 100),
 segredo_hash text NOT NULL CHECK(length(segredo_hash)=64),
 nome text NULL CHECK(length(nome)<=160),
 status text NOT NULL DEFAULT 'aberto'
  CHECK(status IN('aberto','pendente','resolvido')),
 responsavel_id uuid NULL REFERENCES public.perfis(id) ON DELETE SET NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(fonte_id,visitante_id),
 UNIQUE(conta_id,id),
 FOREIGN KEY(conta_id,fonte_id) REFERENCES public.crm_fontes_funil(conta_id,id)
);
CREATE INDEX IF NOT EXISTS crm_conversas_fonte_idx
 ON public.crm_conversas_externas(conta_id,atualizado_em DESC);

CREATE TABLE IF NOT EXISTS public.crm_mensagens_externas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 conversa_id uuid NOT NULL,
 direcao text NOT NULL CHECK(direcao IN ('entrada','saida')),
 texto text NOT NULL CHECK(length(btrim(texto)) BETWEEN 1 AND 4000),
 mensagem_externa_id text NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conta_id,conversa_id) REFERENCES public.crm_conversas_externas(conta_id,id)
  ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS crm_mensagens_conversa_idx
 ON public.crm_mensagens_externas(conta_id,conversa_id,criado_em);
CREATE UNIQUE INDEX IF NOT EXISTS crm_mensagens_dedupe_ext_idx
 ON public.crm_mensagens_externas(conta_id,conversa_id,mensagem_externa_id)
 WHERE mensagem_externa_id IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['crm_fontes_funil','crm_conversas_externas','crm_mensagens_externas'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
