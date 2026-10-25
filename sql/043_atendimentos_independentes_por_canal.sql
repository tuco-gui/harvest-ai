-- 043: metadados de atendimento independentes por canal WhatsApp.
-- Mantém todos os atendimentos legados e mensagens nos seus lugares.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_atendimentos_canais (
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 telefone text NOT NULL CHECK (char_length(telefone) BETWEEN 12 AND 13),
 canal_id bigint NOT NULL REFERENCES public.whatsapp_canais(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','pendente','resolvido')),
 responsavel_id uuid NULL REFERENCES public.perfis(id) ON DELETE SET NULL,
 etiquetas text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(etiquetas)<=8),
 atualizado_por uuid NULL REFERENCES public.perfis(id) ON DELETE SET NULL,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta','urgente')),
 prazo_triagem_em timestamptz NULL,
 resolvido_em timestamptz NULL,
 PRIMARY KEY (conta_id,telefone,canal_id)
);
CREATE INDEX IF NOT EXISTS crm_atendimentos_canais_responsavel_idx
 ON public.crm_atendimentos_canais(conta_id,responsavel_id,status);
CREATE INDEX IF NOT EXISTS crm_atendimentos_canais_sla_idx
 ON public.crm_atendimentos_canais(conta_id,prazo_triagem_em) WHERE status<>'resolvido';
ALTER TABLE public.crm_atendimentos_canais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_atendimentos_canais FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.crm_atendimentos_canais TO service_role;

CREATE OR REPLACE FUNCTION public.crm_validar_atendimento_canal()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_canais c
               WHERE c.id=NEW.canal_id AND c.conta_id=NEW.conta_id) THEN
   RAISE EXCEPTION 'Canal do atendimento não pertence à workspace'
      USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_atendimento_validar_canal ON public.crm_atendimentos_canais;
CREATE TRIGGER crm_atendimento_validar_canal BEFORE INSERT OR UPDATE OF conta_id,canal_id
 ON public.crm_atendimentos_canais FOR EACH ROW EXECUTE FUNCTION public.crm_validar_atendimento_canal();

ALTER TABLE public.crm_auditoria_atendimentos
 ADD COLUMN IF NOT EXISTS canal_id bigint NULL REFERENCES public.whatsapp_canais(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS crm_auditoria_atendimentos_canal_idx
 ON public.crm_auditoria_atendimentos(conta_id,telefone,canal_id,criado_em DESC);
CREATE OR REPLACE FUNCTION public.crm_auditar_atendimento_canal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,canal_id,tipo,novo,alterado_por)
  VALUES(NEW.conta_id,NEW.telefone,NEW.canal_id,'criacao',
   jsonb_build_object('status',NEW.status,'responsavel_id',NEW.responsavel_id,
     'prioridade',NEW.prioridade,'etiquetas',NEW.etiquetas),NEW.atualizado_por);
 ELSE
  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
   INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,canal_id,tipo,anterior,novo,alterado_por)
   VALUES(NEW.conta_id,NEW.telefone,NEW.canal_id,'transferencia',
    jsonb_build_object('responsavel_id',OLD.responsavel_id),
    jsonb_build_object('responsavel_id',NEW.responsavel_id),NEW.atualizado_por);
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
   INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,canal_id,tipo,anterior,novo,alterado_por)
   VALUES(NEW.conta_id,NEW.telefone,NEW.canal_id,'status',
    jsonb_build_object('status',OLD.status),jsonb_build_object('status',NEW.status),NEW.atualizado_por);
  END IF;
  IF OLD.prioridade IS DISTINCT FROM NEW.prioridade THEN
   INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,canal_id,tipo,anterior,novo,alterado_por)
   VALUES(NEW.conta_id,NEW.telefone,NEW.canal_id,'prioridade',
    jsonb_build_object('prioridade',OLD.prioridade),jsonb_build_object('prioridade',NEW.prioridade),NEW.atualizado_por);
  END IF;
  IF OLD.etiquetas IS DISTINCT FROM NEW.etiquetas THEN
   INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,canal_id,tipo,anterior,novo,alterado_por)
   VALUES(NEW.conta_id,NEW.telefone,NEW.canal_id,'etiquetas',
    jsonb_build_object('etiquetas',OLD.etiquetas),jsonb_build_object('etiquetas',NEW.etiquetas),NEW.atualizado_por);
  END IF;
  IF OLD.prazo_triagem_em IS DISTINCT FROM NEW.prazo_triagem_em THEN
   INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,canal_id,tipo,anterior,novo,alterado_por)
   VALUES(NEW.conta_id,NEW.telefone,NEW.canal_id,'sla',
    jsonb_build_object('prazo_triagem_em',OLD.prazo_triagem_em),
    jsonb_build_object('prazo_triagem_em',NEW.prazo_triagem_em),NEW.atualizado_por);
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_auditar_atendimento_canal() FROM PUBLIC;
DROP TRIGGER IF EXISTS crm_registrar_auditoria_canal ON public.crm_atendimentos_canais;
CREATE TRIGGER crm_registrar_auditoria_canal AFTER INSERT OR UPDATE
 ON public.crm_atendimentos_canais FOR EACH ROW EXECUTE FUNCTION public.crm_auditar_atendimento_canal();

-- Exclusão de etiqueta continua atômica em todas as fichas sem apagar outras etiquetas.
CREATE OR REPLACE FUNCTION public.crm_excluir_etiqueta(p_conta uuid,p_nome text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE total integer:=0; removidos integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.crm_etiquetas WHERE conta_id=p_conta AND nome=p_nome) THEN RETURN -1; END IF;
 UPDATE public.crm_atendimentos SET etiquetas=array_remove(etiquetas,p_nome),atualizado_em=now()
  WHERE conta_id=p_conta AND etiquetas @> ARRAY[p_nome]::text[];
 GET DIAGNOSTICS removidos=ROW_COUNT;total:=total+removidos;
 UPDATE public.crm_atendimentos_canais SET etiquetas=array_remove(etiquetas,p_nome),atualizado_em=now()
  WHERE conta_id=p_conta AND etiquetas @> ARRAY[p_nome]::text[];
 GET DIAGNOSTICS removidos=ROW_COUNT;total:=total+removidos;
 UPDATE public.oportunidades SET tags=array_remove(tags,p_nome),atualizado_em=now()
  WHERE conta_id=p_conta AND tags @> ARRAY[p_nome]::text[];
 GET DIAGNOSTICS removidos=ROW_COUNT;total:=total+removidos;
 DELETE FROM public.crm_etiquetas WHERE conta_id=p_conta AND nome=p_nome;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.crm_excluir_etiqueta(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_excluir_etiqueta(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
