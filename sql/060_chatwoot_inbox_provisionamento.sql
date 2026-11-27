-- Reserva persistente de caixas API para os transportes existentes.
-- Não cria conta, inbox, mensagens, callbacks ou sessões externas nesta migração.
BEGIN;
CREATE TABLE public.chatwoot_inbox_provisionamentos (
 conta_id uuid NOT NULL REFERENCES public.contas(id),
 canal_id bigint NOT NULL REFERENCES public.whatsapp_canais(id),
 ator_id uuid NOT NULL REFERENCES public.perfis(id),
 account_id bigint NOT NULL CHECK(account_id>0),
 inbox_id bigint UNIQUE CHECK(inbox_id>0),
 estado text NOT NULL CHECK(estado IN ('reservado','preparado','incerto')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conta_id,canal_id),
 CHECK(estado<>'preparado' OR inbox_id IS NOT NULL)
);
ALTER TABLE public.chatwoot_inbox_provisionamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chatwoot_inbox_provisionamentos FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.chatwoot_inbox_provisionamentos TO service_role;
CREATE FUNCTION public.chatwoot_reservar_inbox_whatsapp(p_conta uuid,p_ator uuid,p_canal bigint,p_account bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_conta::text,60));
 IF NOT EXISTS(SELECT 1 FROM contas WHERE id=p_conta AND ativo) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM perfis WHERE id=p_ator AND papel='super_admin') AND NOT EXISTS
 (SELECT 1 FROM conta_usuarios WHERE conta_id=p_conta AND user_id=p_ator AND ativo AND papel='admin')
 THEN RAISE EXCEPTION 'Administrador não autorizado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM crm_vinculos WHERE conta_id=p_conta AND ativo AND chatwoot_account_id=p_account)
 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM whatsapp_canais WHERE conta_id=p_conta AND id=p_canal AND ativo AND status='conectado' AND provider IN ('waha','evolution'))
 THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM chatwoot_inboxes WHERE conta_id=p_conta AND whatsapp_canal_id=p_canal)
 THEN RETURN false; END IF;
 INSERT INTO chatwoot_inbox_provisionamentos(conta_id,canal_id,ator_id,account_id,estado)
 VALUES(p_conta,p_canal,p_ator,p_account,'reservado') ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO servicos_auditoria(workspace_id,ator_id,evento,detalhes)
 VALUES(p_conta,p_ator,'chatwoot_inbox_reservada',jsonb_build_object('canal_id',p_canal,'account_id',p_account));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.chatwoot_reservar_inbox_whatsapp(uuid,uuid,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chatwoot_reservar_inbox_whatsapp(uuid,uuid,bigint,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
