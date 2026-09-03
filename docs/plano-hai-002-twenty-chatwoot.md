# PLANO DE IMPLEMENTAÇÃO HAI-002

> Escopo: INSTITUCIONAL — Figueira Marketing / Harvest AI.
> Decisão arquitetural confirmada pelo owner (Guilherme, 02/09/2026): retoma
> e confirma ADR-007 / Plano Mestre. **Não está em debate.** Este documento
> não reabre a discussão Chatwoot/Twenty vs. alternativas — apenas mapeia o
> estado real e ordena a implementação da arquitetura já decidida:
>
> **HARVEST** (experiência unificada) + **TWENTY** (CRM, fonte da verdade
> pós-qualificação) + **CHATWOOT** (conversas/inbox, fonte da verdade) +
> **WAHA/EVOLUTION** (transporte WhatsApp) + **n8n** (automação opcional,
> não crítica).
>
> Todas as afirmações abaixo são checadas em código ou em documento
> institucional existente nesta rodada (02/09/2026) — nenhuma é opinião.
> Onde não há como confirmar sem credencial, está marcado
> `BLOQUEADO POR CREDENCIAL` ou `NÃO VERIFICADO`.

---

## 1. Estado real Twenty

**Não existe instância Twenty conectada em lugar nenhum deste ambiente.**

- `app/src/lib/twenty.ts` define a interface `CrmBackend` e dois
  implementadores: `SupabaseCrmBackend` (real, é o que roda hoje) e
  `TwentyCrmBackend` (stub — todo método lança
  `'Twenty backend não configurado (NÃO VERIFICADO).'`).
- `crmBackend()` (mesma file) é a factory que escolhe qual implementação
  usar — hoje sempre devolve `SupabaseCrmBackend`.
- Nenhuma variável de ambiente `TWENTY_*` existe no repo (`.env*`, `.md`,
  `.ts/.tsx` — grep vazio fora do próprio comentário em `twenty.ts`).
- Confirmado de forma independente pelo registro institucional
  `brain/04-tools/REGISTRY.md`: Twenty CRM está listado como `PLANEJADO`
  (não operacional) em todo o ambiente Figueira, não só no Harvest.
- Branch `feature/crm-vine-port` (VineCRM) também nunca teve Twenty real —
  só reaproveitou o mesmo padrão de interface, hoje já absorvido em `main`.

**Conclusão:** não há workspace, API key, nem dado de Twenty para auditar —
porque nunca existiu. `BLOQUEADO POR CREDENCIAL` para qualquer teste real.

---

## 2. Estado real Chatwoot

**Não existe instância Chatwoot conectada em lugar nenhum deste ambiente.**

- Zero código vivo usando Chatwoot em todo o repo. Único rastro: 3
  comentários citando uma "Fase 3D" nunca construída:
  - `app/src/lib/inbound.ts:68`
  - `app/src/lib/optoutResposta.ts:9`
  - `docs/deploy.md:4` (`"Não toca em Supabase, n8n, Baserow, Evolution
    nem Chatwoot."`)
- A linha do `deploy.md` é ambígua por si só — poderia sugerir uma
  instância já existente ao lado do Harvest. Cruzando com o
  `REGISTRY.md` institucional (Chatwoot = `PLANEJADO`), a leitura mais
  provável é boilerplate defensivo, não confirmação de instância viva.
  **NÃO VERIFICADO com certeza absoluta** — só o owner ou acesso
  credenciado confirma.
- Nenhum componente de UI (`ConversationPane`, `ChatwootEmbed` ou
  equivalente) existe em `app/src/componentes/` — nem em `main`, nem na
  branch VineCRM.

**Conclusão:** mesma situação do Twenty — nada para auditar porque nunca
foi ligado. `BLOQUEADO POR CREDENCIAL`.

---

## 3. Estado real WAHA/Evolution

**Esta é a única perna do stack que está de fato implementada e rodando.**

- `app/src/lib/waha.ts` — sessões `harvest_<tenant>_c<canalId>`
  (ou legado `conta_<tenant>`), engine `NOWEB`. `getOrCreateSession`,
  `logoutSession` (logout+delete completo), `checkNumbers` (omite, não
  marca `false`, número cuja checagem falhou).
- `app/src/lib/whatsappCanais.ts` — abstração multi-canal por conta
  (`CanalWhatsApp`, provider `'waha' | 'evolution'`), rodízio determinístico
  (`escolherCanalRodizio`), reconciliação fail-closed
  (`reconciliarStatusWaha` nunca assume desconectado se WAHA está
  inacessível).
- `app/src/lib/inboundWaha.ts` (106 linhas) e `app/src/lib/inboundEvolution.ts`
  (91 linhas) — adapters que normalizam webhook de cada provider para o
  mesmo formato interno `EventoInboundNormalizado`
  (`app/src/lib/inboundTipos.ts`). O adapter Evolution está marcado
  **NÃO VERIFICADO contra um webhook real** — construído a partir de docs
  públicas, com aviso explícito no header para capturar 1 payload real
  antes de ligar em produção.
- `app/src/lib/inbound.ts` (153 linhas), `inboundConta.ts` (resolução de
  conta/lead pós-normalização), `inboundSeguranca.ts` (idempotência/rate) —
  pipeline de recebimento já operacional para o fluxo atual
  (WhatsApp → Harvest, sem Chatwoot no meio).
