-- 030: Chatwoot inboxes genéricos (P3).
-- Suporta múltiplos inboxes Chatwoot por workspace/conta Harvest.
-- Uma conta pode ter WhatsApp + Instagram + Messenger + Telegram + outros
-- simultaneamente, cada um como um inbox separado.
--
-- Substitui a coluna chatwoot_inbox_whatsapp_id (singular) por uma tabela
-- própria que suporta N canais por conta.

-- ============================================================
-- TABELA: chatwoot_inboxes
-- ============================================================
CREATE TABLE IF NOT EXISTS chatwoot_inboxes (
  id                  bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  conta_id            uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  chatwoot_account_id integer NOT NULL,
  chatwoot_inbox_id   integer NOT NULL,
  tipo_canal          text NOT NULL,  -- whatsapp | instagram | facebook | telegram | sms | email | widget | api | line | outro
  nome                text NOT NULL,  -- nome da inbox no Chatwoot
  ativo               boolean NOT NULL DEFAULT true,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now(),

  -- Uma inbox Chatwoot só pode estar vinculada uma vez por conta Harvest
  CONSTRAINT chatwoot_inboxes_conta_inbox_key UNIQUE (conta_id, chatwoot_inbox_id)
);

CREATE INDEX IF NOT EXISTS chatwoot_inboxes_conta_idx ON chatwoot_inboxes(conta_id);
CREATE INDEX IF NOT EXISTS chatwoot_inboxes_tipo_idx ON chatwoot_inboxes(conta_id, tipo_canal);

-- ============================================================
-- Migrar dados existentes de chatwoot_inbox_whatsapp_id
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_vinculos' AND column_name = 'chatwoot_inbox_whatsapp_id'
  ) THEN
    INSERT INTO chatwoot_inboxes (conta_id, chatwoot_account_id, chatwoot_inbox_id, tipo_canal, nome)
    SELECT conta_id, chatwoot_account_id, chatwoot_inbox_whatsapp_id, 'whatsapp', 'WhatsApp (migrado)'
    FROM crm_vinculos
    WHERE chatwoot_inbox_whatsapp_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM chatwoot_inboxes ci
        WHERE ci.conta_id = crm_vinculos.conta_id
          AND ci.chatwoot_inbox_id = crm_vinculos.chatwoot_inbox_whatsapp_id
      );
  END IF;
END $$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE chatwoot_inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY chatwoot_inboxes_por_conta ON chatwoot_inboxes
  FOR ALL TO authenticated
  USING (conta_id = minha_conta() OR sou_super_admin())
  WITH CHECK (conta_id = minha_conta() OR sou_super_admin());

-- ============================================================
-- Grants
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON chatwoot_inboxes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE chatwoot_inboxes_id_seq TO authenticated;
GRANT ALL PRIVILEGES ON chatwoot_inboxes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE chatwoot_inboxes_id_seq TO service_role;

-- ============================================================
-- Remover coluna legada de crm_vinculos (se existir)
-- ============================================================
-- NÃO dropar agora — manter para backward compat. Remover em migração futura
-- quando todos os consumidores estiverem usando chatwoot_inboxes.
-- ALTER TABLE crm_vinculos DROP COLUMN IF EXISTS chatwoot_inbox_whatsapp_id;

NOTIFY pgrst, 'reload schema';
