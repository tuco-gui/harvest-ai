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

## Publicação efetiva — 26/10/2026
- PR [#30](https://github.com/tuco-gui/harvest-ai/pull/30) integrado via squash em `main` na revisão `4434cedad1425a9ddf2981d3b7cacceb1adf7f76`.
- Workflow de validação (run `40336643265`) concluiu `success`, com TypeScript e build Next.js aprovados, além dos testes de criptografia/HMAC/OAuth/normalização e regressões prévias. Imagem GHCR da main (run `40337256788`) `success`.
- SQL 046 aplicada em transação (EXIT=0, COMMIT), verificados `crm_meta_oauth_estados=0`, `crm_fontes_funil com token autorizado=0`, `crm_mensagens_externas=0`, `inbound_eventos=6072`, automações ativas=0, OAuth RLS ligado e trigger de isolamento presente.
- Swarm: somente `harvest_harvest` recebeu nova imagem. `UpdateStatus=completed`, tarefa `running`, contêiner `running`, reinicializações `0`; logs `Next.js 15.5.23 Ready in 270ms`. Contêiner temporário do update removido.
- Digest publicado: `ghcr.io/tuco-gui/harvest-ai:4434cedad1425a9ddf2981d3b7cacceb1adf7f76@sha256:a3b5607eef0a1567a5afdb645063c752fd3b7de654ce19014f6756fc7a3710ae`.
- Rollback preservado: `ghcr.io/tuco-gui/harvest-ai:c341155154f8b4d8b232e5571e191ed20803bb9a@sha256:8bcfb78fcaa8590bf7254c73a666a9abdaeb3fed206ea434646eeb2618566ac6`.
- **Não homologado E2E:** variáveis do novo App Meta de mensagens e de criptografia ainda não foram atestadas presentes no serviço; autenticação externa, inscrição webhook e envio real a um destinatário autorizado precisam de teste com consentimento do titular. A ferramenta de execução HTTP dentro do contêiner havia sido bloqueada por configuração de segurança no QA anterior; nesta rodada usou-se CI, estado do Swarm, logs e verificação PostgreSQL, não fingir smoke autenticado.
- **Não copiar** Meta Gateway institucional nem credenciais de Pages/clientes indiscriminadamente para o Harvest. A conexão acontecerá por OAuth vinculado à workspace correta. OAuth não inicia enquanto parâmetros App/TokenKey estiverem ausentes.
