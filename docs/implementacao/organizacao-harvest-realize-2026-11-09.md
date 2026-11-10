# Correção e organização do Harvest — 09/11/2026

## Estado desta rodada

Código e migrations preparados na branch local `feat/servicos-workspace-granulares`.
**Nenhum merge, publicação, migration, provisionamento remoto, redistribuição de lead
ou envio real foi executado nesta rodada.** Não há comprovação de operação nova em produção.
As alterações locais anteriores foram preservadas.

### Fontes consultadas antes da implementação

- PR #46, integrado em `3ef0968`, incluindo auditoria operacional de 06/11:
  https://github.com/tuco-gui/harvest-ai/pull/46#issuecomment-6699051108
- PR #47 e seus quatro commits, incluindo a correção do adapter/artefato após o review:
  https://github.com/tuco-gui/harvest-ai/pull/47
  A branch desta sessão estava em 3ef0968; a preservação de renda/termo foi incorporada
  às alterações locais sem sobrescrever os guards de serviços já implementados.
- Wiki local: `/Users/gui_t/Figueira_Marketing/brain/01-wiki/conhecimento/empresa/servicos-e-escopo.md`.
- Brain Realize: `10-clientes/realize-negocios-imobiliarios/LEIA-PRIMEIRO.md` e
  `projetos/alea-botucatu/README.md`. Esses registros são de outubro e anteriores ao
  cutover: não se interpreta a antiga menção ao Portal/Supabase como ordem para desfazer
  o ledger no banco Harvest autorizado e documentado em novembro. O banco do Portal não foi usado.
- ADR-011/012, notas `docs/brain-sync`, paridade Deskcomm/Kommo e adapters atuais.

## 1. Realize: dados e responsável inicial

Preservados no contrato de captura: nome, telefone, e-mail, renda familiar, canal de
origem, UTMs (`source`, `medium`, `campaign`, `term`, `content`), GCLID e protocolo original.
O UUID Harvest continua como chave técnica idempotente; o protocolo público também é
conservado na origem. O adapter do child existente agora conserva os campos recebidos
e o comentário em vez de descartá-los. O export n8n foi regenerado **inativo**.

Isso é correção de artefato/contrato local. Ainda exige conferir o preparador/POST
do child efetivamente publicado, os dois workflows de origem e um lead novo controlado
antes de afirmar que todos esses campos chegaram ao Superlógica real. Nenhuma credencial
ZAPIER/LEADS foi lida ou modificada.

### Regra oficial encontrada

Fonte primária:
https://imobiliarias.superlogica.com/hc/pt-br/articles/41461680111127-Como-criar-e-configurar-times-no-CRM

O mecanismo é **Preferências → Times**, não um nome escrito no comentário do cadastro.
Para garantir o primeiro destinatário **SYLVIO GUILHERME FRANÇA JUNIOR**:

1. Localizar o usuário real no cadastro do CRM, confirmar seu ID e estado ativo.
2. Conferir/incluir o usuário no time correto, com **Recebimento de leads** habilitado,
   tipo de negócio **Venda**, capacidade de leads não esgotada e horários elegíveis.
3. O time deve ser **Account Executive (AE)** para recebimento pela distribuição.
4. Em **Regras de Atribuição**, usar **Fixo**, escolhendo o usuário real de Sylvio.
   A documentação diz que Fixo deve funcionar sozinho e anula outras regras se combinado.
   Rodízio não garante que o próximo lead seja de Sylvio.
5. Na aba **Imóveis**, incluir `CA0653_MMOL`. Para exclusividade por código, a documentação
   manda remover as categorias da aba **Tipos de Imóveis**. Conferir filtros geográficos,
   negócio e conflitos com outros times, sem modificar regras globais de outros empreendimentos.
6. Revisar o **Pulo do lead (Drop)**: ele pode redistribuir por inatividade; não configurar
   transbordo/transferência automática sem homologação. Não alterar carteira histórica.
