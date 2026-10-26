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
