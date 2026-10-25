-- 038 — Entidades de CRM e campos personalizados, todas isoladas por workspace.
-- Sem conversão dos contatos legados em oportunidades e sem duplicação automática.
CREATE TABLE IF NOT EXISTS public.crm_empresas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 160),
 cnpj text NULL,
 telefone text NULL,
 email text NULL,
 site text NULL,
 setor text NULL,
 campos_extras jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(campos_extras)='object'),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_empresas_cnpj_unico_idx
 ON public.crm_empresas(conta_id,cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_empresas_busca_idx ON public.crm_empresas(conta_id,nome);

CREATE TABLE IF NOT EXISTS public.crm_contatos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 160),
 telefone text NULL, email text NULL, cargo text NULL,
 empresa_id bigint NULL,
 campos_extras jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(campos_extras)='object'),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_id,id),
 FOREIGN KEY(conta_id,empresa_id) REFERENCES public.crm_empresas(conta_id,id)
);
CREATE INDEX IF NOT EXISTS crm_contatos_busca_idx ON public.crm_contatos(conta_id,nome);

CREATE TABLE IF NOT EXISTS public.crm_produtos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 160),
 sku text NULL, descricao text NULL,
 preco numeric(14,2) NOT NULL DEFAULT 0 CHECK (preco>=0),
 moeda char(3) NOT NULL DEFAULT 'BRL',
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_produtos_sku_idx
 ON public.crm_produtos(conta_id,sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_produtos_busca_idx ON public.crm_produtos(conta_id,nome);

CREATE TABLE IF NOT EXISTS public.crm_campos_personalizados (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 entidade text NOT NULL CHECK (entidade IN ('contato','empresa','oportunidade')),
 chave text NOT NULL CHECK (chave ~ '^[a-z][a-z0-9_]{1,39}$'),
 rotulo text NOT NULL CHECK (length(btrim(rotulo)) BETWEEN 2 AND 80),
 tipo text NOT NULL CHECK (tipo IN ('texto','numero','data','selecao','booleano')),
 opcoes text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(opcoes)<=30),
 obrigatorio boolean NOT NULL DEFAULT false,
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_id,entidade,chave)
);
CREATE INDEX IF NOT EXISTS crm_campos_entidade_idx
 ON public.crm_campos_personalizados(conta_id,entidade,ativo);

-- Campos nos negócios existentes sem alterar nenhuma oportunidade.
ALTER TABLE public.oportunidades
 ADD COLUMN IF NOT EXISTS empresa_id bigint NULL,
 ADD COLUMN IF NOT EXISTS contato_id bigint NULL,
 ADD COLUMN IF NOT EXISTS campos_extras jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS oportunidades_conta_id_uidx
 ON public.oportunidades(conta_id,id);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='oportunidades_empresa_crm_fk') THEN
  ALTER TABLE public.oportunidades ADD CONSTRAINT oportunidades_empresa_crm_fk
   FOREIGN KEY (conta_id,empresa_id) REFERENCES public.crm_empresas(conta_id,id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='oportunidades_contato_crm_fk') THEN
  ALTER TABLE public.oportunidades ADD CONSTRAINT oportunidades_contato_crm_fk
   FOREIGN KEY (conta_id,contato_id) REFERENCES public.crm_contatos(conta_id,id);
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_itens_oportunidade (
 conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
 oportunidade_id bigint NOT NULL,
 produto_id bigint NOT NULL,
 quantidade numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantidade>0),
 preco_unitario numeric(14,2) NOT NULL CHECK (preco_unitario>=0),
 PRIMARY KEY (conta_id,oportunidade_id,produto_id),
 FOREIGN KEY(conta_id,oportunidade_id) REFERENCES public.oportunidades(conta_id,id) ON DELETE CASCADE,
 FOREIGN KEY(conta_id,produto_id) REFERENCES public.crm_produtos(conta_id,id)
);

-- Apenas APIs da aplicação com conta e papel verificados acessam as tabelas.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['crm_empresas','crm_contatos','crm_produtos',
                           'crm_campos_personalizados','crm_itens_oportunidade'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE public.crm_empresas_id_seq,
 public.crm_contatos_id_seq, public.crm_produtos_id_seq,
 public.crm_campos_personalizados_id_seq TO service_role;
NOTIFY pgrst,'reload schema';
