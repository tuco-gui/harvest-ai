-- 037 - etiquetas com cores, prioridade, SLA de triagem e auditoria append-only
-- Sem alteração retroativa de mensagens, contatos ou credenciais.
CREATE TABLE IF NOT EXISTS public.crm_etiquetas (
  conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (length(nome) BETWEEN 1 AND 28 AND nome = lower(btrim(nome))),
  cor text NULL CHECK (cor ~ '^#[0-9A-Fa-f]{6}$'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conta_id, nome)
);
ALTER TABLE public.crm_etiquetas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_etiquetas FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_etiquetas TO service_role;

ALTER TABLE public.crm_atendimentos
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS prazo_triagem_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolvido_em timestamptz NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_atendimentos_prioridade_check') THEN
    ALTER TABLE public.crm_atendimentos ADD CONSTRAINT crm_atendimentos_prioridade_check
      CHECK (prioridade IN ('baixa','normal','alta','urgente'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS crm_atendimentos_sla_idx
  ON public.crm_atendimentos(conta_id, prazo_triagem_em)
  WHERE status <> 'resolvido';

CREATE TABLE IF NOT EXISTS public.crm_auditoria_atendimentos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conta_id uuid NOT NULL,
  telefone text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('criacao','transferencia','status','prioridade','etiquetas','sla')),
  anterior jsonb NOT NULL DEFAULT '{}'::jsonb,
  novo jsonb NOT NULL DEFAULT '{}'::jsonb,
  alterado_por uuid NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_auditoria_atendimentos_busca_idx
 ON public.crm_auditoria_atendimentos(conta_id,telefone,criado_em DESC);
ALTER TABLE public.crm_auditoria_atendimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_auditoria_atendimentos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crm_auditoria_atendimentos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.crm_auditoria_atendimentos_id_seq TO service_role;

-- Trigger transacional: grava o evento mesmo em mudanças efetuadas por APIs futuras.
-- Função owner-controlled; nenhuma requisição externa é realizada pelo banco.
CREATE OR REPLACE FUNCTION public.crm_registrar_auditoria_atendimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,tipo,novo,alterado_por)
   VALUES(NEW.conta_id,NEW.telefone,'criacao',
     jsonb_build_object('status',NEW.status,'responsavel_id',NEW.responsavel_id,
       'prioridade',NEW.prioridade,'etiquetas',NEW.etiquetas), NEW.atualizado_por);
 ELSE
   IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
     INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,tipo,anterior,novo,alterado_por)
     VALUES(NEW.conta_id,NEW.telefone,'transferencia',
       jsonb_build_object('responsavel_id',OLD.responsavel_id),
       jsonb_build_object('responsavel_id',NEW.responsavel_id),NEW.atualizado_por);
   END IF;
   IF OLD.status IS DISTINCT FROM NEW.status THEN
     INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,tipo,anterior,novo,alterado_por)
     VALUES(NEW.conta_id,NEW.telefone,'status',jsonb_build_object('status',OLD.status),
       jsonb_build_object('status',NEW.status),NEW.atualizado_por);
   END IF;
   IF OLD.prioridade IS DISTINCT FROM NEW.prioridade THEN
     INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,tipo,anterior,novo,alterado_por)
     VALUES(NEW.conta_id,NEW.telefone,'prioridade',jsonb_build_object('prioridade',OLD.prioridade),
       jsonb_build_object('prioridade',NEW.prioridade),NEW.atualizado_por);
   END IF;
   IF OLD.etiquetas IS DISTINCT FROM NEW.etiquetas THEN
     INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,tipo,anterior,novo,alterado_por)
     VALUES(NEW.conta_id,NEW.telefone,'etiquetas',jsonb_build_object('etiquetas',OLD.etiquetas),
       jsonb_build_object('etiquetas',NEW.etiquetas),NEW.atualizado_por);
   END IF;
   IF OLD.prazo_triagem_em IS DISTINCT FROM NEW.prazo_triagem_em THEN
     INSERT INTO public.crm_auditoria_atendimentos(conta_id,telefone,tipo,anterior,novo,alterado_por)
     VALUES(NEW.conta_id,NEW.telefone,'sla',
       jsonb_build_object('prazo_triagem_em',OLD.prazo_triagem_em),
       jsonb_build_object('prazo_triagem_em',NEW.prazo_triagem_em),NEW.atualizado_por);
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_registrar_auditoria_atendimento() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_crm_auditoria_atendimento ON public.crm_atendimentos;
CREATE TRIGGER trg_crm_auditoria_atendimento
AFTER INSERT OR UPDATE ON public.crm_atendimentos
FOR EACH ROW EXECUTE FUNCTION public.crm_registrar_auditoria_atendimento();

-- Remoção DEFINITIVA e atômica de etiqueta do vocabulário e das conversas.
CREATE OR REPLACE FUNCTION public.crm_excluir_etiqueta(p_conta uuid, p_nome text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE total integer := 0;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.crm_etiquetas WHERE conta_id=p_conta AND nome=p_nome) THEN
  RETURN -1;
 END IF;
 UPDATE public.crm_atendimentos
 SET etiquetas=array_remove(etiquetas,p_nome), atualizado_em=now()
 WHERE conta_id=p_conta AND etiquetas @> ARRAY[p_nome]::text[];
 GET DIAGNOSTICS total = ROW_COUNT;
 DELETE FROM public.crm_etiquetas WHERE conta_id=p_conta AND nome=p_nome;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.crm_excluir_etiqueta(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_excluir_etiqueta(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