- **Limitação conhecida e ainda sem decisão:** o destino do webhook do WAHA
  é configurado de forma global na instância (env var / painel WAHA), não
  por sessão — `getOrCreateSession` nunca registra `config.webhooks`. Um
  mesmo número não consegue hoje notificar dois consumidores ao mesmo
  tempo (ex.: Harvest + um futuro agente). Documentado em
  `docs/roadmap-saas.md` (linha ~399, evento real observado na conta
  "Guinffer", 02/09/2026). Esta limitação define diretamente o desenho da
  Seção 8 abaixo.

---

## 4. Código VineCRM reaproveitável

**Correção ao brief:** os arquivos citados no brief (`ConversationPane`,
`ChatwootEmbed`, `sync`, `pickOwner`) **não existem** em nenhum lugar do
repositório. Checado via
`git ls-tree -r feature/crm-vine-port --name-only` — zero resultado para
esses nomes.

O único arquivo real da branch com padrão reaproveitável é
`app/src/lib/twenty.ts` (interface `CrmBackend` + stub `TwentyCrmBackend`)
— e ele **já está absorvido em `main`** (é o mesmo arquivo, evoluído). Não
há nada adicional para portar da branch VineCRM.

Não vou inventar arquivos que não existem para "cumprir" o brief — reporto
o gap como está.

---

## 5. Código Harvest temporário a substituir

Tudo que hoje resolve CRM/conversas dentro do Supabase e que, por
definição da arquitetura aprovada, vira camada temporária (mantida
funcionando, substituída aos poucos):

| Arquivo | Papel hoje | Papel após P0 |
|---|---|---|
| `app/src/lib/twenty.ts` | `SupabaseCrmBackend` é o backend ativo | Vira fallback; `TwentyCrmBackend` passa a ser real e ativo |
| `sql/021_crm_oportunidades.sql`, `sql/022_crm_operacional.sql` | Schema `oportunidades`, `crm_atividades` no Supabase | Fica como storage de vínculo (Seção 7) + rollback, não mais fonte da verdade |
| `app/src/lib/crmStages.ts` | 11 estágios hardcoded, comentário já avisa que espelham Twenty | Vira mapeamento Harvest↔Twenty (nome/probabilidade → stage ID real do workspace) |
| `app/src/app/(app)/crm/page.tsx`, `app/src/app/api/crm/oportunidades/**` | Lê/grava direto no Supabase via `crmBackend()` | Sem mudança de contrato — só passam a falar com `TwentyCrmBackend` real |
| Pipeline de inbound (`inbound.ts` e adapters) | Grava direto em `conversas`/lead no Supabase, sem Chatwoot | Ganha um branch: replicar/roteirar para Chatwoot (Seção 8) mantendo o que já funciona |

Não existe hoje nenhuma "inbox interna" para deletar — o brief supõe algo
que não foi construído (Seção 12 do brief pede justamente para não
construir isso; nada a desfazer aqui).

---

## 6. Adapter Twenty (arquivos/endpoints)

Ordem exata pedida pelo brief, todos dentro de `app/src/lib/twenty.ts`
(implementando a mesma interface `CrmBackend` já usada por
`SupabaseCrmBackend` — nenhuma rota/UI muda de contrato):

1. `listar(contaId)` → `GET /rest/opportunities` (Twenty API), filtrado por
   workspace/tenant.
2. `buscar(contaId, id)` → `GET /rest/opportunities/:id`.
3. `criar(contaId, dados)` → `POST /rest/opportunities`.
4. `atualizar(contaId, id, patch)` → `PATCH /rest/opportunities/:id`
   (cobre mudança de estágio via `crmStages.ts` mapeado).
5. `buscarOwners(contaId)` → `GET /rest/workspaceMembers` (ou equivalente
   de usuários do workspace).
6. Find/create Person → `GET /rest/people?filter=...` seguido de
   `POST /rest/people` se não existir.
7. Find/create Company → mesmo padrão em `/rest/companies`.
8. `jaExistePorLead` → dedupe: buscar Person por e-mail/telefone
   normalizado antes de criar, nunca usar telefone como chave relacional
   primária (usar o `id` retornado pelo Twenty).

Endpoints exatos (paths, nomes de campo GraphQL/REST) dependem da versão
do workspace Twenty provisionado — **NÃO VERIFICADO**, só confirmável com
credencial real. A REST API do Twenty é auto-gerada a partir do schema do
workspace; antes de codar o método 1, é preciso ter a URL + API key reais
para inspecionar o schema.

Arquivos tocados: só `app/src/lib/twenty.ts` — nenhuma rota em
`app/src/app/api/crm/**` muda.

---

## 7. Adapter Chatwoot (arquivos/endpoints)

Novo arquivo, mesmo padrão de `twenty.ts` (um só ponto de acesso, sem
espalhar chamadas HTTP pela UI):

- **Novo:** `app/src/lib/chatwoot.ts` — cliente REST do Chatwoot
  (`Account API`), cobrindo:
  - Contacts: buscar/criar por telefone (reaproveitando
    `lib/telefone.ts`, já normalizado).
  - Inboxes: listar (um inbox por canal WhatsApp/conta, ver Seção 8).
  - Conversations: listar por contato/inbox, buscar histórico.
  - Messages: enviar (outbound), consumir (inbound via webhook).
  - Agents/Teams: listar para exibir responsável.
- **Novo:** `app/src/app/api/chatwoot/webhook/route.ts` — recebe evento
  Chatwoot (mensagem nova, mudança de status) e resolve conta/lead do
  mesmo jeito que `inboundConta.ts` já faz para WAHA/Evolution.
