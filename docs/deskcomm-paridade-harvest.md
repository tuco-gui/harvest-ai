# Migração Harvest ↔ DeskcommCRM — contrato de execução

Missão: trazer a experiência e as funcionalidades do DeskcommCRM para o Harvest com paridade funcional, reutilizando e adaptando seu código MIT. Preservar Harvest em produção e migrar por módulos; não substituir dados/workspaces por uma instalação vazia. O nome e marca ao cliente continuam Harvest/Figueira. Uma correção prioritária não encerra esta missão.

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

## Incrementos de catálogo — 27/10/2026

- Já entregues: importação CSV com atualização por SKU/nome (`1711e77`) e retirada lógica com reativação (`5e5e7f7`).
- Incremento seguinte: busca por nome/SKU no servidor, paginação de 50 produtos, contagem total e filtro de ativos/retirados. A busca alcança produtos além dos 250 anteriormente carregados no navegador.
- Referência funcional: DeskcommCRM `f13d26f6b00d65730f101e92fac50e3205b97211`, arquivos `app/api/v1/products/route.ts` e `lib/catalogo/busca-da-tela.ts`. Implementação própria adaptada às tabelas, permissões e `conta_id` Harvest; sem cópia de schema.
- API: `GET /api/crm/cadastros/produtos?pagina=1&busca=termo&estado=todos`. Estados aceitos: `todos`, `ativos`, `inativos`. Retorna `registros`, `limite` e `meta` (`pagina`, `por_pagina`, `total`, `tem_mais`). Parâmetros inválidos retornam 400. Página além do fim retorna lista vazia com contagem real. Sem parâmetros, mantém o contrato anterior de até 250 registros.
- UI: debounce de busca, cancelamento de respostas obsoletas, retorno à primeira página ao filtrar e ajuste para a última página existente após alterações no catálogo.
- SQL: nenhuma alteração. Reversão: restaurar a imagem anterior; nenhum dado precisa ser revertido.
- Verificação automatizada: `tests/unit/crm-catalogo-busca.test.ts` (validação e escape do filtro) e `tests/unit/crm-catalogo-rota.test.ts` (handler real com banco simulado: 301 produtos, outro tenant, busca após o limite anterior, filtros, paginação, contrato legado, autorização e indisponibilidade do banco). O teste de rota não substitui validação autenticada de UI em produção.
- Resultado local: 38 arquivos de testes unitários aprovados, `tsc --noEmit` e `npm run build` aprovados. O helper `crmCatalogoBusca.ts` atingiu 100% de linhas, ramos e funções no relatório de cobertura Node; essa medida é do helper, não da aplicação inteira. Incremento implementado na branch `feat/deskcomm-catalogo-paginado`; produção permanece no deploy validado de `88a2995`.
- Publicação: PR #41 integrado em `48888fd`; deploy automático `40592089743` concluído com sucesso.

## Fonte local e inventário real — 27/10/2026

Clone: `~/projects/DeskcommCRM`, `main` em `f13d26f6b00d65730f101e92fac50e3205b97211`, árvore limpa. O checkout Git parcial foi completado com o arquivo oficial do mesmo commit, após falhas de transporte do clone. `LICENSE`, `AGENTS.md` e `CLAUDE.md` lidos; a licença está preservada em `THIRD_PARTY_NOTICES.md`.

Estados abaixo comparam caminhos reais, não equivalência presumida por nome de módulo. **Parcial** não significa paridade concluída.

