-- Ledger de provisionamento; sem chamadas remotas, sem criação de contas nesta migration.
BEGIN;
CREATE UNIQUE INDEX crm_chatwoot_conta_exclusiva ON public.crm_vinculos(chatwoot_account_id) WHERE chatwoot_account_id IS NOT NULL;
CREATE TABLE public.chatwoot_provisionamentos (
 conta_id uuid PRIMARY KEY REFERENCES public.contas(id),
 ator_id uuid NOT NULL REFERENCES public.perfis(id),
 estado text NOT NULL CHECK(estado IN('reservado','conta_criada','pronto','incerto')),
 account_id bigint UNIQUE,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chatwoot_provisionamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chatwoot_provisionamentos FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.chatwoot_provisionamentos TO service_role;
CREATE FUNCTION public.chatwoot_reservar_provisionamento(p_conta uuid,p_ator uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_conta::text,57));
 IF NOT EXISTS(SELECT 1 FROM contas WHERE id=p_conta AND ativo) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM perfis WHERE id=p_ator AND papel='super_admin') AND NOT EXISTS
  (SELECT 1 FROM conta_usuarios WHERE conta_id=p_conta AND user_id=p_ator AND ativo AND papel='admin')
 THEN RAISE EXCEPTION 'Administrador não autorizado'; END IF;
 IF EXISTS(SELECT 1 FROM crm_vinculos WHERE conta_id=p_conta AND chatwoot_account_id IS NOT NULL) THEN RETURN false; END IF;
 INSERT INTO chatwoot_provisionamentos(conta_id,ator_id,estado) VALUES(p_conta,p_ator,'reservado') ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO servicos_auditoria(workspace_id,ator_id,evento) VALUES(p_conta,p_ator,'chatwoot_provisionamento_reservado');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.chatwoot_reservar_provisionamento(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chatwoot_reservar_provisionamento(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
