# Fechamento do conector Meta — assinatura de webhook da página (26/10/2026)

## Experiência do usuário
- `Configurações → Integrações → Facebook Messenger → Conectar com a Meta`: escolher funil, autorizar no app Meta central, selecionar Page com tarefa de mensagens.
- Depois da escolha, o Harvest tenta `POST /v26.0/{page-id}/subscribed_apps` com os campos `messages,messaging_postbacks,message_deliveries,message_reads` e credencial daquela **Page**, não de anúncios.
- A autorização é preservada se a inscrição for recusada. Status distinguem OAuth pendente, assinatura confirmada, falha na assinatura e canal operacional após webhook real.
- Se falhar: `Ativar webhook Messenger` na mesma aba, sem remover conexão e sem executar OAuth novamente. Requisição autenticada/admin/CRM avançado e restrita à workspace.
- Popup Meta deve abrir **no clique original**, antes de chamadas HTTP de cadastro, evitando bloqueio do navegador.
- Instagram Business Login mantém webhook inscrito no Meta App Dashboard; não inventar endpoint de subscribe per-IG que não foi verificado.

## Bloqueios externos para ativação de clientes
- O serviço Harvest não tinha `HARVEST_META_APP_ID`, `HARVEST_META_APP_SECRET`, `HARVEST_META_TOKEN_KEY` e `HARVEST_META_WEBHOOK_VERIFY_TOKEN` no ambiente Swarm na inspeção anterior, enquanto Gateway institucional possuía apenas metadados de Graph token.
- Constatado que a credencial do Gateway é obtida via AppRole do OpenBao, mas **isso não é automaticamente** a App Secret do aplicativo de mensagens. Não expor nem transportar segredos por logs ou PR.
- A implantação de código não concede `pages_messaging`/ `instagram_business_manage_messages` na Meta. A habilitação para clientes externos exige autorização do titular e eventual App Review.
- Para concluir OAuth e produção é necessário fornecer ao serviço Harvest as credenciais do aplicativo Meta EXISTENTE, via cofre seguro, cadastrar as Redirect URIs e Callback URL no dashboard Meta, e realizar uma conversa de teste autorizada. Nenhuma mensagem real enviada neste PR.

## Segurança
- Não tocar WAHA/Evolution nem clientes sem autorização; sem migrações destrutivas.
- `crm_fontes_funil.meta_assinatura_status` e `meta_assinatura_em` não incluem token, payload ou segredos.
- HMAC no endpoint de entrada já implantado no PR31; qualquer webhook sem assinatura é recusado.

## Implantação verificada — 26/10/2026
- PR [#32](https://github.com/tuco-gui/harvest-ai/pull/32) integrado ao main como `7a0efb324beeeb84f8edd5b9d13015c8c50c7acf`.
- Workflow branch `40345830445` aprovado, incluindo TypeScript, regressões da assinatura e Next.js build. Build/push `40346365397` aprovado.
- Migração SQL 047: `COMMIT`, exit 0, nova restrição de status verificada; 1 fonte externa pré-existente preservada, zero assinaturas criadas artificialmente, 6072 eventos antigos preservados, zero OAuth realizados e zero mensagens enviadas.
- Swarm `harvest_harvest` update completed, tarefa running, 0 reinicializações.
- Imagem atual: `ghcr.io/tuco-gui/harvest-ai:7a0efb324beeeb84f8edd5b9d13015c8c50c7acf@sha256:ce3e6130063a0b231cd7d00879d80a6b87cfa7e90fac0d2fd65005953f674d71`.
- Imagem rollback: `ghcr.io/tuco-gui/harvest-ai:ddf77cdaf6173b63cec1dae8b44e1c5bd128b4ba@sha256:55c1ca647416bc011455fd407a9cc646e9f93333c056fbb4d5ee0a99d5a5a777`.
- Smoke anônimo dentro do contêiner: `/entrar=200`; `/configuracoes`, `/api/integracoes`, `/api/integracoes/meta/assinar` = 307 para `/entrar`; GET `/api/webhook/meta-mensagens` sem desafio = 403; exit code 0. Não foram usados tokens nem mensagens de clientes para teste.
- Fonte de credencial existente analisada no Gateway: a integração institucional Meta está pronta para Graph, com AppRole no OpenBao, mas nenhum App ID/Secret do produto de **mensagens** foi confirmado acessível no serviço Harvest. Uma tentativa de inspecionar diretamente credenciais foi bloqueada pelas regras de segurança; não contornar o controle nem inventar segredo. A assinatura real de uma Page Meta não pôde ser executada sem autorização OAuth do titular.
- **Não declarar integração 100% concluída**: faltam o aprovisionamento seguro do OAuth App ID/Secret do Meta App existente, configuração do callback no dashboard e validação real de troca de código/webhook/DM.
