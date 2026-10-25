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
