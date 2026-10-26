# Credenciais Meta no Harvest via Docker Swarm Secrets

**Aplicativo da Figueira:** App ID `2112411986271610` (identificador público, já configurado em `harvest_harvest`). **Não criar aplicativos por cliente.**

## Provisionamento seguro

1. O administrador cria no Portainer, ambiente Docker Swarm da Figueira, **Secrets → Add secret** com nome exato `harvest_meta_app_secret` e cola a **App Secret** do aplicativo existente diretamente no campo Secret. Ativar Encode secret ao informar texto simples. Não colar a App Secret em ChatGPT, repositório, log, código ou comando compartilhado.
2. Conceder SOMENTE ao serviço `harvest_harvest` acesso ao segredo com target `harvest_meta_app_secret`, montando `/run/secrets/harvest_meta_app_secret`.
3. Gerar chave de AES-256 no servidor e armazenar como `harvest_meta_token_key`, texto hexadecimal de 64 caracteres, com target `harvest_meta_token_key`. Não alterar/rodar essa chave em futuras publicações depois de salvar credenciais no banco; isso impediria desencriptar tokens existentes.
4. Registrar o valor escolhido para Verify Token no App Dashboard e armazená-lo como segredo `harvest_meta_webhook_verify_token` no Swarm com target igual ao nome. Não confundir com App Secret, App ID ou Graph API Access Token.
5. O código da aplicação prioriza os três arquivos de segredos do Swarm; variáveis de ambiente legadas são usadas só para staging. Nenhum segredo entra no bundle do navegador.
6. Conferir somente booleanos de configuração e resultado de rotas, jamais imprimir o valor da App Secret.
7. A habilitação real depende de configurar na Meta as redirect URIs OAuth, callbacks do Messenger/Instagram, assinatura do aplicativo nos campos de mensagens, permissões e a autorização explícita de cada workspace.

### Caminhos de configuração de Meta

- Facebook OAuth redirect: `https://harvest.figueiramarketing.com.br/api/meta/oauth/callback/facebook`
- Instagram OAuth redirect: `https://harvest.figueiramarketing.com.br/api/meta/oauth/callback/instagram`
- Meta Webhook URL: `https://harvest.figueiramarketing.com.br/api/webhook/meta-mensagens`

**Cuidado:** não tratar um token Graph de anúncios como App Secret OAuth. Token OAuth de cliente precisa ser obtido pelo próprio fluxo de autorização e ficar cifrado e vinculado à workspace.

## Rollout
- Atualizar exclusivamente a imagem `harvest_harvest` depois de CI passar e conservar digest de rollback.
- Anexar os segredos **após** sua criação; alterações no secret list podem reiniciar a tarefa do serviço. Inspecionar estado `UpdateStatus`, task e `RestartCount`.
- Evitar criar ou duplicar segredos sob o mesmo nome: Swarm secrets são imutáveis, precisam de rotação explícita.
- **Nenhuma DM ou WhatsApp real** deve ser enviada para testar sem destinatário controlado e consentimento.
