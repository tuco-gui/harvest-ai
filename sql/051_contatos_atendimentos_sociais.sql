-- Paridade Deskcomm: contato identificado pelo canal, atendimento e negócio ligados.
-- Não inferir empresa/telefone a partir do nome ou IGSID. Históricos não são apagados.
BEGIN;
ALTER TABLE public.crm_conversas_externas ADD COLUMN IF NOT EXISTS contato_id bigint;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='crm_conversa_contato_tenant_fk') THEN
  ALTER TABLE public.crm_conversas_externas ADD CONSTRAINT crm_conversa_contato_tenant_fk
   FOREIGN KEY(conta_id,contato_id) REFERENCES public.crm_contatos(conta_id,id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='crm_vinculo_negocio_tenant_fk') THEN
  ALTER TABLE public.crm_vinculos_conversa_negocio ADD CONSTRAINT crm_vinculo_negocio_tenant_fk
   FOREIGN KEY(conta_id,oportunidade_id) REFERENCES public.oportunidades(conta_id,id);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_garantir_contato_social(p_conta uuid,p_conversa uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE conv record; pessoa_id bigint; negocio bigint;
BEGIN
 -- A mesma trava da criação do negócio: dois webhooks nunca criam duas pessoas.
 PERFORM pg_advisory_xact_lock(hashtextextended('social:'||p_conversa::text,31));
 SELECT c.* INTO conv FROM public.crm_conversas_externas c
 JOIN public.crm_fontes_funil f ON f.conta_id=c.conta_id AND f.id=c.fonte_id
 WHERE c.conta_id=p_conta AND c.id=p_conversa
 AND f.tipo IN ('instagram_dm','facebook_messenger')
 AND EXISTS(SELECT 1 FROM public.crm_mensagens_externas m
  WHERE m.conta_id=p_conta AND m.conversa_id=c.id AND m.direcao='entrada');
 IF NOT FOUND THEN RETURN NULL; END IF;
 pessoa_id:=conv.contato_id;
 SELECT o.id,coalesce(pessoa_id,o.contato_id) INTO negocio,pessoa_id
 FROM public.crm_vinculos_conversa_negocio v
 JOIN public.oportunidades o ON o.conta_id=v.conta_id AND o.id=v.oportunidade_id
 WHERE v.conta_id=p_conta AND v.conversa_id=p_conversa;
 -- SELECT sem linha zera o alvo; conservar a identidade já gravada da conversa.
 pessoa_id:=coalesce(pessoa_id,conv.contato_id);
 IF pessoa_id IS NULL THEN
  INSERT INTO public.crm_contatos(conta_id,nome)
  VALUES(p_conta,CASE WHEN length(trim(coalesce(conv.nome,'')))>=2 THEN left(trim(conv.nome),160)
   ELSE 'Contato social' END) RETURNING id INTO pessoa_id;
 END IF;
 UPDATE public.crm_conversas_externas SET contato_id=pessoa_id
 WHERE conta_id=p_conta AND id=p_conversa AND contato_id IS NULL;
 UPDATE public.oportunidades SET contato_id=pessoa_id
 WHERE conta_id=p_conta AND id=negocio AND contato_id IS NULL;
 RETURN pessoa_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_garantir_contato_social(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_garantir_contato_social(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_criar_negocio_primeira_conversa_social(
 p_conta uuid,p_fonte uuid,p_conversa uuid
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f record; st record; conv record; novo bigint; ja bigint; pessoa_id bigint;
BEGIN
 SELECT * INTO f FROM public.crm_fontes_funil
 WHERE id=p_fonte AND conta_id=p_conta AND tipo IN ('instagram_dm','facebook_messenger');
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO conv FROM public.crm_conversas_externas
 WHERE id=p_conversa AND conta_id=p_conta AND fonte_id=p_fonte;
 IF NOT FOUND THEN RETURN NULL; END IF;
 pessoa_id:=public.crm_garantir_contato_social(p_conta,p_conversa);
 -- Sem inbound válido não nasce contato nem negócio. Duplicatas reparam o vínculo.
 IF pessoa_id IS NULL THEN RETURN NULL; END IF;
 SELECT oportunidade_id INTO ja FROM public.crm_vinculos_conversa_negocio
 WHERE conta_id=p_conta AND conversa_id=p_conversa;
 IF FOUND THEN RETURN ja; END IF;
 IF NOT f.criar_lead_automatico OR f.status NOT IN ('pronto','aguardando_autorizacao')
 OR NOT EXISTS(SELECT 1 FROM public.funis WHERE id=f.funil_id AND conta_id=p_conta AND ativo=true)
 THEN RETURN NULL; END IF;
 SELECT * INTO st FROM public.funil_estagios
 WHERE funil_id=f.funil_id AND grupo='pipeline' ORDER BY ordem,id LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO public.oportunidades(conta_id,empresa,contato,contato_id,telefone,origem,estagio,
  funil_id,funil_estagio_id,valor,probabilidade,tags,owner_id)
 VALUES(p_conta,'',left(coalesce(nullif(trim(conv.nome),''),'Contato social'),160),pessoa_id,NULL,'inbox',
  lower(regexp_replace(st.nome,'[^a-zA-Z0-9]+','_','g')),f.funil_id,st.id,0,st.probabilidade,
  ARRAY[]::text[],conv.responsavel_id) RETURNING id INTO novo;
 INSERT INTO public.crm_vinculos_conversa_negocio(conta_id,conversa_id,oportunidade_id)
 VALUES(p_conta,p_conversa,novo);
 RETURN novo;
END $$;
REVOKE ALL ON FUNCTION public.crm_criar_negocio_primeira_conversa_social(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_criar_negocio_primeira_conversa_social(uuid,uuid,uuid) TO service_role;

-- Reparação somente de identidade, inclusive para #26. Não cria negócios retroativos,
-- não mescla pessoas por nome e não modifica títulos/empresas, responsáveis ou mensagens.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT cv.id,cv.conta_id FROM public.crm_conversas_externas cv
 JOIN public.crm_fontes_funil f ON f.id=cv.fonte_id AND f.conta_id=cv.conta_id
 WHERE f.tipo IN ('instagram_dm','facebook_messenger') AND cv.contato_id IS NULL
 LOOP PERFORM public.crm_garantir_contato_social(c.conta_id,c.id); END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
