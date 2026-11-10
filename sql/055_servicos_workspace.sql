-- Produto multicliente. Nenhum entitlement/estado operacional existente é alterado.
BEGIN;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS recursos_versao bigint NOT NULL DEFAULT 0;
-- O papel global não pode ser obtido por um admin de cliente via REST de perfis.
CREATE FUNCTION public.servicos_proteger_papel_global() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (NEW.papel='super_admin' OR (TG_OP='UPDATE' AND OLD.papel='super_admin'))
  AND current_user NOT IN('postgres','supabase_admin','service_role') AND NOT public.sou_super_admin()
 THEN RAISE EXCEPTION 'Papel global restrito à administração da instalação' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER servicos_papel_global BEFORE INSERT OR UPDATE OF papel ON public.perfis
 FOR EACH ROW EXECUTE FUNCTION public.servicos_proteger_papel_global();
CREATE TABLE public.conta_recursos (
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 recurso text NOT NULL CHECK(length(recurso) BETWEEN 3 AND 100),liberado boolean NOT NULL,
 escopo text NOT NULL DEFAULT 'permanente' CHECK(escopo IN('permanente','homologacao')),
 expira_em timestamptz,atualizado_por uuid NOT NULL,atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conta_id,recurso,escopo),CHECK((escopo='permanente' AND expira_em IS NULL) OR (escopo='homologacao' AND liberado AND expira_em IS NOT NULL))
);
CREATE TABLE public.workspace_delegacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 ator_id uuid NOT NULL,modo text NOT NULL CHECK(modo IN('configuracao','suporte','homologacao')),
 motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 10 AND 500),criado_em timestamptz NOT NULL DEFAULT now(),
 expira_em timestamptz NOT NULL,encerrado_em timestamptz,
 CHECK(expira_em>criado_em AND expira_em<=criado_em+interval '2 hours')
);
CREATE TABLE public.servicos_auditoria (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,workspace_id uuid NOT NULL,ator_id uuid NOT NULL,
 evento text NOT NULL,detalhes jsonb NOT NULL DEFAULT '{}',criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX servicos_auditoria_workspace ON public.servicos_auditoria(workspace_id,criado_em DESC);
CREATE INDEX delegacoes_ator ON public.workspace_delegacoes(ator_id,conta_id,expira_em);
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['conta_recursos','workspace_delegacoes','servicos_auditoria'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
GRANT ALL ON public.conta_recursos,public.workspace_delegacoes TO service_role;
GRANT SELECT,INSERT ON public.servicos_auditoria TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.servicos_auditoria_id_seq TO service_role;
CREATE FUNCTION public.servicos_salvar(p_conta uuid,p_ator uuid,p_versao bigint,p_motivo text,p_mudancas jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v bigint; x jsonb; slug_conta text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM perfis WHERE id=p_ator AND papel='super_admin') THEN RAISE EXCEPTION 'Somente super admin'; END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 10 AND 500 OR jsonb_typeof(p_mudancas)<>'array' THEN RAISE EXCEPTION 'Alteração inválida'; END IF;
 SELECT recursos_versao,slug INTO v,slug_conta FROM contas WHERE id=p_conta AND ativo FOR UPDATE;
 IF NOT FOUND OR v<>p_versao THEN RAISE EXCEPTION 'Versão da workspace mudou' USING ERRCODE='40001'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_mudancas) LOOP
  IF (x->>'expira_em') IS NOT NULL AND (slug_conta<>'figueira-marketing' OR (x->>'expira_em')::timestamptz<=now() OR (x->>'expira_em')::timestamptz>now()+interval '24 hours') THEN RAISE EXCEPTION 'Homologação temporária inválida'; END IF;
  IF (x->>'expira_em') IS NULL THEN DELETE FROM conta_recursos WHERE conta_id=p_conta AND recurso=x->>'recurso' AND escopo='homologacao'; END IF;
  INSERT INTO conta_recursos(conta_id,recurso,liberado,expira_em,escopo,atualizado_por) VALUES(p_conta,x->>'recurso',(x->>'liberado')::boolean,(x->>'expira_em')::timestamptz,CASE WHEN (x->>'expira_em') IS NULL THEN 'permanente' ELSE 'homologacao' END,p_ator)
   ON CONFLICT(conta_id,recurso,escopo) DO UPDATE SET liberado=excluded.liberado,expira_em=excluded.expira_em,atualizado_por=p_ator,atualizado_em=now();
 END LOOP;
 UPDATE contas SET recursos_versao=recursos_versao+1 WHERE id=p_conta RETURNING recursos_versao INTO v;
 INSERT INTO servicos_auditoria(workspace_id,ator_id,evento,detalhes) VALUES(p_conta,p_ator,'servicos_alterados',jsonb_build_object('motivo',p_motivo,'mudancas',p_mudancas,'versao',v));
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.servicos_salvar(uuid,uuid,bigint,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.servicos_salvar(uuid,uuid,bigint,text,jsonb) TO service_role;
CREATE FUNCTION public.servicos_delegar(p_conta uuid,p_ator uuid,p_modo text,p_motivo text,p_minutos integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM perfis WHERE id=p_ator AND papel='super_admin') THEN RAISE EXCEPTION 'Somente super admin'; END IF;
 IF p_minutos NOT BETWEEN 5 AND 120 OR NOT EXISTS(SELECT 1 FROM contas WHERE id=p_conta AND ativo
   AND (p_modo<>'homologacao' OR slug='figueira-marketing')) THEN RAISE EXCEPTION 'Contexto inválido'; END IF;
 INSERT INTO workspace_delegacoes(conta_id,ator_id,modo,motivo,expira_em) VALUES(p_conta,p_ator,p_modo,p_motivo,now()+make_interval(mins=>p_minutos)) RETURNING id INTO v;
 INSERT INTO servicos_auditoria(workspace_id,ator_id,evento,detalhes) VALUES(p_conta,p_ator,'delegacao_iniciada',jsonb_build_object('delegacao_id',v,'modo',p_modo,'motivo',p_motivo,'minutos',p_minutos));
 RETURN v;
END $$;
CREATE FUNCTION public.servicos_modulos_legado(p_conta uuid,p_ator uuid,p_modulos text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE antes text[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM perfis WHERE id=p_ator AND papel='super_admin') THEN RAISE EXCEPTION 'Somente super admin'; END IF;
 SELECT modulos_habilitados INTO antes FROM contas WHERE id=p_conta FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workspace inexistente'; END IF;
 UPDATE contas SET modulos_habilitados=p_modulos,recursos_versao=recursos_versao+1 WHERE id=p_conta;
 INSERT INTO servicos_auditoria(workspace_id,ator_id,evento,detalhes) VALUES(p_conta,p_ator,'modulos_legado',jsonb_build_object('antes',antes,'depois',p_modulos));
END $$;
REVOKE ALL ON FUNCTION public.servicos_delegar(uuid,uuid,text,text,integer),public.servicos_modulos_legado(uuid,uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.servicos_delegar(uuid,uuid,text,text,integer),public.servicos_modulos_legado(uuid,uuid,text[]) TO service_role;
CREATE FUNCTION public.servicos_encerrar_delegacao(p_id uuid,p_ator uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM perfis WHERE id=p_ator AND papel='super_admin') THEN RAISE EXCEPTION 'Somente super admin'; END IF;
 UPDATE workspace_delegacoes SET encerrado_em=now() WHERE id=p_id AND ator_id=p_ator AND encerrado_em IS NULL RETURNING conta_id INTO c;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO servicos_auditoria(workspace_id,ator_id,evento,detalhes) VALUES(c,p_ator,'delegacao_encerrada',jsonb_build_object('delegacao_id',p_id));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.servicos_encerrar_delegacao(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.servicos_encerrar_delegacao(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
