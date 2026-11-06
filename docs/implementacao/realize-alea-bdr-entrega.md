# Realize / Alea — implementação do PR #45

Fonte de aceite: [PR #45](https://github.com/tuco-gui/harvest-ai/pull/45), documento `realize-alea-bdr-whatsapp-superlogica.md`. Esta entrega acrescenta código ao Harvest existente. **Não representa homologação externa nem aprovação para responder a leads reais.**

## Escolha por módulo

| Módulo | Alternativas verificadas | Escolha e motivo |
|---|---|---|
| WhatsApp, QR, sessão, mídia e HMAC | Harvest/WAHA/Evolution já implementados; Deskcomm possui seu próprio adapter | Preservar APIs de canais e conexão existentes; compartilhar envio manual/BDR em `whatsappEnvioCanal.ts`. Nenhum motor WhatsApp novo. |
| Inbox e responsável | Inbox Harvest por conta/canal; Chatwoot com API de atribuição; Deskcomm com `organizations`, `conversations`, `contacts` | Acrescentar contexto e controles à Inbox existente. Chatwoot continua integrado por vínculo explícito de account/inbox/canal, sem nome/telefone como identidade remota. |
| CRM/funil | Adapter Twenty e funis Harvest já operacionais | Preservar backend escolhido por workspace e criação opt-in de negócio. Superlógica continua CRM oficial da Realize. Não duplicar cadastros no Twenty para sincronizar o Superlógica. |
| BDR especializado Alea | Agentes Harvest eram laboratório; Chatwoot oferece webhooks/atribuição, não este roteiro imobiliário; Deskcomm oferece motor completo com schema, pool PG, cron e worker próprios | Reutilizar IA da workspace e dispatcher Harvest. Acrescentar somente contexto durável, política Alea e ledger de execução. n8n agenda ticks. Portar o motor Deskcomm inteiro exigiria migrar seus contatos/conversas/crons. |
| Superlógica | Workflows Realize já publicados; nenhum adapter existente no repositório | Captura idempotente e outbox específica do CRM no Harvest; bridge n8n chama o workflow de escrita existente. Leitura LEADS é um workflow separado, a confirmar documentalmente. |

Deskcomm consultado no commit `fa4268a8ad9e62ab2a6d827e6e2db4750f7e961d`: `lib/agent-engine/agent/human-handoff.ts`, `lib/agent-engine/agent/schedule-followup.ts` e árvore de Inbox/agentes. Foram usados como referência de fluxo e avaliação de dependências; não há trecho substancial copiado nesta entrega. A experiência permanece uma aplicação Harvest, com os controles junto da conversa.

## Arquivos e fluxos

- `sql/054_realize_bdr.sql`: configuração desligada por padrão; sessões por workspace/canal/telefone; ledger; mapeamento Superlógica; aliases de protocolo; reservas atômicas; RLS server-only; KPIs agregados. Numeração atualizada para preservar as migrations sociais/fluxos já presentes na `main`.
- `lib/eventos.ts` → `lib/bdrInbound.ts`: utiliza somente inbound já persistido e canal/funil explicitamente configurados. Não executa transporte no dispatcher nem acrescenta triggers ao motor legado.
- `lib/bdr.ts`: consome contexto, histórico de entradas e respostas anteriores, agente `bdr` ativo e a mesma conexão de IA da workspace. Persiste qualificação/resumo, envia pelo adapter existente e registra saída em `prospecta_mensagens`/`historico_contato` para a Inbox atual.
- `lib/bdrPolitica.ts`: persona, extração estruturada, perguntas progressivas, renda facultativa, restrições financeiras, handoff, quiet hours 09h–19h de São Paulo e cadência 4h/D+1/D+3/D+7.
- `POST /api/webhook/bdr`: integração autenticada do n8n; captura LP/minichat/Meta ou tick de processamento. `tenant_id` precisa estar na allowlist do servidor.
- `/api/agentes/bdr`: configuração piloto e indicadores, restritos a administradores com módulos agentes/CRM avançado. Não disponibiliza botão/API de aprovação de produção.
- `/api/crm/atendimentos/[telefone]/bdr?canal_id=…`: contexto, prévias, assunção humana, liberação explícita, evidência de consentimento e visita confirmada por humano. Operador só vê sua conversa; liberação/consentimento/visita exigem administrador.
- `PainelBdrAlea` no agente BDR e `ContextoBdrAlea` na Inbox: sem nova Inbox ou login em outro produto.

### Idempotência e interrupção

1. Mesmo webhook repetido encontra a unicidade inbound existente. Identificador físico explícito permite dedupe WAHA/Chatwoot também por índice único em conta/canal/ID físico; não se usa proximidade temporal para deduplicar pessoas diferentes.
2. `bdr_receber` usa lock transacional por conversa, reaproveita o lead e ignora entradas antigas/repetidas. Nova entrada invalida o turno em elaboração e cancela a cadência anterior.
3. A reserva e a chave única de execução precedem o envio externo. Flags, opt-out, supressão, responsável e ambiente são conferidos novamente depois da IA. Crash/timeout depois de reservar não ocasiona reenvio automático; fica visível como pendente/incerto.
4. Atribuir responsável ou responder manualmente pelo Harvest pausa a IA antes do envio. Eventos humanos/atribuição recebidos do Chatwoot também pausam o BDR. Opt-out persiste e não é removido por nova resposta ou liberação da IA.
5. Follow-up exige consentimento registrado com evidência. Não é inferido pela IA. Resposta, opt-out e handoff interrompem a cadência. D+7 encerra a sequência inicial.

## Superlógica e n8n

**Imóvel fixo:** `CA0653_MMOL`. Nenhum token ZAPIER ou LEADS é armazenado no Harvest/repositório.

Workflows preservados:

- `CZ3gAStDKp75yJtm`: pré-cadastro → planilha/protocolo.
- `pqVU7Tceb9Xv8dHs`: chat WhatsApp → planilha.
- `njZxxrVJrrl6l96i`: registro Superlógica existente, credencial **Superlógica Realize - Zapier**.

Importações propostas, **inativas**:

- `n8n/realize-bdr-tick.json`: tick para uma workspace explicitamente indicada.
- `n8n/realize-superlogica-bridge.json`: header-auth obrigatório; valida tenant/imóvel/chave; chama o child existente para escrita e outro workflow para consulta LEADS. Falha ambígua nunca volta ao caminho de escrita.

A integração institucional da Figueira com o n8n já está operacional, conforme confirmado pelo responsável. A leitura anterior de capabilities do Cofre não deve ser interpretada como indisponibilidade dessa integração e não exige outro MCP. Os novos exports permanecem somente como arquivos versionados, inativos, para revisão. A conferência operacional será feita separadamente pela integração existente, incluindo suporte de entrada por subworkflow, formato real de saída do child e autenticação Header Auth do bridge.

### Contrato de captura nos dois workflows de origem

Depois de manter a gravação na planilha, chamar `POST /api/webhook/bdr` com `Authorization: Bearer <segredo de integração>`:

```json
{
  "acao": "capturar",
  "tenant_id": "<UUID da workspace autorizada>",
  "protocolo": "<protocolo original estável>",
  "nome": "Contato controlado",
  "telefone": "<telefone autorizado>",
  "email": null,
  "origem": {
    "source_channel": "lp",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "alea"
  }
}
```

Use `source_channel: minichat` no chat. Também são preservados `gclid`, `fbclid`, `anuncio` e `referral` quando presentes, sem inventar atribuição. A primeira origem não é sobrescrita quando o contato reaparece no WhatsApp. O cadastro independe de interesse, qualificação ou opt-out. WhatsApp sem nome recebe acolhimento e coleta nome antes do cadastro mínimo.

**Um único escritor:** ao homologar a captura via Harvest, redirecionar o acionamento do child de escrita para o bridge. Não deixar simultaneamente o POST antigo direto e o novo bridge escrevendo o mesmo protocolo. A planilha e os workflows de origem são preservados; muda o acionamento da escrita, não se cria outro CRM.

O bridge deve retornar somente resultado sanitizado, obtido da resposta CRM validada:

```json
{"status":"cadastrado","confirmado_crm":true,"id_superlogica":"<se retornado pela API>"}
```

- HTTP 200/`ok` do webhook ou protocolo da planilha **não** confirma cadastro CRM.
- Falha comprovadamente anterior ao POST: `{"status":"nao_enviado","post_executado":false}` permite retry com backoff.
- Timeout/HTTP incerto/retorno desconhecido: `reconciliar`. Próxima chamada é `acao: consultar`, nunca novo POST automático.
- O workflow de leitura LEADS, indicado por `REALIZE_SUPERLOGICA_LEADS_WORKFLOW_ID` no n8n, usa sua própria credencial. Sem API/consulta confirmada, mantém `reconciliar` para revisão; não inventa endpoint ou suporte PUT/PATCH.
- Chave idempotente da escrita é o UUID estável do registro Harvest. Alias de entrada contém canal/protocolo. Telefone/e-mail convergentes reaproveitam a pessoa dentro da workspace e do imóvel; identificadores conflitantes exigem revisão.
- `lead_id_harvest` fica vinculado quando existe lead em `prospecta_leads`; formulários com e-mail apenas possuem o UUID do registro e seu protocolo, sem fabricar telefone/conversa.

## Homologação e ativação operacional

1. Revisar/aplicar migration 054 antes do código que escreve `mensagem_fisica_id`. Ela não cria contas, conecta números, altera secrets ou habilita IA/CRM. Restringe os vínculos Chatwoot a APIs server-side, já usadas pelo Harvest.
2. Selecionar **Figueira Marketing**, habilitada para os módulos necessários, e usar seu próprio canal de teste. No agente BDR, salvar piloto em simulação e configurar instrução imobiliária/IA da workspace. A UI não reaproveita canal/funil de outro cliente.
3. Homologação com envio exige allowlist de contatos controlados no piloto; o modo `homologacao` pela API só é aceito no slug `figueira-marketing`. Mantém também a whitelist de ambiente se a conta for marcada `teste`.
4. Configurar as novas variáveis server-side documentadas em `app/.env.example`, sem alterar credenciais protegidas. `BDR_N8N_WORKSPACES` autoriza o worker. `REALIZE_SUPERLOGICA_WORKSPACES` autoriza especificamente uso do bridge da Realize. Sem allowlists não há fallback para outra empresa.
5. Confirmar diretamente no Superlógica: imóvel válido, usuário/time de pré-atendimento Guilherme e resposta verdadeira do cadastro. Só então habilitar `crm_habilitado` e `responsavel_crm_confirmado` na configuração autorizada. Cadastro CRM não significa atribuição a corretor.
6. Homologar QR, entrada assinada, mensagem repetida/concorrente, texto/mídia, `fromMe`, envio manual, histórico, cinco cenários, quiet hours, consentimento, falha incerta e handoff. Se usar Chatwoot junto do transporte, vincular inbox ao canal explicitamente e confirmar que `source_id` corresponde ao ID físico WhatsApp; sem esse contrato não habilitar dois caminhos inbound para a mesma mensagem.
7. Operação por telefone fora do Harvest/Chatwoot exige assumir a conversa no Harvest primeiro: `fromMe` de transporte sozinho não distingue humano de eco do próprio bot. O bot não trata eco como nova resposta do lead.
8. Configurar a workspace Realize isolada e seu canal/funil próprios. Após evidência operacional, aprovação autorizada deve registrar `aprovado_por`, `aprovado_em`, `evidencia_homologacao` e pré-requisitos antes de alterar `modo` para `producao`. A constraint SQL impede modo produção sem aprovação; esta entrega não executa essa alteração.

Não importar/reabordar históricos nesta entrega. Formulários passam a ser registrados no CRM imediatamente pelo contrato de captura; a conversa BDR começa no inbound do canal conectado. Abordagem proativa de um formulário sem conversa não é fabricada como mensagem recebida: depende de consentimento/canal e política de primeiro contato aprovados.

### Matriz de aceite

| # | Implementação / evidência automatizada | Homologação externa pendente |
|---|---|---|
| 1 Isolamento | RLS, RPC server-only, validação canal/funil/lead, allowlists, resolução Chatwoot explícita; teste PostgreSQL | Conferência das contas/números reais |
| 2 Dedupe | unicidade inbound/física, captura transacional, lock e ledger; testes concorrentes do runtime e CRM | Repetir webhook real assinado |
| 3 Form → planilha → CRM | contrato captura/bridge/outbox/idempotência; conserva workflows | Conferir planilha, child, resposta CRM, CA0653_MMOL e Guilherme |
| 4 WhatsApp | APIs QR/HMAC existentes preservadas, sender compartilhado, saída gated | Pareamento do número Realize, mídia e transporte real |
| 5 BDR | interessado/frio/objeção/humano/opt-out cobertos sem rede externa, inclusive runtime real com adapters mockados | Revisão das respostas pela equipe |
| 6 Cadência | consentimento explícito, 4h/D+1/D+3/D+7, quiet hours, stop-on-reply, incerto sem retry cego | Validação operacional da cadência |
| 7 Handoff | UI/atribuição/envio manual pausam; CAS invalida turno; resumo e fatos visíveis | Corretor assumir na operação real |
| 8 Auditoria | fila e erro sanitizado, tentativas, flags de resultado incerto; testes de timeout | Reconciliação com API LEADS autorizada |
| 9 KPIs | agregação SQL por conta, atendimento, cadastro, qualificação, handoff, visita humana e falhas | Conferir com dados controlados |
| 10 Rollout | padrão simulação, API de homologação limitada, constraint de aprovação | Evidência Figueira Marketing → autorização Realize |

## Verificação local e rollback

Na pasta `app`: `npm ci`, `npm run test:bdr`, `npx tsc --noEmit`, `npm run build`.

Na raiz: `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/*.test.ts tests/*.test.js`.

Para controlar recursos, executar essas etapas uma por vez com `NODE_OPTIONS=--max-old-space-size=1024` e `UV_THREADPOOL_SIZE=1`. No build usar também `HARVEST_BUILD_CPUS=1`, opção explícita de `next.config.mjs` para limitar workers. O tracing do Next fica restrito à pasta `app`, evitando adotar lockfiles de outros projetos no diretório pai. O CI de revisão existente (`validar-agentes.yml`) inclui o teste BDR e os mesmos limites; não publica imagem nem faz deploy.

O teste SQL usa PostgreSQL via PGlite/WASM em memória, com schema mínimo fiel às colunas referenciadas e a migration real, sem conexão com produção. Testes de transporte/IA/CRM usam mocks; não comprovam entrega externa. PGlite é dependência somente de desenvolvimento. O runner com module mocks roda em processo separado do teste PostgreSQL/WASM, com execução serial do grupo SQL/política para limitar consumo local.

Três testes estáticos antigos de `crm-operacional.test.js` já falhavam no `HEAD` anterior (factory Twenty assíncrona, variável `numId`, opt-out com override). Foram atualizados para os contratos existentes e para a extração do sender compartilhado, preservando checks de tenant/opt-out/whitelist/conexão e acrescentando ordem de pausa antes do envio humano.

### Resultado da revalidação final — 2026-11-06

- Suíte geral: **60/60 testes aprovados**.
- `npm run test:bdr`: **14/14 aprovados**, incluindo migration PostgreSQL/WASM, execução real do orquestrador com adapters mockados, concorrência, histórico e resultado incerto.
- TypeScript do estado final: **aprovado**, com `tsc --noEmit --incremental false`; aproximadamente 6,3 segundos, máximo RSS 775 MiB.
- Build de produção do estado final: **aprovado**, com `HARVEST_BUILD_CPUS=1 npm run build`; aproximadamente 22,8 segundos, máximo RSS 879 MiB, 75 páginas estáticas geradas.
- Investigação antes da execução: a carga de um minuto havia caído de mais de 700 para aproximadamente 5; a memória permanecia comprimida. A lista de processos não tinha compiladores antigos do Harvest e mostrava consumo de aplicações desktop. A estratégia foi limitar heap/workers e rodar TypeScript, build, testes gerais e testes SQL/BDR sequencialmente. Nenhum processo de outro aplicativo foi encerrado; as medições das novas execuções reportaram zero swaps para os comandos medidos.
- Homologação externa, pareamento Realize e aprovação de produção continuam pendentes conforme a matriz acima. Conferência operacional n8n separada, usando a integração existente. Nenhum novo MCP, importação de workflow, merge, deploy ou habilitação de respostas reais foi executado nesta entrega de código.

Rollback operacional: desativar tick no n8n e retornar configuração BDR para `simulacao`/`crm_habilitado=false`; preservar filas/ledger e revisar saídas incertas antes de qualquer retomada. Não apagar o histórico. O rollback de código deve manter a migration aditiva para auditoria.
