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

## Ajuste posterior: compartilhamento da LLM de Configurações (PR #10)
- Solicitação do responsável: agentes devem reutilizar a conexão de ferramentas/LLM existente em Configurações, sem duplicar cadastros.
- A configuração de IA é **por workspace** em `conta_credenciais` (`ia_provedor`, `ia_modelo`, `ia_key`).
- O laboratório dos agentes consulta esses campos em tempo real via `lib/conexaoIAWorkspace.ts`. A API do painel envia apenas `configurada/provedor/modelo`, nunca a chave.
- O painel apresenta o estado da conexão, link para Configurações e desativa teste quando não há uma LLM configurada.
- Verificação SQL de produção: 3 workspaces com chave de IA, e a workspace `figueira-marketing` ainda sem provedor/chave. **Não copiar credenciais de clientes para a agência.**
- CI do PR #10 validado (testes de provedor, tipo, privacidade, TypeScript e build). Merge `20f961ee0478b80e5f19aa053609185568ef11c4`.
- Docker Swarm atualizado sem staging, imagem `ghcr.io/tuco-gui/harvest-ai:latest@sha256:3968e0da4d7e7fdac807e824f653a60c33f969cc872fead134061f327b8c1d0b`; serviço running, sem erro.
- Smoke test anônimo no serviço: `GET /entrar = 200`, `GET /agentes = 307`, `GET /api/agentes = 307` e `GET /api/agentes/testar = 307`. O usuário sem login continua bloqueado; teste autenticado real e saída de LLM permanecem pendentes até configuração da Figueira.
- Não houve SQL migration nem alteração de campanha, usuário, segredo, integrações ou permissões comerciais.

## Incremento de continuidade — PR #11 (mesmo dia)
- PR #11 implementou **conversas de múltiplas mensagens** no laboratório, por tipo de agente. O histórico fica somente na memória da interface e contém no máximo dez mensagens anteriores, alternadas e validadas no servidor. Nenhum dado da simulação é persistido em banco.
- Adicionado botão **Nova conversa** e **Copiar para atendimento humano**. Copiar transcrição não cria chamado nem envia WhatsApp.
- Configurações recebeu o botão **Salvar somente conexão de IA**, via `POST /api/configuracoes/ia`, que atualiza apenas campos de IA da workspace derivada da sessão (`ia_provedor`, `ia_modelo`, `ia_key` quando preenchido), sem tocar parâmetros de campanha ou WhatsApp. Uma mudança de provedor exige chave correspondente para não reutilizar token incompatível.
- A mesma conexão de IA continua sendo usada pelos agentes e pelo modo de prospecção. Não há duplicação de segredo, nem migração de banco.
- Testes e build do PR #11 passaram em GitHub Actions `40193901925`. Merge `17b8c14346f89eeddda006a1a13807d1521820f0`.
- Publicação da imagem `40194019580` foi aprovada; serviço Swarm atualizado apenas na produção para `ghcr.io/tuco-gui/harvest-ai:latest@sha256:9391d944dc080f27e7ebdefdb76dff3049f47fddb06ded6d52d2b88a449fb660`, tarefa **running**, sem erro.
- Smoke de rotas sem sessão dentro do container: `GET /entrar = 200`; `GET /agentes = 307`, `GET /api/agentes = 307`, `GET /api/agentes/testar = 307`; `POST /api/configuracoes/ia = 307`, isto é, sem autenticação os novos recursos não ficam acessíveis.
- **Pendência funcional:** não houve teste real autenticado de geração com LLM na Figueira, porque a workspace ainda não possui chave/provedor de IA. Configurar a conexão em `Configurações > Inteligência Artificial` e testar no laboratório. Não buscar nem copiar segredos de workspaces de clientes.
- Não houve staging, alteração de campanhas, disparo de mensagens ou ativação automática de agentes. O Brain local do Mac continua não sincronizado diretamente.
