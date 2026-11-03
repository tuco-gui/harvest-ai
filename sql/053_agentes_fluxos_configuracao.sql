-- Fluxos de agentes por workspace, somente configuracao; nenhuma automacao habilitada.
CREATE TABLE IF NOT EXISTS agentes_fluxos (
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('bdr')),
  configuracao jsonb NOT NULL CHECK (jsonb_typeof(configuracao) = 'object'),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conta_id,tipo)
);
ALTER TABLE agentes_fluxos ENABLE ROW LEVEL SECURITY;
CREATE POLICY agentes_fluxos_por_conta ON agentes_fluxos FOR ALL TO authenticated
USING (conta_id = minha_conta() OR sou_super_admin())
WITH CHECK (conta_id = minha_conta() OR sou_super_admin());
GRANT SELECT, INSERT, UPDATE ON agentes_fluxos TO authenticated;
GRANT ALL ON agentes_fluxos TO service_role;
NOTIFY pgrst, 'reload schema';
