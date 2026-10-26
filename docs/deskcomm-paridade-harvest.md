# Migração Harvest ↔ DeskcommCRM — contrato de execução

Decisão: preservar Harvest em produção e implementar paridade DeskcommCRM por módulos, sem trocar o banco/rotas num único deploy. O destino pode adotar o DeskcommCRM como núcleo apenas após migração integral e validação, mantendo as funcionalidades de prospecção do Harvest. O nome e marca ao cliente continuam Harvest.

## Fontes inspecionadas em 26/10/2026

- Base open source: https://github.com/melgarafael/DeskcommCRM (MIT, copyright Rafael Melgaço, 2026; preservar licença nos trechos copiados).
- Harvest: https://github.com/tuco-gui/harvest-ai.
- Deskcomm usa Next.js 16, Supabase e tabelas `organizations`/`channel_sessions`, Harvest usa Next.js 15, `contas`/`crm_fontes_funil`, além de `oportunidades` e prospecção.

## Regra operacional, não negociável

1. Nenhuma cópia direta de schema ou páginas do Deskcomm em `main` sem adaptação a autenticação, `conta_id`, permissões e rotas Harvest.
2. Criar e testar módulos em branch/PR, imagem externa à VPS, migrações SQL reversíveis e backup conferido.
3. Proteger dados, clientes, campanhas e integrações que já funcionam. Novas fontes sociais devem manter múltiplas contas por workspace, webhook validado e opção de gerar lead.
4. Prospecção Harvest — pesquisa, importação, validação de WhatsApp, campanhas, abordagem, ritmo, histórico, agentes IA e acompanhamento — é funcionalidade protegida; não substituir pela versão Deskcomm sem migração validada.
5. Nunca copiar segredos entre repositórios ou incluí-los na imagem. Preservar `zernio_key` e `harvest_meta_app_secret` como Docker Secrets.
6. Quando funcionalidade Deskcomm depender de Zernio, Apify, WAHA Plus, Upstash, Sentry ou outro serviço, documentar custo e disponibilidade antes de ligar para clientes.
7. UI deve usar a marca Harvest e ocultar fornecedores na jornada comercial; telas externas oficiais de OAuth permanecem no fornecedor.

## Blocos da paridade e critérios de aceite

| Bloco | Referência Deskcomm | Estado Harvest hoje | Aceite mínimo |
| --- | --- | --- | --- |
| Workspace, usuários, papéis, MFA, auditoria | `lib/auth/`, `app/admin/` | possui `contas`, `perfis`, autenticação | migração de contas sem cruzar tenants e controle granular |
| CRM/funis/kanban | `app/app/`, `components/` | estágios e oportunidades já existem | todas as operações Kommo-like, etiquetas, campos, empresas, produtos, filtros e históricos |
| Inbox omnicanal | `components/inbox/`, `lib/channels/` | Inbox CRM e conversas externas existem | mensagem recebida / enviada real, mídia, atribuição, SLA, histórico, opt-out, encaminhamento |
| Redes sociais | `lib/channels/social/` | Zernio iniciado e funcionando em teste | selecionar entre todas as contas, adicionar/excluir fonte dentro do funil, dedupe, assinatura, reconexão |
| WhatsApp | `lib/channels/adapters/` | WAHA/Evolution já conectados | preservar números e funções, testar envio/recebimento, templates e anexos |
| Agentes IA | `lib/ai/` | agentes Harvest | criação, teste, roteamento, handoff humano, controle de custo, fila, aprovações |
| Atividades/agenda | `lib/agenda/` | parcial | tarefas, eventos, responsáveis, alertas e vínculos a negócio |
| Automação/fluxos | `lib/automation/` | parcial | gatilhos, dedupe, reexecução, trilha auditável |
| Produtos/serviços/catálogos | `app/app/products/` | cadastro CRM inicial | CRUD, importação, preços, vínculo em oportunidades |
| Relatórios, dashboards e custos | `lib/metrics/`, `app/app/ads/` | relatórios Harvest | funil, canais, campanha, agentes, ROI, segmentação por workspace |
| Prospecção | `app/(app)/prospeccao` Harvest | diferencial principal | tudo que existe hoje continua funcionando, com lead bidirecional para CRM |
| Operação SaaS e segurança | `lib/api/`, `lib/legal/` | parcial | cobrança/permissões, observabilidade, backups e recuperação testados |

## Sequência de entrega

1. **Gate 0: estado e rollback** — registrar tag de imagem, backup DB com restore simulado, rotas principais e tráfego Zernio.
2. **Gate 1: social e funil** — selecionar contas, conectar/remover fontes, primeiro inbound gera oportunidade, teste real Instagram/Messenger, um único tenant por canal.
3. **Gate 2: CRM/Inbox** — comparar comportamento tela a tela com Deskcomm; integrar os componentes e APIs equivalentes com adaptadores `conta_id`; sem alterar a identidade visual.
4. **Gate 3: agentes/automação/agenda/produtos** — portar cada capacidade após testes de integração e UX.
5. **Gate 4: analytics, administração, segurança e operação** — observabilidade, LGPD, limites, isolamento e testes E2E.
6. **Gate 5: cutover opcional** — somente após equivalência comprovada, avaliar trocar o núcleo para Deskcomm em staging; não fazer big-bang em produção.

## Auditoria e publicação

- Para cada módulo, anexar ao PR: origem exata/commit Deskcomm; arquivos Harvest alterados; SQL; licença se trecho substancial copiado; testes; screenshot/filme da jornada; aprovação do pipeline; rollback.
- Não declarar “clonado” até todos os blocos estarem demonstrados em ambiente autenticado e os critérios de aceite estarem verdes.
- **Estado deste documento:** inventário e contrato de migração. Não comprova paridade nem autoriza deploy por si só.
