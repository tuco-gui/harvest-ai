-- 033: configuracao manual de agentes por workspace
CREATE TABLE IF NOT EXISTS agentes_workspace (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('recepcao','bdr','vendas','suporte','financeiro')),
  nome text NOT NULL,
  instrucao text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conta_id,tipo)
);
ALTER TABLE agentes_workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY agentes_workspace_por_conta ON agentes_workspace FOR ALL TO authenticated
USING (conta_id = minha_conta() OR sou_super_admin())
WITH CHECK (conta_id = minha_conta() OR sou_super_admin());
GRANT SELECT, INSERT, UPDATE ON agentes_workspace TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE agentes_workspace_id_seq TO authenticated;
GRANT ALL ON agentes_workspace TO service_role;
GRANT USAGE, SELECT ON SEQUENCE agentes_workspace_id_seq TO service_role;
NOTIFY pgrst, 'reload schema';
