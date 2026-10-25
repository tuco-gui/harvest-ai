-- 044: criação OPCIONAL de negócio no primeiro inbound do canal/funil.
-- Todas as workspaces começam com a automação DESLIGADA.
BEGIN;
ALTER TABLE public.funis
 ADD COLUMN IF NOT EXISTS auto_criar_negocio_inbound boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.crm_vinculos_inbound_negocio (
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 canal_id bigint NOT NULL REFERENCES public.whatsapp_canais(id) ON DELETE CASCADE,
 telefone text NOT NULL CHECK (telefone ~ '^55[0-9]{10,11}$'),
 funil_id bigint NOT NULL REFERENCES public.funis(id) ON DELETE CASCADE,
 oportunidade_id bigint NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
 criado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conta_id,canal_id,telefone),
 UNIQUE (oportunidade_id)
);
-- Isolamento por tenant mesmo diante de inserts administrativos futuros.
CREATE OR REPLACE FUNCTION public.crm_validar_vinculo_negocio_inbound()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_canais
    WHERE id=NEW.canal_id AND conta_id=NEW.conta_id)
 OR NOT EXISTS(SELECT 1 FROM public.funis
    WHERE id=NEW.funil_id AND conta_id=NEW.conta_id AND canal_padrao_id=NEW.canal_id)
 OR NOT EXISTS(SELECT 1 FROM public.oportunidades
    WHERE id=NEW.oportunidade_id AND conta_id=NEW.conta_id AND funil_id=NEW.funil_id) THEN
  RAISE EXCEPTION 'Vínculo inbound fora da workspace/funil'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_validar_vinculo_negocio ON public.crm_vinculos_inbound_negocio;
CREATE TRIGGER crm_validar_vinculo_negocio BEFORE INSERT OR UPDATE
 ON public.crm_vinculos_inbound_negocio FOR EACH ROW
 EXECUTE FUNCTION public.crm_validar_vinculo_negocio_inbound();
ALTER TABLE public.crm_vinculos_inbound_negocio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_vinculos_inbound_negocio FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.crm_vinculos_inbound_negocio TO service_role;

CREATE OR REPLACE FUNCTION public.crm_criar_negocio_primeiro_inbound(
 p_conta uuid,p_canal bigint,p_funil bigint,p_telefone text,p_nome text,
 p_estagio_id bigint,p_estagio_slug text,p_probabilidade integer
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=public,pg_temp AS $$
DECLARE v_id bigint; v_stage record; v_total bigint;
BEGIN
 IF p_conta IS NULL OR p_canal IS NULL OR p_funil IS NULL
   OR p_telefone !~ '^55[0-9]{10,11}$' THEN RETURN NULL; END IF;
 -- Uma única workspace piloto com crm_avancado. Sem permissão de habilitar
 -- esta automação para outras workspaces de forma implícita.
 IF NOT EXISTS(SELECT 1 FROM public.contas c WHERE c.id=p_conta
   AND c.modulos_habilitados @> ARRAY['crm_avancado']::text[]) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_canais w
   WHERE w.id=p_canal AND w.conta_id=p_conta AND w.ativo=true) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.funis f WHERE f.id=p_funil
   AND f.conta_id=p_conta AND f.ativo=true AND f.auto_criar_negocio_inbound=true
   AND f.canal_padrao_id=p_canal) THEN RETURN NULL; END IF;
 SELECT count(*) INTO v_total FROM public.funis f WHERE f.conta_id=p_conta
   AND f.ativo=true AND f.canal_padrao_id=p_canal;
 IF v_total<>1 THEN RETURN NULL; END IF;
 SELECT id,nome,probabilidade INTO v_stage FROM public.funil_estagios
  WHERE id=p_estagio_id AND funil_id=p_funil AND grupo='pipeline';
 IF NOT FOUND OR length(coalesce(p_estagio_slug,''))<2 THEN RETURN NULL; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(p_conta::text||':'||p_canal||':'||p_telefone,11));
 SELECT oportunidade_id INTO v_id FROM public.crm_vinculos_inbound_negocio
  WHERE conta_id=p_conta AND canal_id=p_canal AND telefone=p_telefone;
 IF FOUND THEN RETURN v_id; END IF;

 -- Jamais criar uma segunda oportunidade por inferência caso haja negócio
 -- preexistente neste funil/telefone: revisão humana.
 IF EXISTS(SELECT 1 FROM public.oportunidades WHERE conta_id=p_conta
   AND funil_id=p_funil AND telefone=p_telefone) THEN RETURN NULL; END IF;

 -- Só o PRIMEIRO evento deste contato/número pode iniciar o negócio.
 -- O inbound já foi gravado quando a função é chamada.
 SELECT count(*) INTO v_total FROM public.inbound_eventos
  WHERE conta_id=p_conta AND canal_id=p_canal AND telefone=p_telefone;
 IF v_total<>1 THEN RETURN NULL; END IF;

 INSERT INTO public.oportunidades(
   conta_id,empresa,contato,telefone,origem,estagio,
   funil_id,funil_estagio_id,valor,probabilidade,tags
 ) VALUES (
   p_conta,left(coalesce(nullif(btrim(p_nome),''),p_telefone),240),
   left(coalesce(nullif(btrim(p_nome),''),''),240),p_telefone,'inbox',
   p_estagio_slug,p_funil,v_stage.id,0,v_stage.probabilidade,ARRAY[]::text[]
 ) RETURNING id INTO v_id;
 INSERT INTO public.crm_vinculos_inbound_negocio(
  conta_id,canal_id,telefone,funil_id,oportunidade_id
 ) VALUES (p_conta,p_canal,p_telefone,p_funil,v_id);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_criar_negocio_primeiro_inbound(uuid,bigint,bigint,text,text,bigint,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_criar_negocio_primeiro_inbound(uuid,bigint,bigint,text,text,bigint,text,integer)
 TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
