-- 028: Funis (pipelines) customizáveis + estágios por funil.
-- Cria tabelas funis e funil_estagios, adiciona referência em campanhas e oportunidades.

-- ============================================================
-- TABELA: funis
-- ============================================================
CREATE TABLE IF NOT EXISTS funis (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  conta_id      uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funis_conta_idx ON funis(conta_id);

-- ============================================================
-- TABELA: funil_estagios
-- ============================================================
CREATE TABLE IF NOT EXISTS funil_estagios (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  funil_id      bigint NOT NULL REFERENCES funis(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  ordem         integer NOT NULL DEFAULT 0,
  grupo         text NOT NULL DEFAULT 'pipeline' CHECK (grupo IN ('pipeline', 'encerrado')),
  probabilidade integer NOT NULL DEFAULT 0 CHECK (probabilidade >= 0 AND probabilidade <= 100),
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funil_estagios_funil_idx ON funil_estagios(funil_id);
CREATE UNIQUE INDEX IF NOT EXISTS funil_estagios_funil_ordem_idx ON funil_estagios(funil_id, ordem);

-- ============================================================
-- COLUNAS: prospecta_campanhas
-- ============================================================
ALTER TABLE prospecta_campanhas ADD COLUMN IF NOT EXISTS funil_id bigint REFERENCES funis(id) ON DELETE SET NULL;
ALTER TABLE prospecta_campanhas ADD COLUMN IF NOT EXISTS estagio_inicial text NOT NULL DEFAULT 'novo';

-- ============================================================
-- COLUNAS: oportunidades
-- ============================================================
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS funil_id bigint REFERENCES funis(id) ON DELETE SET NULL;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS funil_estagio_id bigint REFERENCES funil_estagios(id) ON DELETE SET NULL;

-- ============================================================
-- RLS: funis
-- ============================================================
ALTER TABLE funis ENABLE ROW LEVEL SECURITY;

CREATE POLICY funis_por_conta ON funis
  FOR ALL TO authenticated
  USING (conta_id = minha_conta() OR sou_super_admin())
  WITH CHECK (conta_id = minha_conta() OR sou_super_admin());

-- ============================================================
-- RLS: funil_estagios
-- ============================================================
ALTER TABLE funil_estagios ENABLE ROW LEVEL SECURITY;

CREATE POLICY funil_estagios_por_funil ON funil_estagios
  FOR ALL TO authenticated
  USING (funil_id IN (SELECT id FROM funis WHERE conta_id = minha_conta() OR sou_super_admin()))
  WITH CHECK (funil_id IN (SELECT id FROM funis WHERE conta_id = minha_conta() OR sou_super_admin()));

-- ============================================================
-- FUNIL PADRÃO: "Funil Padrão" com os 7 estágios pipeline + 4 encerrados
-- para cada conta existente que tenha módulo CRM habilitado.
-- ============================================================
DO $$
DECLARE
  conta RECORD;
  funil_id bigint;
  est RECORD;
  ESTAGIOS_DEFAULT RECORD[];
BEGIN
  -- Estágios do pipeline (na ordem)
  FOR conta IN
    SELECT id FROM contas
    WHERE id IN (
      SELECT DISTINCT conta_id FROM conta_modulos
      WHERE modulo = 'crm' AND ativo = true
    )
    AND NOT EXISTS (SELECT 1 FROM funis WHERE conta_id = contas.id)
  LOOP
    INSERT INTO funis (conta_id, nome, ativo)
    VALUES (conta.id, 'Funil Padrão', true)
    RETURNING id INTO funil_id;

    -- Pipeline stages
    INSERT INTO funil_estagios (funil_id, nome, ordem, grupo, probabilidade) VALUES
      (funil_id, 'Novo',         1, 'pipeline', 5),
      (funil_id, 'Contatado',    2, 'pipeline', 10),
      (funil_id, 'Respondeu',    3, 'pipeline', 20),
      (funil_id, 'Qualificando', 4, 'pipeline', 35),
      (funil_id, 'Reunião',      5, 'pipeline', 50),
      (funil_id, 'Proposta',     6, 'pipeline', 70),
      (funil_id, 'Ganho',        7, 'pipeline', 100);

    -- Encerrados
    INSERT INTO funil_estagios (funil_id, nome, ordem, grupo, probabilidade) VALUES
      (funil_id, 'Sem interesse', 8, 'encerrado', 0),
      (funil_id, 'Opt-out',       9, 'encerrado', 0),
      (funil_id, 'Inválido',     10, 'encerrado', 0),
      (funil_id, 'Perdido',      11, 'encerrado', 0);
  END LOOP;
END $$;
