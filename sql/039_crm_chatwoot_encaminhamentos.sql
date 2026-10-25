-- 039 — Histórico de encaminhamento humano ao Chatwoot.
-- Adiciona auditoria independente, sem importar conversas nem modificar mensagens.
CREATE TABLE IF NOT EXISTS public.crm_chatwoot_encaminhamentos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 telefone text NOT NULL CHECK (length(telefone) BETWEEN 12 AND 13),
 chatwoot_account_id integer NOT NULL CHECK (chatwoot_account_id>0),
 chatwoot_conversa_id integer NOT NULL CHECK (chatwoot_conversa_id>0),
 chatwoot_agente_id integer NOT NULL CHECK (chatwoot_agente_id>0),
 realizado_por uuid NULL REFERENCES public.perfis(id) ON DELETE SET NULL,
 confirmado boolean NOT NULL DEFAULT false,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_chatwoot_encaminhamentos_conversa_idx
 ON public.crm_chatwoot_encaminhamentos(conta_id,telefone,criado_em DESC);
ALTER TABLE public.crm_chatwoot_encaminhamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_chatwoot_encaminhamentos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.crm_chatwoot_encaminhamentos TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.crm_chatwoot_encaminhamentos_id_seq TO service_role;
NOTIFY pgrst,'reload schema';