| Superfície Deskcomm (`app/app/`) | Implementação Harvest | Estado / diferenças ainda abertas |
|---|---|---|
| `inbox/`, `components/inbox/CRMSidePanel.tsx`, `lib/channels/zernio/ingest.ts` | `CentralAtendimentosCrm`, `ConversaExternaDetalheCRM`, rotas `crm/conversas-externas` | Parcial: integração social→negócio→contato implementada nesta rodada; faltam equivalência de mídia, citações, reações, filas, demandas e tempo real |
| `pipelines/`, `kanban/`, `leads/`, `crm/` | `CrmPipeline`, `FunilDetalhe`, `api/funis`, `api/crm/oportunidades` | Parcial: quadro, etapas, responsáveis, etiquetas e campos existem; faltam operações avançadas e equivalência da ficha/painel lateral |
| `contacts/`, `people/`, `companies/` | `crm/contatos`, `CadastrosCRM`, `crm_empresas`, `crm_contatos` | Parcial: identidade social agora usa vínculo explícito, sem empresa inferida; fusão auditada e customer 360 completo pendentes |
| `products/`, `lib/catalogo/` | `crm/cadastros/produtos` | CRUD, CSV, retirada/reativação, busca e paginação entregues; fotos, categorias/marcas e propostas ainda pendentes |
| `tasks/`, `activities/` | `crm/tarefas`, `crm_atividades`, timeline e tarefas na Inbox | Parcial: mesmo formulário/lista da central reutilizados no atendimento social e WhatsApp; faltam demandas independentes e atribuição de tarefa separada do dono do negócio |
| `agenda/`, `lib/agenda/` | `crm/agenda`, `api/crm/agenda`, conversão de fuso portada do Deskcomm | Grade mensal de atividades com links/fuso; disponibilidade, serviços, reservas, recorrência e Google Calendar/Meet pendentes |
| `pipelines/` + `lib/automation/` | `lib/automacoes.ts`, `lib/eventos.ts`, editor de automações | Parcial: regras por evento existem; editor/motor completos, gatilhos temporais, reexecução e trilha por execução pendentes |
| `ai/`, `lib/agent-engine/`, `lib/ai/` | `agentes`, `lib/agentes.ts`, `lib/ia.ts` | Parcial: preservar agentes atuais; RAG, versões publicadas, fila de turnos, orçamento, ferramentas e handoff completo pendentes |
| `connections/`, `integrations/`, `settings/`, `team/` | `configuracoes`, `IntegracoesCRM`, `equipe`, `usuarios`, workspaces | Parcial: WhatsApp, Meta e Zernio existentes preservados; comparar preferências, RBAC/MFA e todas as conexões |
| `metrics/`, `analise/`, `ads/`, `radar/` | Métricas no CRM e status Harvest | Dashboards/custos/atribuição e radar equivalentes pendentes |
| `campaigns/`, `prospecting/`, `imports/`, `templates/` | `campanhas`, `Prospeccao`, importações e IA Harvest | Diferencial protegido; complementar o que Deskcomm oferece, sem remover os fluxos existentes |
| `proposals/`, `comandas/`, `faturamento/`, `honorarios/` | Itens de oportunidades | Propostas PDF, pedidos/comandas e operação financeira não migrados |
| `lgpd/`, `audit/`, `calls/`, `webhooks/`, `extensions/`, `integracao-dados/` | Proteções/opt-out, histórico e webhooks existentes | LGPD completa, auditoria unificada, chamadas, extensões, integrações de dados e demais capacidades não demonstradas como equivalentes |

## Prioridade do vídeo: atendimento social e oportunidade #26

