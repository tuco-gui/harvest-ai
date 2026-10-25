# Harvest — correções de UX Kommo e arquitetura de canais (25/10/2026)

## Problema e decisão do produto
A solicitação é seguir **a localização e o fluxo de uso do Kommo**, não criar módulos extras ou mais lugares para a mesma coisa. Harvest continua o produto principal, e o DeskcommCRM permanece referência técnica MIT; não copiar código proprietário do Kommo.

Documentação Kommo, verificada:
- https://support.kommo.com/docs/pt-br/manage-tags-in-kommo — na ficha apenas #ADICIONAR TAGS junto ao nome; gerenciar em Pipelines → Buscar e filtrar → Tags → Gerenciar, com cores/contagens; aplicação a múltiplos registros é outra ação.
- https://support.kommo.com/docs/pt-br/new-left-menu — Comunicação concentra chats; Pipelines contém funis/edição; Listas contém pessoas e empresas.
- https://support.google.com/business/answer/14919056?hl=en — Google Business Messages/GBP Chat descontinuado em 31/07/2024.

## Entregue no PR #21
- **Uma única Comunicação/Inbox:** `/inbox` hospeda a central avançada na workspace com `crm_avancado`, com SLA, prioridade, responsável, histórico e transferência; `/crm/atendimentos` vira alias de redirecionamento, incluindo deep link de telefone. Workspaces sem módulo permanecem na Inbox original.
- **Resposta pelo WhatsApp existente:** na Inbox consolidada, com canal WAHA/Evolution conectado e oportunidade correspondente, envia por `/api/crm/oportunidades/[id]/mensagens`; mantém opt-out, escopo, ambiente, registro de tentativas e auditoria da rota existente. Não ativa disparo automático. Sem negócio, administrador pode criá-lo explicitamente a partir da conversa; operador sem permissão não cria.
- **Uma entrada Contatos:** `/crm/contatos` é o cadastro canônico para admin, mais seção de contatos dos negócios ainda não conciliados; não faz merge por telefone/nome automaticamente. Operador mantém leitura dos seus contatos derivados sem novo acesso administrativo. `/crm/cadastros/contatos` redireciona ao cadastro canônico.
- **Tags:** na oportunidade, o seletor fica junto ao nome e autosalva a mudança; gerenciamento de catálogo só dentro de `Buscar e filtrar → Tags → Gerenciar` no pipeline. Multisseleção, modo E/OU e contagens por funil. Cores em cards Kanban e linhas de lista. Ficha de criação ainda salva ao clicar Criar oportunidade; workspaces sem `crm_avancado` conservam campo antigo.
- **Funil:** lista/indicadores filtram pelo funil escolhido, oportunidades novas recebem `funil_id`; etapas configuradas no funil podem ser usadas para criação e movimentação e são validadas contra a workspace, sem busca por etapas globais de outros clientes. Registros legados sem funil ficam visíveis no primeiro funil para conferência. Edição do funil e campos em menu ··· dentro do pipeline, não na lateral.
- **Contrato multicanal:** `app/src/lib/canaisUnificados.ts` contém IDs de canal, identificadores externos e isolamento por workspace/conexão. Os conectores Instagram Direct, Messenger, webchat, WhatsApp Cloud API e avaliações do Google estão **planejados e NÃO conectados**. O antigo Google Business Messages é indisponível (encerrado). As possibilidades aparecem com estado real em Configurações → Conexões, sem falsa mensagem de funcionamento.
- Motor de IA é separado do canal: um canal recebe mensagem, um agente/LLM propõe resposta, uma política autoriza e o adaptador envia. Chatwoot permanece integração opcional oculta em `details`, não é núcleo do inbox.
- Testes de contrato dos canais foram adicionados ao workflow; TypeScript/Next CI obrigatório.

## Limites/pontos ainda não completos
- Sem conectores funcionais Instagram, Messenger, API oficial Meta, webchat nem interface de resposta a avaliações Google nesta entrega. Implementá-los exige OAuth/permissões/webhooks verificados e regras de consentimento individuais.
- Mensagem WhatsApp originada de conversa sem negócio precisa que o operador autorizado associe/crie oportunidade antes de responder; nenhum disparo automático ou merge de identidade foi habilitado.
- Sem importação ou mesclagem automática de contatos; registros legados são apresentados para reconciliação humana.
- Sem testes E2E autenticados feitos diretamente no browser. Não declarar equivalência visual pixel a pixel sem comparação com gravação/sessão Kommo e QA manual.
- Revisar regra de várias etiquetas em lote aplicado sobre vários negócios antes de chamá-la de equivalência total.
- Nenhum novo banco nem migração SQL nesta branch. Preservar Portainer, Twenty, Chatwoot, WAHA, Supabase e dados existentes.

## Portas de qualidade e rollback
Validar CI do PR e build Next no GitHub; publicar imagem fora da VPS; atualizar somente a imagem do serviço `harvest_harvest`, sem recriar stack. Smoke interno autenticidade/login e inspecionar tarefa running. QA funcional na workspace `figueira-marketing` continua necessário para confirmar telas; caso falhe, restaurar imagem anterior do Swarm, sem remover SQL 040 já aplicado.
