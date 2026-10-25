# Inbox — atendimentos independentes por canal (25/10/2026)

## Escopo
Corrigir a última duplicidade funcional: o mesmo contato falando com dois WhatsApps deve ter atendimentos **separados**, com responsável, status, prioridade, SLA, etiquetas e auditoria por número de entrada. O fluxo legado permanece disponível com metadados existentes.

- Mantém `crm_atendimentos` e `crm_auditoria_atendimentos` históricos.
- Cria `crm_atendimentos_canais` com PK `(conta_id,telefone,canal_id)`, RLS sem acesso do navegador, FK e trigger contra cruzamento de workspaces.
- Adiciona `canal_id` opcional à auditoria, sem modificar eventos anteriores. Trigger no novo atendimento registra criação, transferência, status, prioridade, etiqueta e SLA.
- Remoção de etiqueta considera as duas tabelas de atendimento e oportunidades atomicamente.
- API da Inbox agrupa cada `telefone + canal` e retorna metadados próprios. O grupo legado corresponde a `canal_id=0` no navegador e `NULL` no banco. Operador só acessa sua ficha atribuída.
- PATCH e auditoria exigem o canal correspondente à mensagem efetivamente recebida nesta workspace e aplicam ações somente na ficha daquele canal.
- Detalhe e timeline do canal conhecido filtram os eventos recebidos e mensagens enviadas vinculadas por `historico_contato.canal_id`; não atribuem mensagens históricas sem identidade.
- A interface não altera automaticamente a conexão WAHA nem o funil; o atendente escolhe a ficha de destino. O Chatwoot opcional permanece limitado ao atendimento legado, até que sua integração tenha identidade por canal.
- Registros legados não são duplicados ou migrados automaticamente. Não usar telefone puro para adivinhar canal ou atribuir responsável.

## Verificações
- Executar CI no PR (unitários, tsc, build Next).
- Aplicar SQL 043 antes da imagem em produção. Conferir linhas históricas e que a nova tabela está vazia.
- Alterar somente a imagem `harvest_harvest`. Manter imagem anterior para rollback.
- Smoke de login e rotas protegidas, sem enviar mensagens para destinatários.
- Ainda requer QA autenticado e evento real em dois números para homologação funcional completa.

## Próxima etapa
Definir opção explícita por funil para **criação automática de oportunidades** em mensagens novas, com deduplicação por conversa/canal e consentimento. Manter desligada por padrão até validar webhook real; não inferir destinos quando o canal é compartilhado por vários funis.
