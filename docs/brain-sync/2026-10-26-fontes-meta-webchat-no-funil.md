# Fontes de lead do Kommo no Harvest — 26/10/2026

## Localização obrigatória
No Harvest CRM avançado: **Pipelines → selecionar funil → ⋯ → Editar pipeline e fontes de lead**. Na lateral ESQUERDA da configuração das etapas aparece `Fontes de lead`, o botão `Adicionar fonte` e a grade de conectores. Nenhum menu CRM concorrente foi criado.

## Implementação
- **WhatsApp WAHA / Evolution**: preservados. Gerenciamento de números permanece no fluxo de conexões existente, selecionáveis no próprio funil.
- **Webchat**: novo canal operacional, fonte própria dentro do funil e código `<iframe>` para incorporação no site. Visitante envia e acompanha mensagens sem login no Harvest; uma sessão aleatória privada do navegador autentica o histórico. O operador autorizado responde na Inbox EXISTENTE. Nenhuma mensagem sai para WhatsApp.
- **Instagram Direct, Facebook Messenger, WhatsApp Cloud API**: criam uma fonte em `aguardando_autorizacao` dentro do funil, com status honesto. **Não recebem mensagens nem respondem** até que haja OAuth oficial, permissões de mensagens, assinatura de webhooks e homologação. O token de anúncios existente do Gateway não prova acesso às DMs e NÃO é reutilizado de forma automática ou enviado ao cliente.
- **Google Perfil da Empresa**: mostra opção de avaliações, sem fingir chat. O Google Business Messages foi descontinuado em 31/07/2024. Não anunciar canal de mensagens inexistente.
- Conversas externas entram na Inbox `/inbox`, com identidade por fonte e sessão, responsável e status. Sem reaproveitar `telefone` como chave para Instagram/visitas.

## Segurança e isolamento
- SQL 045 adiciona `crm_fontes_funil`, `crm_conversas_externas`, `crm_mensagens_externas`. Chaves compostas (conta_id,fonte_id), RLS, sem permissão direta do navegador.
- Somente admin da workspace com CRM avançado pode cadastrar, pausar ou reativar fontes; nunca marca Meta como pronto sem autorização verificada.
- URLs públicas do webchat são liberadas somente com padrão UUID, sem liberar outras APIs. Sessão exige UUID de visitante + segredo aleatório de 256 bits; segredo fica apenas no navegador e hash no banco; comparações timing-safe.
- Limites iniciais: 5 mensagens recebidas por minuto por sessão, 300 novas conversas/dia por fonte e 2.000 caracteres por mensagem. Proteções são básicas: **antes de uso em escala, acrescentar controles anti-spam por IP e bloqueio de abuso**.
- Domínio informado é metadado de organização e não bloqueia outros sites de incorporar o widget. Token do widget é público por definição; **não tratá-lo como credencial secreta**.
- Nenhuma modificação, backfill, exclusão ou reconexão das fontes WhatsApp legadas.
- Base de dados não cria mensagens de teste nem dispara mensagens reais.

## Próximas integrações
1. OAuth Meta por workspace com aprovação de `pages_messaging`, `pages_manage_metadata` e `instagram_manage_messages`/permissões vigentes, submissão à revisão de app, callback e webhooks assinados.
2. Recepção e envio verificados Meta/WhatsApp Cloud API, vinculados à identidade da fonte do funil, sem depender de tokens de anúncios.
3. Integração de fontes externas com etiquetas/SLA/atividades e ficha unificada de contatos e negócios.
4. Configuração de agente IA/ChatGPT por fonte e transferência humana com SLA na Inbox, sem envio automático antes de consentimento.
5. Homologação autenticada visual comparada ao vídeo do Kommo: filtros, etiquetas, pipeline, lead card, contatos, empresas, produtos, histórico e Inbox.

## Publicação
- CI: teste de contrato `tests/unit/crm-fontes-webchat.test.ts`, testes anteriores, `tsc`, Next build.
- Aplicar SQL 045 antes de publicar a imagem. Conferir tabela vazia e que o CRM avançado segue restrito à workspace de piloto.
- Swarm: atualizar somente `harvest_harvest`, preservar digest anterior.
- Smoke em URLs públicas `/webchat/<UUID>` com um token válido criado pela UI administrativa e Inbox autenticada, sem mensagens externas.
