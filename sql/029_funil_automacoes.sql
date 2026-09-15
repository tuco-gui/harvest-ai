-- 029: Automações por estágio do funil (P1).
-- Permite ao administrador configurar gatilhos e ações em cada estágio.
-- Arquitetura extensível: novos triggers/actions são adicionados como novos
-- valores de CHECK sem alterar a tabela.

-- ============================================================
-- TABELA: funil_automacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS funil_automacoes (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  conta_id      uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  funil_id      bigint NOT NULL REFERENCES funis(id) ON DELETE CASCADE,
  estagio_id    bigint NOT NULL REFERENCES funil_estagios(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,

  -- Gatilho: quando dispara
  gatilho       text NOT NULL CHECK (gatilho IN (
    'mensagem_recebida',
    'resposta_positiva',
    'resposta_negativa',
    'opt_out',
    'oportunidade_entrando_estagio',
    'oportunidade_saindo_estagio'
  )),

  -- Condição opcional: filtro adicional (JSONB para extensibilidade futura)
  condicao      jsonb NOT NULL DEFAULT '{}',

  -- Ação: o que fazer
  acao          text NOT NULL CHECK (acao IN (
    'mover_estagio',
    'atribuir_responsavel',
    'atribuir_equipe',
    'adicionar_etiqueta',
    'registrar_atividade',
    'notificar_usuario',
    'iniciar_bot',
    'encerrar_oportunidade'
  )),

  -- Parâmetros da ação (JSONB flexível)
  acao_parametros jsonb NOT NULL DEFAULT '{}',

  -- Metadados
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funil_automacoes_conta_idx ON funil_automacoes(conta_id);
CREATE INDEX IF NOT EXISTS funil_automacoes_funil_idx ON funil_automacoes(funil_id);
CREATE INDEX IF NOT EXISTS funil_automacoes_estagio_idx ON funil_automacoes(estagio_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE funil_automacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY funil_automacoes_por_conta ON funil_automacoes
  FOR ALL TO authenticated
  USING (conta_id = minha_conta() OR sou_super_admin())
  WITH CHECK (conta_id = minha_conta() OR sou_super_admin());

-- ============================================================
-- Coluna etiquetas em oportunidades (para ação adicionar_etiqueta)
-- ============================================================
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS etiquetas jsonb NOT NULL DEFAULT '[]';

-- ============================================================
-- TABELA: automacao_execucoes (log de execuções, idempotência)
-- ============================================================
CREATE TABLE IF NOT EXISTS automacao_execucoes (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  automacao_id  bigint NOT NULL REFERENCES funil_automacoes(id) ON DELETE CASCADE,
  conta_id      uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  evento_tipo   text NOT NULL,          -- 'inbound' | 'estagio_saida' | 'estagio_entrada'
  evento_id     bigint NOT NULL,        -- id do evento (oportunidade, lead, etc)
  resultado     text NOT NULL DEFAULT 'sucesso', -- 'sucesso' | 'erro'
  erro          text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automacao_execucoes_automacao_idx ON automacao_execucoes(automacao_id);
CREATE INDEX IF NOT EXISTS automacao_execucoes_evento_idx ON automacao_execucoes(evento_tipo, evento_id);

-- Idempotência: não executar a mesma automação no mesmo evento duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS automacao_execucoes_uniq ON automacao_execucoes(automacao_id, evento_tipo, evento_id);

-- ============================================================
-- RLS: automacao_execucoes
-- ============================================================
ALTER TABLE automacao_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY automacao_execucoes_por_conta ON automacao_execucoes
  FOR ALL TO authenticated
  USING (conta_id = minha_conta() OR sou_super_admin())
  WITH CHECK (conta_id = minha_conta() OR sou_super_admin());

-- ============================================================
-- Grants
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON funil_automacoes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE funil_automacoes_id_seq TO authenticated;
GRANT ALL PRIVILEGES ON funil_automacoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE funil_automacoes_id_seq TO service_role;

GRANT SELECT, INSERT ON automacao_execucoes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE automacao_execucoes_id_seq TO authenticated;
GRANT ALL PRIVILEGES ON automacao_execucoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE automacao_execucoes_id_seq TO service_role;

-- ============================================================
-- AUTOMAÇÃO PADRÃO: mover para "Respondeu" quando mensagem recebida
--
-- Esta automação é CRIADA POR PADRÃO mas pode ser desativada/editada
-- pelo administrador. O pipeline de inbound (lib/inbound.ts) NÃO movimenta
-- o funil automaticamente — toda movimentação é feita por automações.
--
-- Para desativar: UPDATE funil_automacoes SET ativo = false WHERE ...
-- Para editar o gatilho/ação: UPDATE funil_automacoes SET gatilho = ..., acao = ...
-- Para remover: DELETE FROM funil_automacoes WHERE ...
-- ============================================================
DO $$
DECLARE
  funil RECORD;
  estagio_respondeu bigint;
BEGIN
  FOR funil IN
    SELECT f.id AS funil_id, f.conta_id
    FROM funis f
    WHERE f.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM funil_automacoes fa
        WHERE fa.funil_id = f.id
          AND fa.gatilho = 'mensagem_recebida'
          AND fa.acao = 'mover_estagio'
      )
  LOOP
    -- Buscar estágio "Respondeu" do funil
    SELECT id INTO estagio_respondeu
    FROM funil_estagios
    WHERE funil_id = funil.funil_id
      AND nome ILIKE 'respondeu'
      AND grupo = 'pipeline'
    LIMIT 1;

    IF estagio_respondeu IS NOT NULL THEN
      INSERT INTO funil_automacoes (conta_id, funil_id, estagio_id, nome, gatilho, acao, acao_parametros)
      VALUES (
        funil.conta_id,
        funil.funil_id,
        estagio_respondeu,
        'Mover para Respondeu ao receber resposta',
        'mensagem_recebida',
        'mover_estagio',
        jsonb_build_object('estagio_destino_id', estagio_respondeu)
      );
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