7. Conferir **Últimos Leads Recebidos** (últimos 15 segundo a documentação) e o responsável
   persistido de um cadastro novo controlado que veio especificamente da API ZAPIER.

Complemento oficial:
https://imobiliarias.superlogica.com/hc/pt-br/articles/44852924217751-Como-configurar-o-funil-de-atendimento-e-distribui%C3%A7%C3%A3o-autom%C3%A1tica-de-leads-da-roleta-de-corretores

**Não foi confirmado que a rota ZAPIER da instalação Realize aciona essa regra do time.**
É necessário verificar na conta real ou com o suporte se a integração seleciona o time
e a etapa inicial desejados, ou se mantém o responsável padrão da credencial API.
Se não houver suporte oficial para esse direcionamento, a distribuição continua
bloqueada para esse requisito; não haverá PUT/PATCH privado nem campo inventado.

### Trava de novos cadastros

O estado antigo `responsavel_crm_confirmado=true` documentava aceitação temporária do
responsável padrão da API e **não comprova Sylvio**. A nova migration deixa
`bdr_config.distribuicao_crm_validada` nula. O worker preserva as capturas e não chama
`cadastrar` até a conferência operativa da regra oficial; a consulta `reconciliar`
continua separada e não redistribui registros existentes.

A evidência deve registrar `nome`, `usuario_id`, `time_id`, `ativo`, `recebe_leads`,
`elegivel`, `regra=fixo`, `codigo_anuncio=CA0653_MMOL`, `evidencia` e `verificado_em`.
Os IDs têm de vir do CRM real, nunca desta documentação ou de fixtures. Esse campo
não é editável pelo formulário BDR e não é enviado como atribuição à API ZAPIER.
O registro da evidência, por si só, também não altera o time remoto.

## 2. Administração por workspace

Mantida a implementação granular documentada em `servicos-workspace-granulares.md`:
catálogo/dependências, liberação individual, contexto visual, delegação auditada,
enforcement no middleware e guardas em workers/callbacks/transportes.

Novas correções de usuários:
- O admin convida membros para a **workspace ativa**, não para seu primeiro vínculo.
- O papel de outro membro pode ser alterado entre admin e operador **somente nessa workspace**.
  Isso não altera `perfis.papel`, nem concede Super Admin.
- Reset de usuário global/multicliente por admin cliente é recusado, pois alteraria uma
  senha compartilhada com outras empresas.
- Remover membro inativa somente o vínculo. Não apaga Auth nem histórico.

## 3. Configurações → Integrações

A aba duplicada Conexões foi incorporada à aba **Integrações**, preservando as rotinas
existentes de WAHA/Evolution, Meta/Zernio, webchat, Chatwoot, IA e demais provedores.
Links antigos com `aba=conexoes` continuam abrindo a área única. O catálogo social
permanece o mesmo componente; WAHA é acessado por âncora na mesma área.
As categorias incluem WhatsApp, Instagram/Messenger/Sites, Chatwoot, CRMs externos e
outros provedores. Não há remoção de credenciais ou contas remotas nessa reorganização.

## 4. Chatwoot

### Resultado da auditoria do código anterior

`POST /api/canais/chatwoot` só configurava `chatwoot_account_id` e vinculava inboxes
existentes. **Não provisionava uma conta por cliente.** O formulário pedia ID remoto.
Portanto, não se apresenta o fluxo anterior como provisionamento automático confirmado.

### Correção local

O admin autorizado pode solicitar **Preparar Inbox desta workspace**. O backend usa
a Platform API oficial para criar a conta, adicionar o usuário técnico e conferir que
o token da Application API consegue ler seus inboxes. A identidade do cliente fica na
sessão Harvest; não é necessário criar manualmente sua conta no Chatwoot externo.

