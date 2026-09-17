-- 032_campanha_automacao_modelo.sql
-- Adiciona coluna automacao_modelo para configurar automação comercial da campanha.
-- Modelo: 'herdar' (padrão do funil), 'custom' (escolher outro), 'none' (sem automação).

ALTER TABLE prospecta_campanhas
  ADD COLUMN IF NOT EXISTS automacao_modelo text NOT NULL DEFAULT 'herdar';

COMMENT ON COLUMN prospecta_campanhas.automacao_modelo IS
  'Modelo de automação comercial: herdar (usa automações do funil), custom (usa automação específica), none (sem automação)';
