-- Operação única, exclusivamente Realize, canal antigo 24 -> canal conectado 28.
-- Executar somente após pg_dump validado e autorização do responsável.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $cutover$
DECLARE tenant uuid; ator uuid; antes bigint; depois bigint;
BEGIN
 SELECT c.id INTO STRICT tenant FROM public.contas c JOIN public.bdr_config b ON b.conta_id=c.id WHERE c.slug='realize' AND c.ativo AND b.modo='simulacao' AND b.canal_id=24 AND b.funil_id=13 AND b.codigo_anuncio='CA0653_MMOL' FOR UPDATE OF c,b;
 SELECT p.id INTO STRICT ator FROM public.perfis p JOIN auth.users u ON u.id=p.id WHERE p.papel='super_admin' AND lower(u.email) IN ('guilherme@figueiramarket.com.br','guilherme@figueiramarketing.com.br');
 PERFORM pg_advisory_xact_lock(hashtextextended(tenant::text,51));
 IF (SELECT count(*) FROM public.conta_recursos WHERE conta_id=tenant AND recurso IN ('agentes.bdr','agentes.responder') AND NOT liberado AND escopo='permanente')<>2 THEN RAISE EXCEPTION 'Bloqueios BDR ausentes'; END IF;
 IF EXISTS(SELECT 1 FROM public.bdr_sessoes WHERE conta_id=tenant) OR EXISTS(SELECT 1 FROM public.prospecta_campanhas WHERE conta_id=tenant) THEN RAISE EXCEPTION 'Sessões ou campanhas exigem revisão'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_canais WHERE conta_id=tenant AND id=24 AND status='desconectado' AND padrao AND ativo) OR NOT EXISTS(SELECT 1 FROM public.whatsapp_canais WHERE conta_id=tenant AND id=28 AND status='conectado' AND numero='5514997080405' AND provider='waha' AND ativo AND NOT padrao AND identificador_externo IS NOT NULL) THEN RAISE EXCEPTION 'Canais divergentes'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.funis WHERE conta_id=tenant AND id=13 AND canal_padrao_id=24 AND ativo AND auto_criar_negocio_inbound) THEN RAISE EXCEPTION 'Funil divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agentes_workspace WHERE conta_id=tenant AND tipo='bdr' AND configuracao->'canais'='[24]'::jsonb AND configuracao->'funis'='[13]'::jsonb) THEN RAISE EXCEPTION 'Configuração divergente'; END IF;
 SELECT count(*) INTO antes FROM public.superlogica_registros WHERE conta_id=tenant;
 -- Preserva o funil Alea e seu histórico. Desliga criação automática indiscriminada de negócio.
 UPDATE public.funis SET canal_padrao_id=28,auto_criar_negocio_inbound=false WHERE conta_id=tenant AND id=13;
 -- Exceção transacional única, pois o gatilho protege também capturas históricas
 -- que não possuem canal. Sem sessões antigas, sem alterar imóvel nem funil.
 ALTER TABLE public.bdr_config DISABLE TRIGGER bdr_preservar_historico;
 UPDATE public.bdr_config SET canal_id=28,atualizado_em=now() WHERE conta_id=tenant AND canal_id=24 AND modo='simulacao';
 ALTER TABLE public.bdr_config ENABLE TRIGGER bdr_preservar_historico;
 UPDATE public.agentes_workspace SET configuracao=jsonb_set(configuracao,'{canais}','[28]'::jsonb) WHERE conta_id=tenant AND tipo='bdr';
 UPDATE public.whatsapp_canais SET padrao=false WHERE conta_id=tenant AND id=24;
 UPDATE public.whatsapp_canais SET padrao=true WHERE conta_id=tenant AND id=28;
 SELECT count(*) INTO depois FROM public.superlogica_registros WHERE conta_id=tenant;
 IF antes<>depois THEN RAISE EXCEPTION 'Contagem de registros alterada'; END IF;
 INSERT INTO public.servicos_auditoria(workspace_id,ator_id,evento,detalhes) VALUES(tenant,ator,'realize_canal_bdr_reconciliado',jsonb_build_object('canal_anterior',24,'canal_novo',28,'funil',13,'registros_preservados',antes,'auto_criar_negocio_inbound_anterior',true,'auto_criar_negocio_inbound_novo',false,'modo','simulacao','bdr_bloqueado',true,'resposta_bloqueada',true,'backup','harvest-pre-realize-c28-20261126.dump'));
END $cutover$;
COMMIT;