Pré-requisitos de servidor (somente nomes, sem valores):
`CHATWOOT_API_URL`, `CHATWOOT_API_TOKEN`, `CHATWOOT_PLATFORM_APP_TOKEN` e
`CHATWOOT_SERVICE_USER_ID`. O último é o ID **real** do usuário técnico correspondente
ao token da aplicação; a Platform App deve estar autorizada a provisioná-lo.
O token de usuário não é tratado como token Platform App.

Há uma reserva persistida antes do POST. Concorrência, timeout ou falha de persistência
não provocam nova criação cega: o ledger fica bloqueado/`incerto` para reconciliação.
O vínculo existente com Twenty é preservado. A migration 057 exige account Chatwoot
exclusivo por workspace; se houver compartilhamentos antigos, o índice abortará e esses
vínculos precisam ser auditados, sem exclusão automática.

Admin cliente só vincula inboxes consultados na conta que já lhe foi autorizada; não
pode trocar o Account ID. O tipo do inbox vem da API, não do payload do navegador.
Desvincular inativa o vínculo local e preserva o histórico. Revogar o conector também
barra seu processamento no webhook e o acesso às rotas de handoff.

Fontes oficiais:
- https://developers.chatwoot.com/api-reference/accounts/create-an-account
- https://developers.chatwoot.com/api-reference/account-users/create-an-account-user

### O que não está comprovado

A existência/configuração dessas credenciais na instância real não foi verificada.
Criar uma conta **não cria um canal conectado nem replica automaticamente todo o
histórico WAHA/Evolution no Chatwoot**. O fan-out/correlação de todos os transportes,
eventos assinados, mídia e entrega de respostas precisa de homologação no fluxo
existente. Não foi implantado outro transporte, multiplexer ou CRM paralelo para
contornar essa ausência de evidência. Os guards e os testes existentes de pausa por
atendente humano permanecem; o handoff real ainda exige teste controlado.

## 5. Modelos e BDR imobiliário

Modelos genéricos: Recepcionista, BDR, Consultor de vendas, Suporte e Financeiro.
**BDR Imobiliário** é especialização do papel BDR, não um sexto agente institucional
semeado em todas as empresas. Instâncias e instruções existentes são preservadas;
escolher modelo prepara o formulário e salvar persiste somente na workspace atual.

A configuração da instância inclui conhecimento, canais, funis, horários de Brasília,
autonomia manual/rascunho e regras de transferência. Os IDs dos vínculos são validados
no backend. Não há opção nova de envio autônomo sem homologação; configurações novas
ficam no escopo manual/rascunho. O laboratório usa o conhecimento/instruções gravados.

A ficha BDR tem código, base/condições aprovadas e seletores de canal/funil editáveis.
O catálogo de produtos já existente é reutilizado para cadastrar/buscar imóveis:
SKU representa o código e descrição representa a ficha. O formulário pode preparar
a ficha a partir desse catálogo, sem criar tabela paralela de imóveis.

Salvar ficha por PATCH não altera modo, aprovação, responsável ou CRM habilitado.
Vínculos com sessões/capturas históricas não podem ser trocados silenciosamente; há
guarda também no banco. A ficha textual continua editável em simulação. POST não
concede mais mudança de modo pelo formulário; alterações operacionais exigem o gate
de homologação existente. O prompt e resumo deixam de impor Realize/Alea a outros tenants.
O conector Superlógica Realize continua limitado à sua allowlist e imóvel, separado do modelo genérico.

## 6. O contador e os cadastros

Origem identificada em código: `bdr_kpis` (migration 054), retornado por
`GET /api/agentes/bdr` e apresentado em `PainelBdrAlea`.
`cadastrados_crm` conta `superlogica_registros.status_sincronizacao='cadastrado'`;
**não conta `crm_contatos` nem `oportunidades`**. `recebidos` agrega identidades do
ledger com sessões BDR não correspondentes. A captura 054 não cria contato/oportunidade
local; `bdr_receber` só cria lead quando há inbound e sessão correspondente.