- Causa comprovada: `crm_vinculos_conversa_negocio` já ligava #26 à conversa `d502d1b8-cae2-4712-8b84-d77eb542ee1f`; a API/UI da ficha lia apenas WhatsApp e exigia telefone. `empresa_id` era NULL: o texto do perfil estava no campo legado de título `empresa`, não em um cadastro `crm_empresas`.
- Referência funcional real: `lib/channels/zernio/ingest.ts` (identidade social/contato/conversa) e `components/inbox/CRMSidePanel.tsx` + `tests/unit/inbox-abrir-no-funil.test.tsx` (navegação por IDs, não nome).
- Implementação: a ficha reutiliza os handlers/componente de conversa externa; mesmo histórico, mesma autorização por workspace/atendente, mesma janela de 24h e chave de idempotência. Instagram e Messenger respondem pela conta de origem, sem telefone e sem fallback silencioso para WhatsApp. Timeline inclui as mensagens sociais; links permitem ir entre Inbox, negócio e contato.
- SQL `051_contatos_atendimentos_sociais.sql`: contato ancorado na identidade da conversa/fonte; FK composta impede vínculo entre tenants; contato e oportunidade criados sob trava transacional; configuração `criar_lead_automatico` respeitada; novos negócios sociais têm `empresa=''`, `empresa_id=NULL` e `telefone=NULL`.
- Histórico: backfill só preenche vínculos de contato ausentes. Não cria negócios retroativos, não altera nomes/títulos antigos, não mescla por nome e não apaga mensagens. Três conversas históricas ficaram com contato; #26 e seu atendimento compartilham contato #11, preservando a mensagem já existente.
- Backup anterior na VPS: `/root/backups/harvest-pre051-20261027.dump`, SHA-256 `18291fc19da353c17be5fc0054e17e503d97ff9b3876a8f357d9652ff3667574`. Arquivo lido integralmente por `pg_restore --file=/dev/null`; definição anterior da RPC em `harvest-pre051-funcao-20261027.sql`. Isto valida a leitura do arquivo, não uma recuperação completa em servidor separado.
- Regressão PostgreSQL real: `scripts/test-crm-social-sql.mjs` aplica migração + cenários em uma transação e termina em ROLLBACK. Cenários: sem inbound, sem telefone, sem empresa, reentrega idempotente, configuração desativada, homônimos distintos e fronteira de tenant. Migração aplicada depois do teste.
- Jornada autenticada local sobre dados existentes: `scripts/verify-crm-social-browser.mjs --local` aprovou histórico #26, timeline, contato, composer Instagram habilitado sem telefone e navegação até a Inbox. Envio interceptado no navegador; nenhuma mensagem de teste foi enviada ao cliente. Sessão temporária encerrada, credenciais só em memória.
- Rollback de app: imagem anterior. O schema aditivo pode permanecer; para restaurar a regra anterior, reaplicar a definição da RPC salva no backup. Não excluir contatos/vínculos já criados.
- Publicação: PR #42 integrado em `226cf62`, deploy automático `40594297761` concluído. Jornada autenticada repetida em produção aprovou a ficha #26, histórico, contato, composer sem telefone e navegação. A confirmação de entrega de uma resposta real pelo provedor continua não exercitada por estes testes interceptados.

## Continuação: tarefas no atendimento e agenda

- Código real reutilizado/adaptado: `lib/agenda/fuso.ts` (conversão de hora de parede, offset e política DST) e `lib/agenda/recorte-da-grade.ts` (mesmo período de 42 dias para grade e consulta), Deskcomm `f13d26f6`. Copyright e licença preservados no código, no repositório e na imagem Docker via `app/THIRD_PARTY_NOTICES.md`.
- Jornada de tarefas segue `components/inbox/TarefasDaDemanda.tsx`: criar/editar/concluir/reabrir pela conversa com os mesmos controles da central. No Harvest, o vínculo é com o negócio explícito do atendimento (não uma tabela de demandas ainda inexistente). API filtra `oportunidade_id` antes do limite, com permissão por workspace e dono; não carrega 500 negócios para depois procurar o selecionado no cliente.
- `crm/agenda`: visão mensal de tarefas, reuniões, ligações e e-mails com prazo, dias adjacentes incluídos, filtro de concluídas, seleção de dia, navegação de mês e seleção de fuso. Consulta servidor filtra tenant tanto na atividade quanto na oportunidade e filtra dono para operador. Limite de 1.000 registros por grade é declarado na resposta e avisado na UI quando atingido.
- Não introduz calendário vazio separado nem copia atividades: usa `crm_atividades` existentes. Sem SQL novo e sem serviços pagos adicionais. Marca e navegação Harvest mantidas.
- Testes `crm-agenda.test.ts` e `crm-agenda-rota.test.ts`: grade/consulta consistentes, mudança de ano, dia/mês no fuso local, DST América/Beirute, autorização, filtros no banco, dois tenants e falha de banco.
- Playwright autenticado local `scripts/verify-crm-social-browser.mjs --local --agenda`: tarefa criada pela Inbox #26, comprovada na consulta e na grade da agenda, 42 células e mudança para America/Chicago verificadas. Só os registros gerados pelo próprio teste foram removidos; nenhum histórico de cliente foi excluído.
- **Paridade integral continua pendente** nas linhas marcadas acima. Esta entrega não declara migração de disponibilidade, Google/Meet, propostas, financeiro, extensões ou runtime completo de agentes/automação.
