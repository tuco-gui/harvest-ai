# Harvest · conexão real Instagram e Messenger via Meta OAuth

**Data:** 26/10/2026. Integração no contexto original: `CRM → Pipeline → ⋯ → Editar pipeline e fontes de lead → Fontes de lead → fonte Instagram/Messenger → Conectar conta Meta`.

## Implementação
1. OAuth do Instagram usa *Instagram Business Login* e solicita `instagram_business_basic` e `instagram_business_manage_messages`. OAuth do Messenger usa *Facebook Login* e solicita `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging`. Não reaproveitar o token institucional de anúncios da Figueira para operar as mensagens de outro cliente.
2. Estado OAuth com expiração 10 minutos e vínculo rígido `workspace + funil + fonte + usuário administrador + tipo`. Callback não recebe código/token em URL aberta ao frontend. Messenger mostra seletor da página administrada com tarefa de mensagens.
3. Tokens criptografados em banco via AES-256-GCM usando `HARVEST_META_TOKEN_KEY`; não são retornados pelas APIs de Fontes/Inbox, não aparecem em logs nem no navegador. Uso do OpenBao para injetar env no serviço a ser configurado separadamente, sem alterações em outras stacks.
4. Fontes com permissão OAuth concedida **permanecem aguardando** até chegar o primeiro webhook válido. Isto não autoriza envio antes de assinatura/primeira mensagem.
5. Meta deve ter HTTPS Callback `https://harvest.figueiramarketing.com.br/api/webhook/meta-mensagens`, Verify Token `HARVEST_META_WEBHOOK_VERIFY_TOKEN`, App Secret (para assinatura `X-Hub-Signature-256`) e inscrição no campo `messages`; Messenger exige subscriptions de Page; Instagram pode exigir configurar no App Dashboard, conforme modalidade de login.
6. Eventos recebidos normalizados por `object:instagram` ou `object:page`; valida HMAC do corpo bruto antes do banco; identifica o número de conta externa autorizada, recusa roteamento ambíguo, ignora eco e eventos não textuais, persiste por tenant/fonte/IGSID ou PSID e deduplica pelo ID externo.
7. Atendimento pela Inbox existente. Respostas feitas somente por clique humano, dentro de 24 horas após última mensagem recebida, com chave de idempotência e `status_envio` (pendente/enviado/falhou). Não há robô nem disparos em massa. Em caso de timeout na Meta, **não reenviar automaticamente**; confirmar no canal oficial primeiro.

## Migração
SQL `sql/046_meta_oauth_mensagens.sql`: campos Meta nas fontes, estados OAuth com RLS, check tenant/funil/autor e estados de entrega em mensagens. Aplicação aditiva, sem alteração de WhatsApp, eventos antigos ou conexões de outras workspaces.

## Limitações verificadas
- Gateway Meta institucional está disponível para Page/IG e Ads, mas consulta à Page institucional Figueira apontou `subscribed_apps=[]` e conversa vazia. Não há comprovação de webhook de mensagens em produção.
- Neste serviço Harvest as novas variáveis `HARVEST_META_*` ainda podem não estar configuradas. Sem App ID, Secret e AES Key o botão retorna uma mensagem clara e **não faz OAuth**, preservando credenciais.
- A Meta exige configurações de App Dashboard, verificação de negócio e aprovação das permissões conforme ativos, app mode e acesso. Nenhuma credencial de cliente será inventada nem instalada em workspace errada.
- A verificação real de Meta OAuth e envio de DMs exige autorização do titular e contato de teste que tenha iniciado a conversa. O CI não substitui esse E2E.
- Remanescem: teste real com conta autorizada, encaminhamento humano/IA multicanal avançado, unificação integral de contatos CRM com prospects e pixel-perfect com o vídeo do Kommo.