Assim, o código explica como cadastros externos podem existir sem aparecerem nos
contatos/pipeline. **O número seis e os IDs dessas seis linhas não foram conferidos
no banco real nesta rodada.** Não se presume uma falha de sincronização de seis negócios.

O novo diagnóstico separa protocolos de captura, identidades de integração, estados
pendente/processando/cadastrado/retry/reconciliar/falha e contagens reais locais de
leads, contatos e oportunidades. Cada registro mostra os vínculos locais que realmente possui.

A ação explícita **Vincular CRM local** usa RPC transacional idempotente, reaproveita
identificadores exatos e recusa identidades ambíguas. Não modifica responsáveis/estágios
históricos nem grava no Superlógica. Não opera sobre backend Twenty habilitado: nesses
tenants, a sincronização precisa usar o adapter existente, sem inventar um espelho local.
Nenhuma ação em lote foi aplicada aos seis registros alegados.

## 7. Migrations, backup e gates

- 055: serviços/delegação/auditoria da rodada anterior.
- 056: configuração de instância e BDR genérico, evidência de distribuição separada,
  proteção dos vínculos com histórico e bloqueio de escrita direta de agentes via REST autenticado.
- 057: reserva de provisionamento Chatwoot e exclusividade dos vínculos de conta remota.
- 058: vínculos explícitos entre captura e entidades CRM já existentes.

Antes de aplicar: obter backup verificável do banco Harvest e das configurações dos
workflows/serviço envolvidos, registrar imagem/digest atual e plano de rollback;
auditar vínculos Chatwoot compartilhados e permissões atuais. Sem acesso ao runtime,
**não houve backup remoto executado nem alteração estrutural** nesta sessão.

Não há publicação autorizada implicitamente pelo sucesso dos testes. Após aprovação,
aplicar migrations em ordem e publicar no serviço existente, homologando primeiro na
workspace **Figueira Marketing**, sem staging separado. Manter Realize em simulação,
agente sem liberação de respostas e captura preservada durante a validação de distribuição.

Reverter o código antigo remove enforcement granular e a nova trava de responsável:
isso precisa ser considerado no plano de rollback. Conservar tabelas aditivas, ledger
e auditoria; não excluir dados para reverter a apresentação.

## 8. Bloqueios reais de acesso

As ferramentas existentes do Cofre listaram capabilities, mas consultas a
`PORTAINER_INVENTORY_READ` e `GATEWAY_BRAIN_DEPLOY_KEY` retornaram
**`OpenBao login failed: HTTP 400`**. O Brain local foi consultado diretamente; não
foi sincronizado/escrito. Nenhum serviço/MCP alternativo foi instalado.

São necessários o restabelecimento do broker autorizado e acesso de leitura à conta
Superlógica/n8n/Harvest, ou uma sessão de administração autorizada, para:
- confirmar ID/atividade/time/elegibilidade de Sylvio e o direcionamento da API ZAPIER;
- localizar as seis capturas e conferir seus vínculos/duplicidades reais;
- verificar credencial Platform App, token de aplicação e usuário técnico Chatwoot;
- executar homologação funcional autenticada como Super Admin e admin de cliente;
- executar um lead novo controlado LP/minichat → Superlógica, confirmando campos e responsável.

Essas dependências não são declaradas resolvidas por testes com mocks, screenshots,
artefatos exportados, merge dos PRs ou HTTP 200 genérico.

## 9. Verificação executada localmente

- **121 testes unitários/SQL aprovados**: handlers reais sob fixtures de sessão/tenant,
  contratos n8n, banco PGlite com DDL até 058, bloqueios de envio, dedupe, configuração
  de agentes, administração de usuários e timeout/reconciliação do provisionamento.
- **12 testes JS legados aprovados**.
- **4 testes do editor de fluxos aprovados**.
- TypeScript (`npx tsc --noEmit`) aprovado; build Next.js de produção aprovado.
- As chamadas de rede desses testes foram substituídas por fixtures; nenhum POST real
  ao CRM, criação remota de conta ou mensagem é comprovado por esses resultados.

