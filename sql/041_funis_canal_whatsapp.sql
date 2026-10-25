-- 041 — Um canal padrão por funil, independente do padrão geral da conta.
-- Aditivo e reversível: nenhuma sessão WAHA, campanha ou canal existente é alterado.
ALTER TABLE public.funis
  ADD COLUMN IF NOT EXISTS canal_padrao_id bigint NULL
  REFERENCES public.whatsapp_canais(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS funis_conta_canal_padrao_idx
  ON public.funis(conta_id, canal_padrao_id) WHERE canal_padrao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validar_canal_padrao_do_funil()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.canal_padrao_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_canais c
    WHERE c.id=NEW.canal_padrao_id AND c.conta_id=NEW.conta_id AND c.ativo=true
  ) THEN
    RAISE EXCEPTION 'Canal não pertence à workspace do funil ou está inativo'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS funis_validar_canal_padrao ON public.funis;
CREATE TRIGGER funis_validar_canal_padrao
 BEFORE INSERT OR UPDATE OF canal_padrao_id,conta_id
 ON public.funis FOR EACH ROW EXECUTE FUNCTION public.validar_canal_padrao_do_funil();
NOTIFY pgrst, 'reload schema';
