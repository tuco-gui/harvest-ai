-- 035 — Visibilidade do CRM avançado apenas na Figueira Marketing.
-- Não altera tabelas, dados de vendas nem workspaces dos clientes.
UPDATE public.contas
SET modulos_habilitados = array_append(
  coalesce(modulos_habilitados, ARRAY[]::text[]), 'crm_avancado'
)
WHERE slug = 'figueira-marketing'
  AND 'crm' = ANY(coalesce(modulos_habilitados, ARRAY[]::text[]))
  AND NOT ('crm_avancado' = ANY(coalesce(modulos_habilitados, ARRAY[]::text[])));
