-- Configuração por instância. Não cria/ativa agentes nem altera modos existentes.
BEGIN;
ALTER TABLE public.agentes_workspace ADD COLUMN configuracao jsonb;
ALTER TABLE public.agentes_workspace ADD CONSTRAINT agentes_configuracao_objeto CHECK(configuracao IS NULL OR jsonb_typeof(configuracao)='object');
ALTER TABLE public.bdr_config DROP CONSTRAINT bdr_config_codigo_anuncio_check;
ALTER TABLE public.bdr_config ALTER COLUMN codigo_anuncio DROP DEFAULT;
ALTER TABLE public.bdr_config ADD COLUMN distribuicao_crm_validada jsonb;
ALTER TABLE public.bdr_config ADD CONSTRAINT bdr_codigo_formato CHECK(length(btrim(codigo_anuncio)) BETWEEN 1 AND 100);
CREATE FUNCTION public.bdr_proteger_vinculos() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (OLD.canal_id,OLD.funil_id,OLD.codigo_anuncio) IS DISTINCT FROM (NEW.canal_id,NEW.funil_id,NEW.codigo_anuncio)
  AND (EXISTS(SELECT 1 FROM bdr_sessoes WHERE conta_id=OLD.conta_id) OR EXISTS(SELECT 1 FROM superlogica_registros WHERE conta_id=OLD.conta_id))
 THEN RAISE EXCEPTION 'Vínculos com histórico exigem migração específica'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bdr_preservar_historico BEFORE UPDATE ON public.bdr_config FOR EACH ROW EXECUTE FUNCTION public.bdr_proteger_vinculos();
-- Substitui exclusivamente a identificação fixa do resumo da função histórica 054.
DO $$ DECLARE ddl text; BEGIN
 ddl:=pg_get_functiondef('public.bdr_receber(uuid,bigint,text)'::regprocedure);
 IF position('''imovel'',''CA0653_MMOL''' IN ddl)=0 THEN RAISE EXCEPTION 'Contrato bdr_receber inesperado'; END IF;
 EXECUTE replace(ddl,'''imovel'',''CA0653_MMOL''','''imovel'',(SELECT codigo_anuncio FROM public.bdr_config WHERE conta_id=p_conta)');
END $$;
REVOKE INSERT,UPDATE ON public.agentes_workspace FROM authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
