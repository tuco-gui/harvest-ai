-- 042: rastreamento de canal e funil na RECEPÇÃO, sem mesclar conversas legadas.
-- Nunca reatribuir os 6072+ eventos históricos por inferência de telefone.
BEGIN;
ALTER TABLE public.inbound_eventos
  ADD COLUMN IF NOT EXISTS canal_id bigint NULL REFERENCES public.whatsapp_canais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funil_id bigint NULL REFERENCES public.funis(id) ON DELETE SET NULL;

-- A chave legada (conta,provider,message_id) colidia entre dois números
-- distintos. Legado sem canal continua único; eventos identificados usam canal.
ALTER TABLE public.inbound_eventos
  DROP CONSTRAINT IF EXISTS inbound_eventos_conta_provider_msg_key;
CREATE UNIQUE INDEX IF NOT EXISTS inbound_msg_legado_idempotente
  ON public.inbound_eventos(conta_id,provider,message_id_externo) WHERE canal_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inbound_msg_canal_idempotente
  ON public.inbound_eventos(conta_id,provider,canal_id,message_id_externo) WHERE canal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbound_eventos_canal_tel_idx
  ON public.inbound_eventos(conta_id,canal_id,telefone,recebido_em DESC);

-- Garante isolamento inclusive em inserções por service_role.
CREATE OR REPLACE FUNCTION public.validar_destino_inbound()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.canal_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.whatsapp_canais c
    WHERE c.id=NEW.canal_id AND c.conta_id=NEW.conta_id AND c.provider=NEW.provider
 ) THEN
    RAISE EXCEPTION 'Canal inbound fora da workspace ou provider divergente'
      USING ERRCODE='23514';
 END IF;
 IF NEW.funil_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.funis f
    WHERE f.id=NEW.funil_id AND f.conta_id=NEW.conta_id
      AND f.canal_padrao_id=NEW.canal_id AND f.ativo=true
 ) THEN
    RAISE EXCEPTION 'Funil inbound incompatível com canal ou workspace'
      USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inbound_validar_destino ON public.inbound_eventos;
CREATE TRIGGER inbound_validar_destino BEFORE INSERT OR UPDATE OF canal_id,funil_id,conta_id
 ON public.inbound_eventos FOR EACH ROW EXECUTE FUNCTION public.validar_destino_inbound();
NOTIFY pgrst,'reload schema';
COMMIT;
