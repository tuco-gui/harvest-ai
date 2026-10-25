-- 040 — Integração da UX Deskcomm/Kommo no CRM proprietário Harvest.
-- Migração aditiva, sem alterar valores existentes. Executar no banco do Harvest,
-- antes da publicação do frontend que lê crm_campos_personalizados.grupo.
ALTER TABLE public.crm_campos_personalizados
  ADD COLUMN IF NOT EXISTS grupo text NOT NULL DEFAULT 'Principal';

DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname='crm_campos_personalizados_grupo_check'
 ) THEN
  ALTER TABLE public.crm_campos_personalizados
   ADD CONSTRAINT crm_campos_personalizados_grupo_check
    CHECK (length(btrim(grupo)) BETWEEN 2 AND 60 AND grupo !~ '[<>]');
 END IF;
END $$;

-- Remover etiqueta do catálogo deve refletir tanto nos atendimentos quanto
-- nas oportunidades da MESMA workspace. Não altera mensagens ou contatos.
CREATE OR REPLACE FUNCTION public.crm_excluir_etiqueta(p_conta uuid, p_nome text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE total integer := 0;
        removidos integer := 0;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.crm_etiquetas
  WHERE conta_id=p_conta AND nome=p_nome
 ) THEN
  RETURN -1;
 END IF;

 UPDATE public.crm_atendimentos
 SET etiquetas=array_remove(etiquetas,p_nome),atualizado_em=now()
 WHERE conta_id=p_conta AND etiquetas @> ARRAY[p_nome]::text[];
 GET DIAGNOSTICS removidos=ROW_COUNT;
 total:=total+removidos;

 UPDATE public.oportunidades
 SET tags=array_remove(tags,p_nome),atualizado_em=now()
 WHERE conta_id=p_conta AND tags @> ARRAY[p_nome]::text[];
 GET DIAGNOSTICS removidos=ROW_COUNT;
 total:=total+removidos;

 DELETE FROM public.crm_etiquetas WHERE conta_id=p_conta AND nome=p_nome;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.crm_excluir_etiqueta(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_excluir_etiqueta(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