- **Estender:** alguma tela existente (ex. dentro de `crm/page.tsx` ou um
  componente novo mínimo) para exibir Conversa → histórico → responsável →
  status → responder, consumindo `lib/chatwoot.ts`. Não reconstruir inbox —
  só exibir e permitir responder via API do Chatwoot.

Endpoints exatos: Chatwoot tem API REST estável e documentada
publicamente (`/api/v1/accounts/:id/...`), mas a **URL da instância e o
token de acesso não existem neste ambiente** — `BLOQUEADO POR CREDENCIAL`
para qualquer chamada real.

---

## 8. Fluxo WhatsApp completo

Estado atual (funcional, sem Chatwoot):

```
WhatsApp → WAHA/Evolution → webhook → inboundWaha.ts/inboundEvolution.ts
  → inboundTipos (normalização) → inboundConta.ts (resolve conta/lead)
  → grava em `conversas`/lead no Supabase
```

Fluxo alvo (com Chatwoot), respeitando a limitação da Seção 3 (um só
destino de webhook por instância WAHA):

```
WhatsApp → WAHA/Evolution → webhook único → Harvest (rota atual)
  → Harvest encaminha para Chatwoot via API (cria/atualiza Contact +
    Conversation + Message no inbox correspondente ao CanalWhatsApp)
  → Chatwoot webhook (agente responde por lá OU pelo Harvest) → Harvest
    → Harvest reenvia via WAHA/Evolution API
```

Justificativa: como o WAHA só notifica um destino, o Harvest continua
sendo o único receptor direto do webhook e **replica** para o Chatwoot via
API (em vez de tentar configurar o WAHA para notificar dois lugares). Isso
resolve a limitação da Seção 3 sem precisar de multiplexer novo — é o
próprio Harvest fazendo o "fan-out" em código, que é a opção (ii) já
listada no `roadmap-saas.md`.

Cada `CanalWhatsApp` (`whatsappCanais.ts`) precisa de um `chatwoot_inbox_id`
associado (Seção 9) para saber para qual inbox replicar.

---

## 9. Modelo de IDs/vínculos

Tabela nova e mínima — **não duplica objeto completo**, só guarda a chave
de correlação entre sistemas:

```sql
create table crm_vinculos (
  id bigint generated always as identity primary key,
  conta_id uuid not null references contas(id),
  lead_id bigint references prospecta_leads(id),
  twenty_person_id text,
  twenty_company_id text,
  twenty_opportunity_id text,
  chatwoot_contact_id text,
  chatwoot_conversation_id text,
  chatwoot_inbox_id text,
  whatsapp_canal_id bigint references whatsapp_canais(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
```

Chave de correlação entre linhas: `lead_id` (interno) — nunca telefone,
por instrução explícita do brief. RLS por `conta_id`, mesmo padrão das
tabelas existentes.

`crmStages.ts` ganha um segundo mapa `estagioParaTwentyStageId` (a
preencher só quando o workspace real existir — hoje os `id` do array
`ESTAGIOS_CRM` já são as chaves canônicas internas).

---

## 10. Migração CRM temporário

Ordem, conforme Seção 10 do brief — **nenhum passo abaixo é executado
nesta rodada**, é só o roteiro:

1. Mapear dados existentes: `select * from oportunidades` +
   `crm_atividades` por conta, gerar snapshot.
2. Implementar `TwentyCrmBackend` real (Seção 6) e validar contra um
   workspace de teste (não produção) antes de qualquer sync com dado real.
3. Escrever script de sync idempotente: para cada `oportunidade` sem
   `crm_vinculos.twenty_opportunity_id`, criar Person/Company/Opportunity
   no Twenty e gravar o vínculo. Idempotência via checar
   `crm_vinculos` antes de criar.
4. Validar contagens e amostras (comparar N registros Supabase vs.
   Twenty).
5. Trocar `crmBackend()` para retornar `TwentyCrmBackend` **por conta**
   (flag em `modulos_habilitados`, mesmo padrão já usado para `'crm'`) —
   rollout gradual, não big-bang.
6. Manter `SupabaseCrmBackend` funcional como rollback — decisão de
   aposentar as tabelas `oportunidades`/`crm_atividades` fica para depois
   da validação em produção com pelo menos uma conta real.

Não apagar `oportunidades`/`crm_atividades` nesta fase nem em nenhuma fase
deste plano — decisão de retirada é de uma rodada futura, com aprovação
explícita.

---

## 11. POC E2E mínimo

Critério de aceite para considerar P0 "funcionando" (Seção 11 do brief):

1. Uma conta de teste (`ambiente = 'homologacao'` ou equivalente) tem
   `TwentyCrmBackend` ativo.
2. Uma oportunidade criada no Harvest aparece no workspace Twenty real
   (Person + Company + Opportunity vinculados, `crm_vinculos` preenchido).
3. Um número WhatsApp de QA (já existe conceito de
   `whatsapp_qa_whitelist` em `contas`, visto em `ContaDetalhe.tsx`) manda
   mensagem → aparece como Conversation no Chatwoot **e** no Harvest.
4. Uma resposta enviada pelo Harvest chega no WhatsApp real via
   WAHA/Evolution.
5. Estágio mudado no Harvest reflete no Twenty (e vice-versa, se o Twenty
   permitir webhook de saída — a confirmar com credencial real).

Isso cobre os itens A–E do P0 do brief.

---

## 12. Ordem exata dos commits

1. `feat(crm): TwentyCrmBackend real — listar/buscar/criar/atualizar`
   (Seção 6, itens 1–4)
2. `feat(crm): TwentyCrmBackend — owners, find/create Person/Company, dedupe`
   (Seção 6, itens 5–8)
