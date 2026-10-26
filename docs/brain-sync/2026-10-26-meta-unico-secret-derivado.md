# Meta Messaging: configuração com um único segredo

Data: 26/10/2026

O aplicativo Meta já existente da Figueira é identificado pelo App ID público `2112411986271610`.
O proprietário armazenou a App Secret diretamente em um secret Docker Swarm chamado
`harvest_meta_app_secret` (o valor nunca foi enviado para ChatGPT nem para Git).
A imagem `harvest_harvest` lê o valor de `/run/secrets/harvest_meta_app_secret`.

## Evitar passos manuais extras
- Para criptografia AES-256-GCM dos tokens OAuth dos clientes, a aplicação **prioriza**
  `harvest_meta_token_key` se montado. Caso não exista, usa **HKDF-SHA256**
  sobre a App Secret e os contextos `harvest-meta-crypto-fallback-v1` e
  `tokens-oauth-por-workspace` para derivar uma chave distinta.
- Para o desafio de verificação do Webhook Meta, prioriza `harvest_meta_webhook_verify_token`.
  Caso não exista, gera um HMAC-SHA256 estável a partir da mesma App Secret
  com domínio `harvest-meta-webhook-verification-v1`. Não equivale à App Secret.
- Ambas as derivações acontecem **apenas no servidor**, e a API de configuração
  `GET /api/integracoes/meta/configurar` retorna exclusivamente ao administrador
  da workspace com CRM avançado a URL do webhook, as URLs de retorno OAuth,
  o App ID e o token de verificação. Não retorna a App Secret nem access tokens.
- Em `Configurações → Integrações → Instagram/Messenger`, clicar
  **Mostrar URLs e código de verificação** e copiar para as configurações
  do mesmo aplicativo em Meta for Developers.

## Segurança e rotação
- Secret do Swarm continua o único dado sensível persistido; demais chaves são
  obtidas por derivação com separação de contexto criptográfico.
- Se houver tokens de clientes gravados e a App Secret for **rotacionada**,
  a chave HKDF também mudará. Antes de rotacionar, provisionar
  `harvest_meta_token_key` dedicada e migrar/reautorizar tokens existentes.
- Rotas públicas de webhook continuam exigindo HMAC SHA256 do payload e App Secret.
- Nenhuma conta Meta é autorizada por essa configuração. O titular ainda precisa
  aprovar o fluxo OAuth e a Meta precisa ter os campos de webhooks habilitados.
- Nenhuma mensagem real foi enviada como parte desta implantação.

## Execução em produção
- PR [#33](https://github.com/tuco-gui/harvest-ai/pull/33) merge `089a477c2c88f32c3c861eb9ca26b24b487836bb`; PR [#34](https://github.com/tuco-gui/harvest-ai/pull/34) merge `6ce832a5f53e4697edd7ec50d4e471d49f9a4d64`.
- CI da branch #34 success (run `40364868858`); build+push da main success (run `40365186950`).
- O administrador criou o segredo Docker `harvest_meta_app_secret` no Portainer. O assistente NÃO recebeu o valor, apenas validou existência e montagem; o segredo foi associado EXCLUSIVAMENTE ao serviço `harvest_harvest`.
- App ID `2112411986271610` validado presente no ambiente. Conteúdo do secret **não vazio** e com formato hexadecimal esperado de 32 caracteres: true; sem revelar bytes.
- Serviço atualizado para `ghcr.io/tuco-gui/harvest-ai:6ce832a5f53e4697edd7ec50d4e471d49f9a4d64@sha256:18cc73a4a8176a379c505e66f5529516cab445d6a577d1922c823079e1d12df2`; imagem rollback `ghcr.io/tuco-gui/harvest-ai:089a477c2c88f32c3c861eb9ca26b24b487836bb@sha256:b2848eb8b619bf4e3326bec9496fd5d49da8b7f0df08605255a33a91d7d17437`.
- Swarm UpdateStatus completed, task running, RestartCount=0. Helper temporário removido.
- Smoke local de webhook: GET com verify token derivado e challenge numérico respondeu HTTP 200 e challenge correspondente; GET sem verify token devolveu 403; API administrativa sem sessão devolveu 307 /entrar. ExitCode 0. Nenhuma mensagem enviada e nenhum acesso a conversa de cliente.
- Tentativa de consulta externa Graph para comparar ID e App Secret do Meta App foi bloqueada pela política da ferramenta, **não repetida nem contornada**. Portanto, o formato do App Secret foi validado, mas sua autenticidade junto à Meta **ainda não foi confirmada**.
- **Pendência para OAuth real:** no App Dashboard, cadastrar redirect URI Facebook e Instagram, URL do webhook e verify token exibidos em `Configurações → Integrações → Mostrar URLs e código de verificação`. Validar App Review/permissões e conectar uma conta autorizada. Sem isso NÃO declarar Instagram/Messenger efetivamente integrados.
