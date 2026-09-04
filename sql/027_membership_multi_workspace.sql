-- 027: Membership multi-workspace — identidade global + workspace memberships.
--
-- Modelo:
--   perfis        = identidade global (id, nome, email, avatar, etc.)
--   conta_usuarios = associação user↔conta com papel por workspace
--
-- Migra dados existentes: cada perfil com conta_id vira 1 membership.
-- Mantém perfis.conta_id e perfis.papel como fallback legado (não removidos
-- nesta migration para não quebrar código existente em produção).

-- ============================================================
-- 1. Tabela de memberships
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conta_usuarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_id   UUID        NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  papel      public.papel NOT NULL DEFAULT 'operador',
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, conta_id)
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_conta_usuarios_user ON public.conta_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_conta_usuarios_conta ON public.conta_usuarios(conta_id);

-- ============================================================
-- 2. Migrar vínculos existentes de perfis → conta_usuarios
-- ============================================================
-- Cada perfil com conta_id não-nula vira 1 membership.
-- Idempotente: só insere se não existir já.
INSERT INTO public.conta_usuarios (user_id, conta_id, papel)
SELECT p.id, p.conta_id, p.papel
FROM public.perfis p
WHERE p.conta_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.conta_usuarios cu
    WHERE cu.user_id = p.id AND cu.conta_id = p.conta_id
  )
ON CONFLICT (user_id, conta_id) DO NOTHING;

-- ============================================================
-- 3. Super admin: criar membership em TODAS as contas ativas
--    (para poder acessar qualquer workspace via seletor)
-- ============================================================
INSERT INTO public.conta_usuarios (user_id, conta_id, papel)
SELECT p.id, c.id, 'admin'::public.papel
FROM public.perfis p
CROSS JOIN public.contas c
WHERE p.papel = 'super_admin'
  AND c.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.conta_usuarios cu
    WHERE cu.user_id = p.id AND cu.conta_id = c.id
  )
ON CONFLICT (user_id, conta_id) DO NOTHING;

-- ============================================================
-- 4. Relaxar constraint perfis_conta_coerente (legado)
--    super_admin pode ter conta_id NULL (mantido)
--    outros podem ter conta_id NULL agora (membership é a fonte)
-- ============================================================
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_conta_coerente;

-- Tornar conta_id e papel nullable (legado — fonte passa a ser conta_usuarios)
ALTER TABLE public.perfis ALTER COLUMN conta_id DROP NOT NULL;
ALTER TABLE public.perfis ALTER COLUMN papel DROP NOT NULL;

-- ============================================================
-- 5. RLS para conta_usuarios
-- ============================================================
ALTER TABLE public.conta_usuarios ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário vê seus próprios memberships OU members da mesma conta
-- (admin pode ver todos da conta) OU super_admin vê tudo.
CREATE POLICY conta_usuarios_leitura ON public.conta_usuarios
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conta_usuarios eu
      WHERE eu.user_id = auth.uid()
        AND eu.conta_id = public.conta_usuarios.conta_id
        AND eu.papel IN ('admin', 'super_admin')
        AND eu.ativo = true
    )
    OR public.sou_super_admin()
  );

-- Escrita: apenas admin/super_admin daquela conta pode inserir/atualizar/remover
CREATE POLICY conta_usuarios_escrita ON public.conta_usuarios
  FOR ALL TO authenticated
  USING (public.sou_admin_da_conta(conta_id))
  WITH CHECK (public.sou_admin_da_conta(conta_id));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conta_usuarios TO authenticated;
GRANT ALL PRIVILEGES ON public.conta_usuarios TO service_role;

-- ============================================================
-- 6. Função helper: papel do usuário em uma conta específica
-- ============================================================
CREATE OR REPLACE FUNCTION public.papel_na_conta(alvo_conta UUID)
RETURNS public.papel
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT papel FROM public.conta_usuarios
  WHERE user_id = auth.uid()
    AND conta_id = alvo_conta
    AND ativo = true
  LIMIT 1;
$$;

-- ============================================================
-- 7. Função helper: contas acessíveis pelo usuário logado
-- ============================================================
CREATE OR REPLACE FUNCTION public.contas_do_usuario()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  slug TEXT,
  papel public.papel
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT c.id, c.nome, c.slug, cu.papel
  FROM public.conta_usuarios cu
  JOIN public.contas c ON c.id = cu.conta_id
  WHERE cu.user_id = auth.uid()
    AND cu.ativo = true
    AND c.ativo = true
  ORDER BY c.nome;
$$;

-- ============================================================
-- 8. Trigger handle_new_user: NÃO seta mais conta_id/papel no perfis
--    (membership é criada separadamente pelo admin ou convite)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'email', NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
-- Nota: o trigger já existe; esta migration redefine para NÃO inserir
-- conta_id/papel (que agora ficam em conta_usuarios).
