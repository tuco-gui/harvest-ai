# Harvest CRM — avanço funcional Deskcomm + experiência Kommo (25/10/2026)

## Decisão de produto
O Harvest continua sendo a aplicação única de produção em `harvest.figueiramarketing.com.br`. **Sem staging separado.** O objetivo não é instalar o DeskcommCRM inteiro, nem copiar recursos proprietários do Kommo; é portar os fluxos funcionais viáveis ao código Harvest, preservando dados, permissões e integrações existentes.

Referências:
- Open source [DeskcommCRM](https://github.com/melgarafael/DeskcommCRM), licença MIT, com recursos de funis, tarefas, contatos, inbox e agentes.
- UX de CRM conversacional de negócios no estilo Kommo, reimplementada com marca própria Harvest/Figueira.
- Piloto do vendor Deskcomm no PR #7 **permanece separado e não foi mesclado** (este PR impõe staging que conflita com a decisão atual de workspace piloto na produção).

## Entregas feitas
### PR #12 — Tarefas + Kanban
- Central `/crm/tarefas` com filtros por situação/prazo, busca, responsável, criação de tarefa vinculada a negócio e conclusão/reabertura.
- Dados em `crm_atividades` (sem tabela paralela), com `conta_id` herdado da sessão e validação da oportunidade por workspace e owner.
- Experiência visual de funil mais densa, com cartões, cabeçalhos e barras das etapas. Design original com marca Harvest.
- Links diretos de tarefas para oportunidades do pipeline.
- Código gateado pelo módulo `crm_avancado` em conjunto com `crm`.
- Migração 035 idempotente: `UPDATE 1` somente para `contas.slug='figueira-marketing'`.
- Auditoria após SQL: **1 workspace habilitada, 1 Figueira, 0 outras**.
- Testes e build CI passaram, imagem publicada e deploy Swarm feito sem reconstruir na VPS.
- Anônimo não acessa `/crm`, `/crm/tarefas`, `/api/crm/tarefas`. Ainda falta teste interativo autenticado de uma tarefa real.

### PR #13 — Contatos
- Central `/crm/contatos`, com busca por nome, empresa, telefone, e-mail e etiquetas; filtro por owner; números de contatos e negócios associados.
- Contatos derivados de oportunidades existentes. Mesmo nome+identificador pode agrupar negócios; nomes diferentes com mesmo telefone/e-mail são apenas sinalizados como **possíveis duplicados**. **Não há merge e não se altera banco**.
- Links para abrir cada oportunidade, separação por workspace e operador.
- Testes de agrupamento conservador, busca e duplicidade sem escrita.
- Sem migração SQL.

## Segurança
- Todas as novas superfícies exigem sessão, módulo `crm` + `crm_avancado`, workspace ativa e, para operadores, ownership dos negócios.
- Nenhum backend de terceiro entrou na mesma base; nenhuma chave de IA foi modificada.
- Nenhum disparo WhatsApp, webhook, cobrança ou automação foi ativado.

## Próximos passos funcionais priorizados
1. **Timeline unificada do negócio:** anotações, WhatsApp recebido/enviado e atividades ordenadas com autoria.
2. **Inbox vinculada ao CRM:** painel de contatos/conversas, atribuição, etiquetas, resolvido/reaberto, handoff humano; preservar fonte atual e opt-out.
3. **Gestão de tarefas avançada:** atribuição explícita, editar/excluir, calendário, lembretes operacionais e automação segura com autorização.
4. **Kanban operacional:** seleção múltipla, atribuição em lote, reordenação real, relatórios e visão por funil; manter RLS/tenant.
5. **Cadastros de contatos independentes:** importação, deduplicação revisada e relacionamento N:N com empresas, sem merge automático.
6. **Integração Deskcomm de funcionalidades adicionais:** reaproveitar apenas partes compatíveis com as regras de licenciamento, validação e operação do Harvest. Não mesclar PR #7 sem rever o gate.

**Pendências de QA:** navegar em `/crm`, `/crm/tarefas` e `/crm/contatos` autenticado como superadmin, registrar uma tarefa não sensível, testar concluir/reabrir, abrir negócio, validar visibilidade bloqueada em workspace de cliente. Testar manualmente em Figueira Marketing, nunca em clientes.

Brain local do Mac não foi sincronizado diretamente; este markdown é handoff aditivo.

## Continuidade CRM — PRs #14 e #15

### PR #14 — Timeline unificada + Inbox
- **Histórico completo** na ficha da oportunidade (terceira aba): atividades, notas e tarefas do `crm_atividades`; mensagens de `prospecta_mensagens` e `inbound_eventos`.
- A API `GET /api/crm/oportunidades/[id]/timeline` é somente leitura, retorna até 250 itens (limitados a 150 por fonte na consulta), exige os módulos `crm` e `crm_avancado` e filtra pelo `conta_id` da sessão e `owner_id` para operadores.
- Deduplicação visual de envio WhatsApp quando duplicado como atividade, por texto e janela de cinco minutos (não apaga registros).
- Filtro de toda a timeline, mensagens ou atividades; atalho do histórico para `/inbox?telefone=...`, abrindo uma conversa somente se o telefone já estiver na lista da Inbox da workspace.
- Segurança corrigida no código legado: acesso por `owner_id` também em `GET /api/crm/oportunidades/[id]` e `GET/POST/PATCH /api/crm/oportunidades/[id]/atividades`.
- Build e testes aprovados pelo GitHub Actions; merge `80269d02f0f0d21b13cf52af03ca2346b77bc1b2`.
- Imagem publicada e deploy Swarm confirmado `running` com `sha256:0a42221ab871b26a8887830b7a394164112158419d3596676ac0a06690021afe`.
- Rotas sem sessão verificadas: login 200; CRM, Inbox e API de timeline 307 redirecionando para login.

### PR #15 — Editar, reagendar e excluir tarefas
- `PUT /api/crm/tarefas`: muda título, descrição e prazo sem transferir a tarefa de negócio; `DELETE /api/crm/tarefas`: exclui a tarefa específica, após confirmação de UI.
- Atribuição e titularidade verificadas a cada ação no banco com escopo por `conta_id`/oportunidade e `owner_id` para operadores.
- Formulário da central de tarefas reutilizado para criação e edição; conversão do fuso horário no `datetime-local`, botões por item.
- Testes automatizados (incluindo local time) e TypeScript/build aprovados; merge `e2db8d8010ce2016507a2a4d2ae4b80288d328cf`.
- Imagem CI e atualização da VPS: verificar status e digest antes de dar como publicado. A nova versão não exige SQL.
- Recursos continuam restritos à workspace `figueira-marketing` pelo módulo `crm_avancado` e não acionam WAHA, WhatsApp nem LLM.

### Próximo passo
- Testes autenticados reais em workspace Figueira Marketing, inclusive contraste com workspace de cliente (não alterar nenhuma conta).
- Inbox CRM com triagem, tags, atribuição e handoff humano; manter a fonte real de mensagens, opt-outs e controle de papéis.
- Tarefas com atribuição independente da oportunidade, calendário e alertas, somente após desenho de migração aditiva.
