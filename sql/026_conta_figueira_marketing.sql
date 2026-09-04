-- 026: Cria conta operacional "Figueira Marketing" para operações institucionais.
-- Fiqueira QA continua como sandbox/homologação.
-- Conta "Teste" NÃO é reutilizada.

INSERT INTO contas (id, nome, slug, ativo, ambiente, modulos_habilitados)
VALUES (
  'd3b07384-d113-44f2-b578-1d8c5c3cf520',
  'Figueira Marketing',
  'figueira-marketing',
  true,
  'producao',
  ARRAY['whatsapp', 'ia', 'usuarios', 'chamados', 'status', 'crm']
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  slug = EXCLUDED.slug,
  ativo = EXCLUDED.ativo,
  ambiente = EXCLUDED.ambiente,
  modulos_habilitados = EXCLUDED.modulos_habilitados;

-- Config padrão de envio para a nova conta (30-60min, modo ia)
INSERT INTO conta_config_envio (conta_id, modo, intervalo_min, intervalo_max)
VALUES ('d3b07384-d113-44f2-b578-1d8c5c3cf520', 'ia', 30, 60)
ON CONFLICT (conta_id) DO NOTHING;
