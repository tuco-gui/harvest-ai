# ADR-012 — Agentes de IA no Harvest único (primeira entrega)

**Data:** 2026-10-25
**Decisão:** a homologação acontece no Harvest institucional, com o módulo `agentes` habilitado primeiro na **workspace Figueira Marketing**. Nenhum staging externo.

## Entregue
- Tipos: Recepcionista, BDR, Consultor de vendas, Suporte e Financeiro.
- Persistência individual por `conta_id` e `tipo` em `agentes_workspace`, com RLS, unique key, sem dados compartilhados.
- Exclusividade inicial: `sql/034_agentes_figueira_habilitacao.sql` habilita `agentes` somente onde `contas.slug = 'figueira-marketing'`, sem sobrescrever módulos anteriores.
- UI `/agentes` no menu da workspace habilitada, edição de nome, instruções e estado `ativo`.
- API protegida `/api/agentes` (GET/PATCH), com escopo derivado da sessão e papel.
- Simulação manual `/api/agentes/testar`, invocando o provedor já cadastrado na workspace; não retorna chaves e não envia contatos.
- Correção da lista de contas para superadmin: deve listar todas as workspaces ativas sem exigir membership.
- Testes `tests/unit/agentes.test.ts`, TypeScript e build em GitHub Actions.

## Estado inicial confirmado em produção
- 5 agentes iniciais, todos **inativos**.
- Apenas 1 workspace com o módulo `agentes` habilitado.
- 0 configurações de agentes em workspaces que não sejam Figueira Marketing.
- As migrações 033 e 034 foram aplicadas por comando Postgres transacional na VPS institucional; não houve alteração de credenciais, campanhas ou mensagens.

## Restrições de segurança
- `ativo` indica configuração no catálogo, **não ativa bot, webhook, disparo ou automação**. Integrações serão implementadas posteriormente.
- Simulações exigem a chave de IA da própria workspace; se ausente retornam aviso e não tentam fallback com credenciais de terceiros.
- Não inventar resultado nem anunciar funcionamento automático com WhatsApp.
- Contratos com clientes, opt-outs e logs existentes não foram modificados.
- Não permitir vazamento de tenant pelo cliente informando `conta_id`: a API deriva da sessão.

## Próximos marcos
1. Revisar prompts na Figueira e validar conversa com IA de forma interativa.
2. Adicionar base de conhecimento por agente com documentos e páginas; política de privacidade.
3. Vincular ferramentas DeskcommCRM/Harvest, com ações explicitamente autorizadas e escopo por workspace.
4. Definir integrações Chatwoot/WAHA, handoff humano, limites, opt-out e idempotência antes de qualquer mensagem automática.
5. Só então liberar por workspace e acompanhar métricas.

Este documento é uma nota de implantação e não substitui nem altera arquivos do Brain local `/Users/gui_t/Figueira_Marketing/brain`. Sincronizar de forma aditiva quando houver acesso autorizado.