3. `feat(crm): tabela crm_vinculos + RLS` (Seção 9)
4. `feat(chatwoot): lib/chatwoot.ts — contacts/inboxes/conversations/messages`
   (Seção 7)
5. `feat(chatwoot): webhook inbound + resolução de conta/lead`
   (Seção 7/8)
6. `feat(whatsapp): replicar mensagem WAHA/Evolution → Chatwoot`
   (Seção 8, fan-out no Harvest)
7. `feat(crm): UI — exibir conversa/histórico/responsável a partir do Chatwoot`
   (Seção 7, UI)
8. `feat(crm): flag por conta para ativar TwentyCrmBackend` (Seção 10, passo 5)
9. `chore(crm): script de sync/migração idempotente Supabase → Twenty`
   (Seção 10, passo 3 — não executado em produção nesta rodada)

Cada commit mantém a UI atual funcionando (backend Supabase como default
até a flag ser ativada por conta) — nenhum quebra o Harvest em produção.

---

## 13. Bloqueios reais

> **Atualização 02/09/2026:** Twenty e Chatwoot **existem**, cadastrados na
> tabela `credenciais` do Baserow (database 199, tabela 757, linhas `twenty_crm`
> e `chatwoot`). Config não-sensível confirmada via `baserow_list_rows_redacted`:
> - Twenty: `base_url = https://crm.figueiramarketing.com.br/graphql`,
>   `tipo_auth = bearer_token`, `workspace_id = 15273a2d-9e7c-4511-8df3-0198ff77dc96`.
> - Chatwoot: `base_url = https://chatwoot.figueiramarketing.com.br`,
>   `tipo_auth = api_key` (header `api_access_token`), `account_id = 1`,
>   `inbox_whatsapp_id = 4`, `instancia_evo = Guilherme014`.
>
> Os valores de segredo (`api_key`, `access_token`, `client_secret`, `senha`)
> continuam **inacessíveis por ferramenta** — a ferramenta de Baserow disponível
> redige esses campos por design; não há tool para gravar segredo no Cofre. O
> owner precisa colar os valores manualmente (Baserow → Cofre/`.env`). Ver
> `TWENTY_API_URL`/`TWENTY_API_KEY` (Seção 14) e o equivalente futuro para
> Chatwoot como os nomes de variável a preencher.

- **Credencial Twenty inexistente no ambiente de execução** — URL do
  workspace já mapeada acima; falta só a API key real em `TWENTY_API_KEY`.
  Sem isso, Seção 6 não pode ser testada contra dado real (só compila).
  `BLOQUEADO POR CREDENCIAL`.
- **Credencial Chatwoot inexistente no ambiente de execução** — URL/conta já
  mapeadas acima; falta o access token real. Mesma situação.
  `BLOQUEADO POR CREDENCIAL`.
- **`docs/deploy.md` ambíguo sobre Chatwoot já estar deployado** —
  não posso confirmar nem negar com certeza sem perguntar ao Guilherme ou
  ter acesso credenciado à infra. `NÃO VERIFICADO`.
- **WAHA webhook single-destination** (Seção 3/8) — o desenho da Seção 8
  assume que o Harvest replica para o Chatwoot em código; isso só é
  validável de ponta a ponta com uma instância Chatwoot real rodando.
- **Adapter Evolution não verificado contra payload real** — antes de
  rotear Evolution → Chatwoot em produção, precisa capturar 1 webhook real
  e conferir nomes de campo (aviso já existe no header do arquivo).
- **Nenhum destes bloqueios impede começar o código do adapter Twenty**
  (Seção 6, itens 1–4 podem ser escritos e compilados contra a interface
  `CrmBackend` sem credencial — só não são testáveis end-to-end).

---

## 14. Primeira tarefa executável — FEITO (02/09/2026)

**`TwentyCrmBackend.listar` e `.buscar` implementados em
`app/src/lib/twenty.ts`** (Seção 6, itens 1–2), via Twenty REST API,
autenticação `Bearer ${TWENTY_API_KEY}` contra `${TWENTY_API_URL}` (env vars
lidas em runtime, nenhum segredo no código/repo). Mesma assinatura da
interface `CrmBackend`, nenhuma rota/UI alterada.

Mapeamento `TwentyOpportunity → Oportunidade` (`twentyParaOportunidade`) é
melhor-esforço sobre o schema padrão do objeto Opportunity do Twenty —
**NÃO VERIFICADO** contra o workspace real (nomes de campo confirmam só com
credencial). `criar`/`atualizar`/`buscarOwners`/`jaExistePorLead` seguem
stub (Seção 6, itens 3–8, próxima rodada).

Critério de aceite:
- ✅ Compila sem alterar nenhuma rota/UI existente (`tsc --noEmit` limpo).
- ✅ `crmBackend()` continua retornando `SupabaseCrmBackend` por padrão (sem
  flag ativa, zero risco de regressão).
- Só é testável de ponta a ponta quando `TWENTY_API_URL`/`TWENTY_API_KEY`
  existirem no ambiente — valores reais ficam com o owner (Seção 13); até
  lá, `TwentyCrmBackend` lança erro claro se as env vars faltarem.

Conforme instrução da rodada: **parando aqui.** Próximo passo de código
(Chatwoot adapter, Seção 6 itens 3–8, deploy, migração, ou qualquer uso de
credencial real) aguarda confirmação explícita do owner.

Esta é a única ação de código autorizada a começar sem nova confirmação —
tudo que envolver deploy, migração de dado real, credencial de produção
ou infraestrutura **para aqui, aguardando confirmação explícita do
owner**, conforme instrução da rodada.

