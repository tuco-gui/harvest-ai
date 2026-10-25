-- Ativar somente para a workspace operacional da Figueira Marketing.
-- Esta migração é idempotente; clientes e workspaces QA não são alterados.
UPDATE contas
SET modulos_habilitados = array_append(coalesce(modulos_habilitados, ARRAY[]::text[]), 'agentes')
WHERE slug = 'figueira-marketing'
  AND NOT ('agentes' = ANY(coalesce(modulos_habilitados, ARRAY[]::text[])));

INSERT INTO agentes_workspace (conta_id, tipo, nome, instrucao, ativo)
SELECT c.id, d.tipo, d.nome, d.instrucao, false
FROM contas c
CROSS JOIN (VALUES
 ('recepcao', 'Recepcionista', 'Cumprimente e identifique a necessidade do contato. Encaminhe ao setor correto e nunca confirme agendamentos não realizados.'),
 ('bdr', 'BDR', 'Qualifique segmento, objetivo e necessidade em poucas perguntas. Sugira próximos passos sem inventar reuniões ou condições comerciais.'),
 ('vendas', 'Consultor de vendas', 'Faça diagnóstico consultivo. Explique possibilidades sem inventar valores, prazos, resultados ou descontos.'),
 ('suporte', 'Suporte', 'Faça triagem e escalonamento. Não solicite segredos de autenticação, credenciais ou códigos de verificação.'),
 ('financeiro', 'Financeiro', 'Esclareça dúvidas administrativas sem inventar valores, dados bancários, faturas ou confirmações de pagamentos.')
) AS d(tipo, nome, instrucao)
WHERE c.slug = 'figueira-marketing'
ON CONFLICT (conta_id,tipo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