Comandos da raiz, executados serialmente:

```sh
env NODE_OPTIONS=--max-old-space-size=1024 UV_THREADPOOL_SIZE=1 node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/*.test.ts tests/unit/*.test.mjs tests/sql/*.test.mjs
env NODE_OPTIONS=--max-old-space-size=1024 UV_THREADPOOL_SIZE=1 node --test --test-concurrency=1 tests/*.test.js
```

Em `app/`: `npm run test:organizacao` está disponível para a suíte específica;
`npx tsc --noEmit`, `HARVEST_BUILD_CPUS=1 npm run build` e o teste do editor foram
executados com os mesmos limites de memória/threads. A suíte específica foi incluída
no workflow de CI, mas não se afirma execução de CI remoto nesta branch não publicada.

## 10. Rodada 10/11/2026 — piloto único e inbound WhatsApp oficial

Branch `feat/servicos-workspace-granulares` publicada no **PR #48**
(https://github.com/tuco-gui/harvest-ai/pull/48), commits `d90fe8f` e merge `8678057`.
O PR está `OPEN` e `MERGEABLE`; **não houve merge, deploy, migration aplicada ou
ativação de resposta real**. O workflow n8n `pqVU7Tceb9Xv8dHs` foi mantido intacto.

### Homologação fail-closed

- `bdrPolitica.ts` define `TELEFONE_HOMOLOGACAO_BDR = '5514997754659'`.
  Em `modo='homologacao'`, `envioBdrPermitido` só retorna `true` para esse telefone
  (com normalização de DDI/formatação). `contatos_teste` não amplia o piloto.
- `bdr.ts` aplica a guarda antes de gerar/consumir IA: fora do piloto, o contato
  continua capturado, mas não há resposta automática.
- Configuração de instância passou a ser aceita em `simulacao` e `homologacao`;
  `producao` com `agente.configuracao` continua bloqueada até nova homologação.

### Inbound WhatsApp Cloud API

- `/api/webhook/meta-mensagens` aceita `object='whatsapp_business_account'` e valida
  HMAC com o App Secret (`segredoMeta('app')`).
- `crmMetaInbound.ts` lê `entry[].changes[].value`, usa `metadata.phone_number_id`
  como identificador da fonte (`crm_fontes_funil.tipo='whatsapp_cloud_api'`), ignora
  `statuses` e mídia, e captura texto/botão/interativo.
- Mensagem inbound gera conversa/mensagem idempotentes e chama
  `capturarLeadSuperlogica` com chave `meta:<message_id>`, reutilizando o outbox/bridge
  da Realize. O retry da Meta reconcilia captura sem duplicar conversa.
- Contatos nomeados fora do piloto são capturados; nenhum recebe resposta automática.
- Sem `bdr_config`/funil correspondente ou sem nome de contato, a captura não ocorre.

### Verificação

- **127 testes unitários/SQL** e **12 testes JS legados** aprovados.
- `npx tsc --noEmit` e `HARVEST_BUILD_CPUS=1 npm run build` aprovados após o merge.
- Testes de homologação cobrem: allowlist não amplia o piloto, normalização do telefone,
  bloqueio de produção com configuração, ausência de IA fora do piloto, retry idempotente
  e captura de contatos nomeados.

### Pendências para operar de verdade

- Descobrir WABA/`phone_number_id` da Realize e confirmar Cloud API/coexistência exige
  credencial de banco/produção, ausente nesta sessão.
- O canal que desapareceu da UI (WAHA/Evolution) não pôde ser inspecionado sem banco.
- OpenBao segue com AppRole inválido (`HTTP 400 invalid role or secret ID`); correção
  exige reemissão de `secret_id` por admin/root. SSH direto a `77.37.40.97` é negado.
- Evidência de distribuição ao Sylvio e migrations 055–058 continuam pendentes.
- CI do PR (`autenticacao`, `validar`, Vercel) ainda não concluído.