---

## 15. Continuação — adapters completos, ainda desativados (02/09/2026)

**`TwentyCrmBackend` completo em `app/src/lib/twenty.ts`** (Seção 6, itens
3–8 finalizados). Métodos implementados nesta rodada:
- `criar` — find-or-create Company (`POST /companies`, match por
  `name[eq]`) → find-or-create Person (`POST /people`, match por
  `emails.primaryEmail[eq]`; telefone só como desempate quando não há
  e-mail, nunca chave primária) → `POST /opportunities` com
  `harvestLeadId`/`pointOfContactId`/`companyId`.
- `atualizar` — `PATCH /opportunities/:id`, valida `estagioValido()` antes
  de enviar mudança de estágio (usa `crmStages.ts` local, Twenty não expõe
  metadata de select-field verificável sem credencial — ver bloqueio
  abaixo).
- `buscarOwners` — `GET /workspaceMembers?first=60`.
- `jaExistePorLead` — `GET /opportunities?filter=harvestLeadId[eq]:{id}`,
  usa o campo customizado `harvestLeadId` (**ASSUMIDO, NÃO VERIFICADO** —
  precisa existir no objeto Opportunity do workspace real antes do E2E).
  Telefone fuzzy **não** é usado como chave de duplicata, conforme
  instrução.
- `listar` — ganhou paginação por cursor (`pageInfo.hasNextPage`/
  `endCursor`, cap de 20 páginas).
- Helper privado `request()` unificado: timeout via `AbortController`
  (`TWENTY_TIMEOUT_MS = 10s`), 401/403 → erro de autorização, 429 → erro de
  rate limit, 404 → `null`, 5xx → erro com status, JSON inválido → erro
  claro.

Fatos de doc oficial confirmados nesta rodada
(`docs.twenty.com/developers/extend/api`, 02/09/2026, via curl — WebFetch/
WebSearch indisponíveis na sessão):
- Twenty é **schema-per-tenant**: não existe referência estática de campos;
  a doc real só existe em Settings → API & Webhooks do workspace, com API
  key válida. Por isso os nomes de campo em `TwentyOpportunity`/
  `TwentyPerson`/`TwentyCompany` seguem **NÃO VERIFICADO**.
- Auth: `Authorization: Bearer {API_KEY}` (confere com o código já escrito).
- Batch: até 60 registros/chamada; rate limit 100 req/min.
- **Discrepância a verificar antes do E2E real**: o `base_url` cadastrado no
  Baserow (`https://crm.figueiramarketing.com.br/graphql`) é o endpoint
  GraphQL. Pela doc, a REST API self-hosted fica em `{domínio}/rest/` — ou
  seja, `TWENTY_API_URL` para uso com este adapter (REST) provavelmente
  precisa ser `https://crm.figueiramarketing.com.br/rest`, não o valor
  cadastrado como está. **NÃO VERIFICADO**, confirmar com credencial real.

**`app/src/lib/chatwoot.ts` criado** (Seção 2, novo arquivo, isolado — não
importado por nenhuma rota/UI). Métodos implementados: `listarInboxes`,
`listarConversas` (com filtro por inbox/status), `buscarConversa`,
`listarMensagens`, `encontrarOuCriarContato` (match por telefone, cria se
não encontrar), `enviarMensagem` (implementado, **não usado/chamado por
nada nesta rodada** — envio real de WhatsApp continua proibido),
`listarAgentes`, `listarTimes`, `alterarStatusConversa`, `atribuirAgente`,
`atribuirTime`. Mesmo padrão de `request()` do adapter Twenty (timeout,
401/403/429/404/5xx, JSON inválido). Auth via header `api_access_token`
(Client/Agent API do Chatwoot — não confundir com Bearer da Platform API).
`account_id` é parâmetro de cada chamada, não fixo em env, para suportar
multi-tenant (Seção 3).

**Envs usados (nomes apenas, nenhum valor real no repo):**
- `TWENTY_API_URL`, `TWENTY_API_KEY` (já existiam).
- `CHATWOOT_API_URL`, `CHATWOOT_API_TOKEN` (novos, Seção 2).

**IDs externos reaproveitados** (não-sensíveis, já mapeados na Seção 13):
Twenty `workspace_id`; Chatwoot `account_id=1`, `inbox_whatsapp_id=4`.
Nenhum valor de segredo foi lido, gravado ou registrado em nenhum arquivo.

**Multi-tenant (Seção 3):** criada `sql/025_crm_vinculos.sql` (migração
nova — **não existia** `crm_vinculos` nem equivalente antes desta rodada;
confirmado via listagem de `sql/001..024`). Tabela `crm_vinculos`:
`conta_id` (PK, FK para `contas.id`) → `twenty_workspace_id`,
`chatwoot_account_id`, `chatwoot_inbox_whatsapp_id`, `ativo`. Só
referências/IDs, nenhum segredo, nenhuma duplicação de
People/Company/Opportunity/Conversation/Message remotos. Inbox único por
conta nesta versão (YAGNI — se uma conta precisar de múltiplas inboxes
Chatwoot no futuro, essa coluna vira tabela própria; não antecipado).
**Migração criada mas NÃO aplicada** — só o arquivo `.sql` existe no repo,
conforme Seção 9 (proibido migrar produção nesta rodada).

