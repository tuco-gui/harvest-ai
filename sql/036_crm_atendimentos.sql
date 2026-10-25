-- 036 — Metadados da central de atendimento CRM, sem mover mensagens.
-- Acesso somente pelo servidor Harvest (service_role), que valida workspace e perfil.
CREATE TABLE IF NOT EXISTS public.crm_atendimentos (
  conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  telefone text NOT NULL CHECK (char_length(telefone) BETWEEN 12 AND 13),
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'pendente', 'resolvido')),
  responsavel_id uuid NULL REFERENCES public.perfis(id) ON DELETE SET NULL,
  etiquetas text[] NOT NULL DEFAULT ARRAY[]::text[],
  atualizado_por uuid NULL REFERENCES public.perfis(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conta_id, telefone),
  CHECK (cardinality(etiquetas) <= 8)
);
CREATE INDEX IF NOT EXISTS crm_atendimentos_conta_status_idx
  ON public.crm_atendimentos(conta_id, status);
CREATE INDEX IF NOT EXISTS crm_atendimentos_conta_responsavel_idx
  ON public.crm_atendimentos(conta_id, responsavel_id);
ALTER TABLE public.crm_atendimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_atendimentos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_atendimentos TO service_role;
-- Nenhuma policy para anon/authenticated. APIs validadas no servidor são a única via.
NOTIFY pgrst, 'reload schema';
