-- Vínculos locais explícitos, sem redistribuir leads nem escrever em Superlógica/Twenty.
BEGIN;
ALTER TABLE public.superlogica_registros ADD COLUMN contato_id bigint,ADD COLUMN oportunidade_id bigint;
ALTER TABLE public.superlogica_registros ADD FOREIGN KEY(conta_id,contato_id) REFERENCES public.crm_contatos(conta_id,id);
ALTER TABLE public.superlogica_registros ADD FOREIGN KEY(conta_id,oportunidade_id) REFERENCES public.oportunidades(conta_id,id);
CREATE FUNCTION public.superlogica_vincular_crm(p_conta uuid,p_registro uuid,p_ator uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; c record; ids bigint[]; l bigint; pessoa bigint; op bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_conta::text,51));
 IF NOT EXISTS(SELECT 1 FROM perfis WHERE id=p_ator AND papel='super_admin') AND NOT EXISTS
  (SELECT 1 FROM conta_usuarios WHERE conta_id=p_conta AND user_id=p_ator AND ativo AND papel='admin')
 THEN RAISE EXCEPTION 'Administrador não autorizado'; END IF;
 IF EXISTS(SELECT 1 FROM contas WHERE id=p_conta AND 'twenty_crm'=ANY(modulos_habilitados)) THEN RAISE EXCEPTION 'Use sincronização do backend Twenty'; END IF;
 SELECT * INTO r FROM superlogica_registros WHERE conta_id=p_conta AND id=p_registro FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Captura não encontrada'; END IF;
 SELECT * INTO c FROM bdr_config WHERE conta_id=p_conta;
 IF NOT FOUND THEN RAISE EXCEPTION 'Funil não configurado'; END IF;
 -- Dois identificadores apontando para registros diferentes exigem decisão humana.
 SELECT array_agg(id) INTO ids FROM prospecta_leads WHERE conta_id=p_conta AND
  ((r.telefone IS NOT NULL AND telefone=r.telefone) OR (r.email IS NOT NULL AND lower(email)=lower(r.email)));
 IF cardinality(ids)>1 THEN RAISE EXCEPTION 'Leads ambíguos: revisar duplicidade'; END IF;
 l:=coalesce(r.lead_id_harvest,ids[1]);
 IF l IS NULL THEN INSERT INTO prospecta_leads(conta_id,empresa,telefone,email,origem,status)
  VALUES(p_conta,r.nome,r.telefone,r.email,'captura_site','novo') RETURNING id INTO l; END IF;
 IF NOT EXISTS(SELECT 1 FROM prospecta_leads WHERE conta_id=p_conta AND id=l) THEN RAISE EXCEPTION 'Lead fora da workspace'; END IF;
 SELECT array_agg(id) INTO ids FROM crm_contatos WHERE conta_id=p_conta AND
  ((r.telefone IS NOT NULL AND telefone=r.telefone) OR (r.email IS NOT NULL AND lower(email)=lower(r.email)));
 IF cardinality(ids)>1 THEN RAISE EXCEPTION 'Contatos ambíguos: revisar duplicidade'; END IF;
 pessoa:=coalesce(r.contato_id,ids[1]);
 IF pessoa IS NULL THEN INSERT INTO crm_contatos(conta_id,nome,telefone,email) VALUES(p_conta,r.nome,r.telefone,r.email) RETURNING id INTO pessoa; END IF;
 SELECT array_agg(id) INTO ids FROM oportunidades WHERE conta_id=p_conta AND
  (lead_id=l OR (contato_id=pessoa AND funil_id=c.funil_id) OR (telefone=r.telefone AND funil_id=c.funil_id));
 IF cardinality(ids)>1 THEN RAISE EXCEPTION 'Oportunidades ambíguas: revisar duplicidade'; END IF;
 op:=coalesce(r.oportunidade_id,ids[1]);
 IF op IS NULL THEN
  INSERT INTO oportunidades(conta_id,lead_id,empresa,contato,telefone,email,origem,estagio,funil_id,contato_id,observacoes)
   VALUES(p_conta,l,r.nome,r.nome,r.telefone,r.email,'captura_site','novo',c.funil_id,pessoa,
    'Captura Harvest '||r.id::text||'. Cadastro externo e atribuição comercial são estados independentes.') RETURNING id INTO op;
 ELSE
  -- Não sobrescreve responsável, estágio, canal ou dados de uma oportunidade histórica.
  UPDATE oportunidades SET contato_id=pessoa WHERE conta_id=p_conta AND id=op AND contato_id IS NULL;
 END IF;
 UPDATE superlogica_registros SET lead_id_harvest=l,contato_id=pessoa,oportunidade_id=op WHERE conta_id=p_conta AND id=p_registro;
 INSERT INTO servicos_auditoria(workspace_id,ator_id,evento,detalhes) VALUES(p_conta,p_ator,'captura_vinculada_crm',
  jsonb_build_object('registro_id',p_registro,'lead_id',l,'contato_id',pessoa,'oportunidade_id',op));
 RETURN jsonb_build_object('lead_id',l,'contato_id',pessoa,'oportunidade_id',op);
END $$;
REVOKE ALL ON FUNCTION public.superlogica_vincular_crm(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.superlogica_vincular_crm(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
