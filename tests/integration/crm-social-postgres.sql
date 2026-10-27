-- Executado em transação com ROLLBACK pelo runner; dados fictícios isolados.
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); f bigint; etapa bigint;
 fonte uuid; conversa uuid; outra uuid; negocio bigint; repetido bigint; pessoa bigint;
 antes bigint; depois bigint; empresas bigint;
BEGIN
 INSERT INTO public.contas(id,nome,slug) VALUES(a,'Teste transacional social','teste-social-'||a),(b,'Teste tenant B','teste-social-'||b);
 INSERT INTO public.funis(conta_id,nome) VALUES(a,'Funil transacional') RETURNING id INTO f;
 INSERT INTO public.funil_estagios(funil_id,nome,ordem,probabilidade) VALUES(f,'Novo',0,5) RETURNING id INTO etapa;
 INSERT INTO public.crm_fontes_funil(conta_id,funil_id,tipo,nome,status,criar_lead_automatico)
 VALUES(a,f,'instagram_dm','Instagram teste','pronto',true) RETURNING id INTO fonte;
 INSERT INTO public.crm_conversas_externas(conta_id,fonte_id,visitante_id,segredo_hash,nome)
 VALUES(a,fonte,'12345678901234',repeat('a',64),'Perfil sem telefone') RETURNING id INTO conversa;
 IF public.crm_criar_negocio_primeira_conversa_social(a,fonte,conversa) IS NOT NULL THEN
  RAISE EXCEPTION 'Criou negócio sem inbound'; END IF;
 INSERT INTO public.crm_mensagens_externas(conta_id,conversa_id,direcao,texto) VALUES(a,conversa,'entrada','Olá, teste');
 SELECT count(*) INTO empresas FROM public.crm_empresas WHERE conta_id=a;
 negocio:=public.crm_criar_negocio_primeira_conversa_social(a,fonte,conversa);
 IF negocio IS NULL THEN RAISE EXCEPTION 'Não criou negócio da entrada'; END IF;
 SELECT contato_id INTO pessoa FROM public.oportunidades WHERE id=negocio AND conta_id=a;
 IF pessoa IS NULL OR NOT EXISTS(SELECT 1 FROM public.crm_conversas_externas WHERE id=conversa AND contato_id=pessoa) THEN
  RAISE EXCEPTION 'Contato não integra conversa e negócio'; END IF;
 IF EXISTS(SELECT 1 FROM public.oportunidades WHERE id=negocio AND (telefone IS NOT NULL OR empresa<>'' OR empresa_id IS NOT NULL)) THEN
  RAISE EXCEPTION 'Inventou telefone/empresa do perfil'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.crm_contatos WHERE id=pessoa AND conta_id=a AND telefone IS NULL AND empresa_id IS NULL) THEN
  RAISE EXCEPTION 'Contato social não foi criado corretamente'; END IF;
 repetido:=public.crm_criar_negocio_primeira_conversa_social(a,fonte,conversa);
 IF negocio<>repetido OR (SELECT count(*) FROM public.crm_contatos WHERE conta_id=a)<>1 THEN
  RAISE EXCEPTION 'Reentrega criou duplicata'; END IF;
 IF public.crm_criar_negocio_primeira_conversa_social(b,fonte,conversa) IS NOT NULL THEN
  RAISE EXCEPTION 'Cruzou tenants na criação'; END IF;
 BEGIN
  UPDATE public.crm_vinculos_conversa_negocio SET conta_id=b WHERE conta_id=a AND conversa_id=conversa;
  RAISE EXCEPTION 'Aceitou vínculo de tenants diferentes';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 UPDATE public.crm_fontes_funil SET criar_lead_automatico=false WHERE id=fonte;
 INSERT INTO public.crm_conversas_externas(conta_id,fonte_id,visitante_id,segredo_hash,nome)
 VALUES(a,fonte,'22345678901234',repeat('b',64),'Perfil sem telefone') RETURNING id INTO outra;
 INSERT INTO public.crm_mensagens_externas(conta_id,conversa_id,direcao,texto) VALUES(a,outra,'entrada','Outro contato');
 SELECT count(*) INTO antes FROM public.oportunidades WHERE conta_id=a;
 IF public.crm_criar_negocio_primeira_conversa_social(a,fonte,outra) IS NOT NULL THEN
  RAISE EXCEPTION 'Ignorou opt-out da criação automática'; END IF;
 SELECT count(*) INTO depois FROM public.oportunidades WHERE conta_id=a;
 IF antes<>depois OR (SELECT count(*) FROM public.crm_contatos WHERE conta_id=a)<>2 THEN
  RAISE EXCEPTION 'Contato sem negócio ou identidade por nome incorretos'; END IF;
 IF empresas<>(SELECT count(*) FROM public.crm_empresas WHERE conta_id=a) THEN RAISE EXCEPTION 'Criou empresa automaticamente'; END IF;
 IF has_function_privilege('anon','public.crm_garantir_contato_social(uuid,uuid)','EXECUTE') OR
 has_function_privilege('authenticated','public.crm_garantir_contato_social(uuid,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Função acessível sem service role'; END IF;
 RAISE NOTICE 'PASS: social SQL — contato sem telefone, empresa não criada, dedupe, configuração e isolamento';
END $$;
