# Registro de implantação — Agentes Harvest AI

**Data:** 2026-10-25
**Escopo:** Figueira institucional / Harvest de produção, `harvest.figueiramarketing.com.br`
**Referência canônica da decisão:** `docs/decisoes/ADR-012-agentes-workspace-harvest.md`

## Realizado e verificado
- PR #9 incorporado à `main` via squash `e3f17f58b9f7592f45e53a119386981c39b6dd01`.
- CI `40190470775`: testes unitários, TypeScript e build Next.js passaram.
- GitHub Actions `40190676699`: publicação da imagem GHCR concluída com sucesso.
- A stack Swarm `harvest_harvest` recebeu atualização forçada usando `PullImage=true`, sem reconstruir na VPS.
- Imagem efetiva: `ghcr.io/tuco-gui/harvest-ai:latest@sha256:204b1ef2839526dc5d2ea00d3331fd3d81e72c9d3fe83826d7d024f8f9af170a`.
- Estado do serviço: tarefa desejada `running`, tarefa efetiva `running`, sem erro.
- Migrações `sql/033` e `sql/034` aplicadas em transações Postgres; schema de agentes criado com RLS.
- Auditoria SQL pós-migração: 5 agentes, 0 ativos, apenas 1 conta com flag `agentes`, 0 agentes fora de Figueira Marketing.
- Smoke test sem autenticação feito no processo Next.js via hostname interno: `GET /agentes` retornou HTTP 307 para `/entrar`, confirmando que não ficou publicamente acessível.

## Dependência externa verificada
- A workspace `figueira-marketing` existe, mas não tem `conta_credenciais.ia_key` nem `ia_provedor` preenchidos (verificados só como booleanos, sem exposição de segredo).
- Logo, a UI e a persistência estão implantadas, mas a simulação com modelo de IA real retornará aviso de configuração até que seja vinculada uma chave institucional.
- **Nenhuma mensagem WhatsApp ou automação do CRM é gerada pelos agentes nesta entrega.**

## Como utilizar
1. Fazer login no Harvest real com o superadmin.
2. No seletor de workspace, escolher **Figueira Marketing**.
3. No menu lateral, clicar em **Agentes de IA**.
4. Editar instruções, salvar cada agente; para testar IA real, configurar antes um provedor/chave institucional em **Configurações**.
5. Depois dos testes funcionais, definir regras de orquestração, handoff humano, opt-out, permissões de ferramentas e integrações Deskcomm/WhatsApp.

## Proteção e pendências
Não usar staging. Não liberar o módulo para as demais empresas até homologação. Pilotagem Deskcomm no PR #7 não foi incorporada a esta versão. Nenhum dado pessoal de cliente foi copiado para testes.
O Brain local do Mac não foi editado diretamente; esta nota é um handoff aditivo para sincronização posterior no Obsidian. Evitar sobrescrever versões históricas.
