# Configurações → Integrações (experiência Kommo) — 26/10/2026

## Decisão do produto
A plataforma usa **um único aplicativo Meta de propriedade da Figueira**, autorizado separadamente por cada empresa/workspace. Não criar Meta Apps para clientes. O login do administrador permite escolher quais páginas/contas profissionais ele administra e vincular apenas a conta apropriada ao funil selecionado.

## Fluxo dentro do Harvest
1. `Configurações → Integrações`: catálogo Instagram Direct, Facebook Messenger, WhatsApp oficial, webchat e WAHA/Evolution.
2. Escolher o canal, escolher o funil de destino e clicar `Conectar com a Meta`. O backend cria/reutiliza o registro de fonte desta workspace e inicia OAuth oficial, sob permissão de administrador.
3. O titular da conta autoriza a Meta; no Messenger escolhe uma das páginas com permissão. Os tokens do ativo são cifrados e vinculados à fonte/tenant.
4. A fonte aparece na mesma aba de integrações com status separado: não autorizado, autorizado aguardando webhook, ou operacional.
5. O caminho alternativo `Pipeline → ⋯ → Editar pipeline e fontes de lead → Adicionar fonte → Instagram/Messenger` redireciona para a MESMA aba Integrações com canal e funil previamente selecionados, sem interface paralela.
6. Webchat e WhatsApp WAHA/Evolution são gerenciáveis pela integração existente, sem desconectar números.
7. Uma conta Meta gerenciada por um usuário com acesso a vários clientes **não implica** autorização automática para outras workspaces. Cada vínculo é explícito.

## O que foi conferido do ambiente
- Provider `meta_figueira` no Figueira Gateway: institucional, ready=true, token Graph disponível. Isso **não prova** que os valores de App ID/App Secret para OAuth de mensagens estejam presentes.
- Na definição real do serviço Docker Swarm `harvest_harvest`, as variáveis `HARVEST_META_APP_ID`, `HARVEST_META_APP_SECRET`, `HARVEST_INSTAGRAM_APP_ID`, `HARVEST_INSTAGRAM_APP_SECRET`, `HARVEST_META_TOKEN_KEY` não estavam configuradas. O OAuth bloqueará sua própria execução até o reaproveitamento do aplicativo institucional ser provisionado de forma segura.
- O Gateway usa OpenBao para segredos institucionais. O caminho exato do App ID/App Secret de Meta Messaging não foi verificado. Não exportar token Graph de anúncios para fingir ser App Secret nem modificar o gateway para isto.
- Frontend/backend agora aceitam o MESMO `HARVEST_META_APP_ID/SECRET` para ambos Instagram e Facebook quando o aplicativo tem produtos e permissões correspondentes; um ID Instagram específico é opcional, não obrigatório.
- Corrigida exceção exata da rota pública `/api/webhook/meta-mensagens`; o endpoint ainda exige assinatura HMAC, demais rotas continuam privadas. Nenhuma inscrição é executada automaticamente na Meta.

## Restrições
- Contas de clientes, fichas antigas, WAHA, Evolution, Chatwoot, OpenBao Gateway e seus segredos preservados.
- Nenhum envio de DM, mensagem WhatsApp, inscrição de página ou autorização de cliente por inferência.
- OAuth de clientes e assinaturas Meta dependem de App Review/permissões válidas e aprovação pelo titular da conta.
- Não relatar conexão real ou homologação até testar OAuth, callbacks e mensagens recebidas com uma conta profissional autorizada.