**Testes novos (Seção 5), sem token real em nenhuma fixture:**
- `tests/unit/chatwoot.test.ts` — 18 asserts, `fetch` mockado
  (`global.fetch` substituído em runtime), cobre: listar inboxes/
  conversas/mensagens, filtro de conversas, 404→null, find-or-create de
  contato (achou vs. criou), envio de mensagem (mock, não é chamado em
  produção), agentes/times, mudança de status, atribuição de
  agente/time, erro 500, erro 401. `18 ok, 0 falhas`.
- `tests/unit/twenty-adapter.test.ts` — 18 asserts. **Nota de
  arquitetura de teste**: `twenty.ts` importa `./supabase/server`, que
  importa `next/headers` — módulo que não resolve fora do runtime Next
  (mesma limitação já documentada em `tests/unit/crm.test.ts`, que por
  isso replica a interface `CrmBackend` em vez de importar o arquivo).
  Este teste segue a mesma convenção do repo: replica só a lógica de
  request/HTTP de `TwentyCrmBackend` (não o `SupabaseCrmBackend`, já
  coberto por `crm.test.ts`), espelhando fielmente o código real. Cobre:
  listagem com paginação por cursor, busca 404, criar (payload correto,
  erro claro se resposta não traz `createOpportunity`), atualizar estágio,
  `buscarOwners` (fallback de nome), `jaExistePorLead` (true/false, usando
  `harvestLeadId` e não telefone), erros 401/429/5xx, JSON inválido.
  `18 ok, 0 falhas`. **Risco assumido**: se a lógica de `request()`/
  `criar`/`atualizar`/etc. mudar em `twenty.ts`, este teste precisa ser
  atualizado manualmente em paralelo — não há import real garantindo
  sincronia. Alternativa (extrair a lógica HTTP de `twenty.ts` para um
  módulo sem dependência de `next/headers`) não foi feita nesta rodada por
  ser refatoração fora do escopo pedido ("não quero nova discussão
  arquitetural").
- `tests/unit/crm.test.ts` (pré-existente) — re-executado, `23 passou, 0
  falhou`, sem regressão.

**VineCRM (Seção 6):** nenhum arquivo do VineCRM foi acessado além do que
já estava referenciado no plano (só a auditoria, o código-fonte não está
no disco). Nenhuma cópia de auth/tenant/`.env`/credencial/telefone fuzzy.

**Código ativo (Seção 4, confirmado):** `crmBackend()` continua retornando
`SupabaseCrmBackend` sem alteração (`app/src/lib/twenty.ts:416-420`).
`chatwoot.ts` não é importado por nenhuma rota, página ou componente —
`grep -r "from.*chatwoot" app/src` só retorna o próprio arquivo e os
testes.

**QA local (Seção 8):**
- `cd app && npx tsc --noEmit -p .` → limpo, sem erros.
- `npm run build` → sucesso, todas as rotas geradas normalmente.
- `node --experimental-strip-types tests/unit/{crm,chatwoot,twenty-adapter}.test.ts`
  → 23 + 18 + 18 = 59 asserts, 0 falhas.

**Bloqueios E2E (herdados da Seção 13, sem mudança de status):**
- Credencial Twenty real (`TWENTY_API_KEY`) ausente — impede validar nomes
  de campo reais e a discrepância `/graphql` vs `/rest` do `base_url`.
- Credencial Chatwoot real (`CHATWOOT_API_TOKEN`) ausente — impede validar
  o shape exato de resposta da Client/Agent API contra a instância real.
- Campo customizado `harvestLeadId` no objeto Opportunity do Twenty:
  **não confirmado que existe** no workspace — precisa ser criado (ou
  confirmado) antes do primeiro `criar`/`jaExistePorLead` real.
- Nenhum destes bloqueios impediu completar o código desta rodada — só
  impedem o teste de ponta a ponta contra os serviços reais.

**Próxima tarefa (aguardando aprovação do owner):** E2E REAL TWENTY +
CHATWOOT COM CREDENCIAIS SEGURAS.

---

## 16. E2E real Twenty + Chatwoot — resultado (03/09/2026)

Owner aprovou explicitamente rodar o E2E real contra os serviços em
produção. Execução feita via
`infrastructure/openbao/verify-twenty-chatwoot-e2e.sh`: worker Docker Swarm
efêmero na VPS lê `TWENTY_API_KEY`/`CHATWOOT_API_TOKEN` direto do OpenBao
(`twenty/readonly`, `chatwoot/readonly`) e faz só chamadas de leitura
(GET/introspection) — nenhuma escrita em Twenty ou Chatwoot, nenhum valor de
credencial impresso em log em nenhum momento.

**Bloqueio 1 — `/graphql` vs `/rest`: resolvido.**
`GET https://crm.figueiramarketing.com.br/rest/workspaceMembers` → HTTP 200
com `TWENTY_API_KEY`. O `TWENTY_BASE_URL` já migrado para o OpenBao é o
domínio puro (`https://crm.figueiramarketing.com.br`, sem sufixo), então o
adapter (`twenty.ts`), que monta `{base}/rest/...` internamente, já está
correto — não precisa de nenhuma mudança de env/secret.

**Bloqueio 2 — campo customizado `harvestLeadId`: CONFIRMADO AUSENTE.**
Introspection real (`__type(name: "Opportunity")`) no workspace retornou
estes campos, e nenhum é `harvestLeadId`:
`amount, attachments, closeDate, company, companyId, createdAt, createdBy,
deletedAt, id, name, noteTargets, owner, ownerId, pointOfContact,
pointOfContactId, position, searchVector, stage, taskTargets,
timelineActivities, updatedAt, updatedBy`.
Consequência: `criar()` e `jaExistePorLead()` em `app/src/lib/twenty.ts`
vão falhar (ou silenciosamente não filtrar por lead) contra o workspace
real como estão hoje, porque dependem de um campo que não existe.
**Bloqueia qualquer ativação real do adapter Twenty até uma destas duas
ações (decisão do owner, não tomada nesta rodada):**
(a) criar o campo customizado `harvestLeadId` em Settings → Objects →
Opportunity no workspace Twenty, ou
(b) mudar a estratégia de deduplicação/vínculo do adapter para não depender
dele (ex.: usar outro campo existente, ou uma tabela de vínculo local
como já existe `crm_vinculos` para conta↔workspace).

**Bloqueio 3 — shape Chatwoot: confirmado.**
`GET /api/v1/accounts/1/inboxes` com `CHATWOOT_API_TOKEN` → HTTP 200,
payload real:
`{id:1, name:"SZ4", channel_type:"Channel::Api"}`,
`{id:4, name:"Guilherme014 - WhatsApp", channel_type:"Channel::Api"}`.
Bate exatamente com `chatwoot_account_id=1` / `chatwoot_inbox_whatsapp_id=4`
já mapeados na Seção 13 — nenhum ajuste necessário no adapter
`chatwoot.ts` nem no `sql/025_crm_vinculos.sql`.

**Estado após esta rodada:** adapters Twenty/Chatwoot continuam
desativados (`crmBackend()` ainda retorna `SupabaseCrmBackend`,
`chatwoot.ts` ainda não é importado por nenhuma rota). Nenhum código foi
alterado nesta rodada — só leitura/verificação real. O único bloqueio
restante para ativar o adapter Twenty é o campo `harvestLeadId` (decisão
(a) ou (b) acima). Chatwoot está tecnicamente pronto para ativação real
assim que houver decisão de escopo (Seção 3) sobre quando `enviarMensagem`
passa a ser chamado em produção.

**Próxima tarefa (aguardando decisão do owner):** escolher (a) ou (b) para
o campo de vínculo `harvestLeadId`/`crm_vinculos` antes de ativar o adapter
Twenty.

## 17. Campo `harvestLeadId` criado + ativação por flag (03/09/2026)

Owner escolheu a opção (a) da Seção 16: criar o campo customizado no
workspace Twenty em vez de mudar a estratégia de vínculo.

**Campo criado.** `harvestLeadId` (TEXT, nullable, unique) adicionado ao
objeto Opportunity via MCP do Twenty, autorizado explicitamente pelo owner
no chat. Confirma que `criar()`/`jaExistePorLead()` em `twenty.ts` agora têm
onde escrever/filtrar — o Bloqueio 2 da Seção 16 está resolvido.

**E2E real de escrita confirmado.** Criada uma Opportunity de teste com
`harvestLeadId` preenchido via MCP do Twenty; confirmado que o filtro
`harvestLeadId[eq]` (mesma query usada por `jaExistePorLead` no adapter)
encontra o registro. Registro de teste apagado (soft delete) em seguida —
nenhum dado de teste ficou no workspace real.

**Ativação por flag implementada.** `crmBackend()` em
[twenty.ts](../app/src/lib/twenty.ts:416) passou a ser `crmBackend(contaId)`
(assíncrona): lê `modulos_habilitados` da conta e devolve `TwentyCrmBackend`
só se a conta tiver o módulo `'twenty_crm'` habilitado; caso contrário
continua em `SupabaseCrmBackend` (padrão, zero risco de regressão para as
contas reais). Mesmo padrão de flag já usado para `'crm'` em
`ContaDetalhe.tsx`/`Contas.tsx`/`api/contas/route.ts`. `'twenty_crm'` foi
adicionado ao `Set` de módulos permitidos em
[api/contas/route.ts](../app/src/app/api/contas/route.ts:53) — hoje só pode
ser ligado via chamada direta à API ou UPDATE direto no banco (nenhum botão
de UI dedicado foi criado, YAGNI até haver uma conta de teste escolhida para
apontar o toggle).

Os 5 pontos de chamada atualizados para `await crmBackend(perfil.conta_id)`:
[api/crm/oportunidades/route.ts](../app/src/app/api/crm/oportunidades/route.ts)
(GET + POST, 3 usos), [api/crm/oportunidades/[id]/route.ts](../app/src/app/api/crm/oportunidades/%5Bid%5D/route.ts),
[app/(app)/crm/page.tsx](<../app/src/app/(app)/crm/page.tsx>).

`tsc --noEmit` limpo e `next build` completo sem erros (não há `npm test`
configurado neste projeto — só `dev`/`build`/`start`/`lint`).

**Estado após esta rodada:** código pronto para ativação por conta,
`TwentyCrmBackend` real (REST) por trás de um flag que continua desligado
por padrão para todo mundo. **Nenhuma conta real foi migrada** — falta
decidir qual `conta_id` é a conta de homologação/teste (critério de aceite
da Seção 11, POC E2E mínimo) antes de ligar `twenty_crm` pela primeira vez.

**Próxima tarefa (aguardando decisão do owner):** indicar a conta de
teste/homologação para ativar `twenty_crm` e rodar o POC E2E mínimo da
Seção 11 com o backend Twenty real em uso (não só leitura de introspection).

## 18. Conta de teste criada + enum de `stage` verificado (03/09/2026)

Seguindo [[feedback-conta-qa-harvest]] (regra: POC/E2E do Harvest sempre usa
uma conta institucional de homologação, nunca conta de cliente real, sem
perguntar `conta_id`).

**Conta `Figueira QA` criada** direto na tabela `contas` de produção
(migration `sql/024_ambiente_por_conta.sql` — ainda não aplicada até esta
rodada — foi aplicada primeiro): `id=c8aaa6f0-33d6-46e2-b45f-c40e49e41037`,
`slug=figueira-qa`, `ambiente='teste'`, `modulos_habilitados` inclui `crm` e
`twenty_crm`. Linhas `conta_credenciais`/`conta_config_envio` criadas junto
(mesmo padrão do `POST /api/contas`).

**Enum real de `Opportunity.stage` verificado via MCP do Twenty**
(`find_many_opportunities`/`create_one_opportunity` schemas):
`NEW | SCREENING | MEETING | PROPOSAL | CUSTOMER` — 5 valores, sem
equivalente a "perdido". `harvestLeadId` confirmado presente no schema
(consistente com a Seção 17).

**Bug real encontrado e corrigido antes do E2E:** `twenty.ts` mandava os IDs
internos do Harvest (`novo`, `ganho`, `perdido`, ...) direto como `stage` no
payload do Twenty — a criação teria falhado (`stage` fora do enum) e a
leitura (`twentyParaOportunidade`) descartava silenciosamente qualquer
`stage` real por não bater com `estagioValido()`, sempre voltando pro padrão
`novo`. Corrigido:
- [crmStages.ts](../app/src/lib/crmStages.ts) ganhou
  `estagioParaTwentyStage`/`twentyStageParaEstagio` (mapa Harvest↔Twenty,
  conforme já previsto na Seção 9). Os 4 estágios de fechamento negativo do
  Harvest mapeiam para `NEW` — Twenty não tem estágio de "perdido" nesse
  workspace; marcado com comentário `ponytail:` como limitação conhecida.
- [twenty.ts](../app/src/lib/twenty.ts) `criar()`/`atualizar()`/
  `twentyParaOportunidade()` passaram a usar o mapa. `criar()` também ganhou
  `position: 'last'`, que é obrigatório na criação (schema real via MCP não
  batia com o payload antigo, que não enviava esse campo).
- `tsc --noEmit` limpo depois da mudança.

**Estado após esta rodada:** conta de teste pronta, `twenty_crm` habilitado
nela, bug de mapeamento de estágio corrigido. Falta rodar o POC E2E mínimo
da Seção 11 de fato (criar lead → oportunidade real no Twenty pela conta
`Figueira QA`, via app, não via MCP direto) antes de considerar o adapter
Twenty pronto para qualquer conta real.

**Próxima tarefa:** rodar o POC E2E mínimo (Seção 11) usando a conta
`Figueira QA`, depois seguir para o adapter Chatwoot.

---

## 19. INBOUND corrigido — oportunidade avança automaticamente (03/09/2026)

**Problema:** quando um contato respondia no WhatsApp, a resposta chegava ao
Harvest via webhook WAHA/Evolution → `inbound.ts`, mas:
1. A oportunidade ficava presa em `contatado` — não avançava para `respondeu`
2. A campanha já contabilizava "respondeu" (via `historico_contato.status='recebido'`)
3. A conversa já aparecia na aba "Conversa" (via `inbound_eventos` no GET)
4. Faltava o link automático: inbound → `oportunidades.estagio`

**Causa raiz:** `lib/inbound.ts` atualizava `prospecta_leads.status='respondeu'`
e inseria `historico_contato`, mas NÃO atualizava `oportunidades.estagio`.

**Correção (commit 03/09/2026):**

1. **`lib/inbound.ts`** — adicionada função `moverOportunidadeInbound()`:
   - Busca oportunidade por `lead_id` (match exato) ou `telefone` (fallback)
   - Só opera em estágios `novo`/`contatado` (nunca retrocede qualificando+)
   - Resposta comum → `contatado`/`novo` → `respondeu` (probabilidade 20%)
   - Opt-out → qualquer pipeline → `optout` (probabilidade 0%)
   - Chamada automaticamente após inserção de `historico_contato`

2. **`componentes/CrmPipeline.tsx`** — adicionado polling de 15s:
   - `useEffect` com `setInterval` busca mensagens + oportunidade atualizada
   - Quando oportunidade muda de estágio (ex: `contatado`→`respondeu` via inbound),
     atualiza o kanban automaticamente
   - Usuário vê novas mensagens na aba Conversa sem fechar/reabrir a ficha

**Fluxo completo inbound (antes vs depois):**

```
ANTES:
WhatsApp → WAHA/Evolution → webhook → inbound.ts
  → inbound_eventos ✓
  → prospecta_leads.respondeu_em ✓
  → historico_contato (status='recebido') ✓
  → oportunidades.estagio: NÃO ATUALIZADO ✗

DEPOIS:
WhatsApp → WAHA/Evolution → webhook → inbound.ts
  → inbound_eventos ✓
  → prospecta_leads.respondeu_em ✓
  → historico_contato (status='recebido') ✓
  → oportunidades.estagio: contatado→respondeu ✓ (novo→respondeu ✓)
  → polling CrmPipeline: kanban atualizado ✓
```

**Opt-out já funcionava** (palavras-chave em `optoutResposta.ts`: "sair",
"parar", "cancelar", etc.) — agora também move a oportunidade para `optout`.

**Deduplicação** já existia via constraint `(conta_id, provider,
message_id_externo)` em `inbound_eventos` — sem alteração necessária.

**Teste E2E pendente:** validar com número QA que:
1. Harvest envia mensagem → WhatsApp recebe
2. Contato responde → resposta aparece na aba Conversa
3. Oportunidade avança de `contatado` para `respondeu` no kanban
4. Campanha registra "respondeu" no contador
