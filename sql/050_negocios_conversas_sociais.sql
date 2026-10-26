-- Cada primeira conversa social pode criar UM lead no funil de sua fonte.
-- Telefone permanece NULL: um IGSID/PSID não é número de celular.
BEGIN;
ALTER TABLE public.crm_fontes_funil
 ADD COLUMN IF NOT EXISTS criar_lead_automatico boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.crm_vinculos_conversa_negocio(
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 conversa_id uuid NOT NULL,
 oportunidade_id bigint NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
 criado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conta_id,conversa_id),
 UNIQUE(oportunidade_id),
 FOREIGN KEY(conta_id,conversa_id) REFERENCES public.crm_conversas_externas(conta_id,id) ON DELETE CASCADE
);
ALTER TABLE public.crm_vinculos_conversa_negocio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_vinculos_conversa_negocio FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.crm_vinculos_conversa_negocio TO service_role;
CREATE OR REPLACE FUNCTION public.crm_criar_negocio_primeira_conversa_social(
 p_conta uuid,p_fonte uuid,p_conversa uuid
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f record; st record; conv record; novo bigint; ja bigint;
BEGIN
 SELECT * INTO f FROM public.crm_fontes_funil
  WHERE id=p_fonte AND conta_id=p_conta AND tipo IN ('instagram_dm','facebook_messenger')
    AND criar_lead_automatico=true AND status IN ('pronto','aguardando_autorizacao');
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.funis
  WHERE id=f.funil_id AND conta_id=p_conta AND ativo=true) THEN RETURN NULL; END IF;
 SELECT * INTO conv FROM public.crm_conversas_externas
  WHERE id=p_conversa AND conta_id=p_conta AND fonte_id=p_fonte;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO st FROM public.funil_estagios
  WHERE funil_id=f.funil_id AND grupo='pipeline' ORDER BY ordem ASC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('social:'||p_conversa::text,31));
 SELECT oportunidade_id INTO ja FROM public.crm_vinculos_conversa_negocio
  WHERE conta_id=p_conta AND conversa_id=p_conversa;
 IF FOUND THEN RETURN ja; END IF;
 INSERT INTO public.oportunidades(
  conta_id,empresa,contato,telefone,origem,estagio,funil_id,
  funil_estagio_id,valor,probabilidade,tags
 ) VALUES(
  p_conta,left(coalesce(nullif(trim(conv.nome),''),f.nome||' · '||conv.visitante_id),240),
  left(coalesce(nullif(trim(conv.nome),''),''),240),NULL,'inbox',
  lower(regexp_replace(st.nome,'[^a-zA-Z0-9]+','_','g')),f.funil_id,st.id,0,
  st.probabilidade,ARRAY[]::text[]
 ) RETURNING id INTO novo;
 INSERT INTO public.crm_vinculos_conversa_negocio(conta_id,conversa_id,oportunidade_id)
 VALUES(p_conta,p_conversa,novo);
 RETURN novo;
END $$;
REVOKE ALL ON FUNCTION public.crm_criar_negocio_primeira_conversa_social(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_criar_negocio_primeira_conversa_social(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
