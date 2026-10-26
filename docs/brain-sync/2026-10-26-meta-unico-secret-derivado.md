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
