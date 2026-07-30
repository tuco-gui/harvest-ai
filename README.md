# Prospecta IA

Prospecção ativa B2B: busca empresas no Google Maps, valida quem tem WhatsApp, escreve
uma abordagem personalizada com IA e dispara pelo WhatsApp — tudo orquestrado por um
único workflow do n8n, com um painel web servido pelo próprio n8n.

```
Painel (HTML)  ──POST /prospecta-busca──►  n8n ──► SerpAPI (Google Maps)
                                            │      └─► Supabase: prospecta_buscas + prospecta_leads
                                            │
               ──POST /prospecta-whatsapp─►  n8n ──► Evolution API (valida números)
                                            │
               ──POST /<disparo>──────────►  n8n ──► scrape do site (r.jina.ai)
                                                   └─► OpenAI (3 mensagens)
                                                   └─► Evolution API (envia)
                                                   └─► Supabase: prospecta_mensagens
```

**Nenhuma chave de API vive no navegador.** O painel só conhece as URLs dos webhooks;
SerpAPI, Evolution e Supabase ficam nas credenciais do n8n.

## Estrutura

| Caminho | O que é |
|---|---|
| `painel/index.html` | Fonte da verdade do painel. Editar aqui, nunca dentro do n8n. |
| `n8n/prospecta-ia.json` | Workflow exportável, com placeholders no lugar das URLs. |
| `sql/001_schema.sql` | As três tabelas do Supabase. Idempotente. |
| `scripts/build-workflow.py` | Injeta o painel no workflow e resolve os placeholders. |
| `docs/enriquecimento.md` | Roadmap: de prospecção fria para prospecção quente. |
| `.env.example` | Variáveis necessárias. Copie para `.env` (que fica fora do git). |

## Setup do zero

### 1. Banco

Rode `sql/001_schema.sql` no SQL Editor do Supabase. Cria:

- **`prospecta_buscas`** — uma linha por chamada à SerpAPI. É o extrato de créditos.
- **`prospecta_leads`** — uma linha por empresa. `place_id` é UNIQUE: o mesmo lugar
  nunca entra duas vezes, mesmo aparecendo em várias buscas.
- **`prospecta_mensagens`** — histórico do que a IA gerou e do que foi enviado.

RLS fica ligado sem policy: só a `service_role` (usada pelo n8n) enxerga os dados.

### 2. Credenciais no n8n

Crie estas quatro antes de importar o workflow:

| Nome | Tipo | Conteúdo |
|---|---|---|
| `Supabase Figueira` | Supabase API | Host + **service_role key** |
| `SerpAPI` | Query Auth | Nome `api_key`, valor = sua chave da SerpAPI |
| `Evolution API` | Header Auth | Nome `apikey`, valor = chave da Evolution |
| `prospecta` | OpenAI API | Sua chave da OpenAI |

### 3. Workflow

```bash
cp .env.example .env       # preencha
python3 scripts/build-workflow.py --local
```

Isso gera `.local/prospecta-ia.local.json` com as URLs reais já substituídas — importe
esse arquivo no n8n. (Sem `--local`, o script só regenera o JSON versionado, com
placeholders `__SUPABASE_URL__`, `__EVOLUTION_URL__`, `__EVOLUTION_INSTANCE__`.)

Depois de importar: reaponte as quatro credenciais nos nós (o n8n marca as que não
reconhece) e ative o workflow.

### 4. Painel

Abra `<n8n>/webhook/prospecta`, clique na engrenagem e preencha as três URLs:

- **Busca** → `<n8n>/webhook/prospecta-busca`
- **Validação de WhatsApp** → `<n8n>/webhook/prospecta-whatsapp`
- **Webhook de disparo** → `<n8n>/webhook/<id do nó Webhook>`

## Editando o painel

`painel/index.html` é a fonte. Depois de mexer:

```bash
python3 scripts/build-workflow.py --local
```

e reimporte. Editar o HTML direto no n8n faz o repo e a produção divergirem.

## Detalhes que custam caro quando esquecidos

- **`type=search` é obrigatório** na SerpAPI com `engine=google_maps`. Sem ele a API
  devolve erro e a busca volta vazia sem dizer por quê.
- **Paginação é de 20 em 20** (`start=0,20,40…`). O parâmetro `num` é ignorado nesse engine.
- **Cada página de busca gasta 1 crédito** da SerpAPI. `prospecta_buscas` registra todas.
- **Lead sem `place_id` não é gravado** na busca — sem ele não há como deduplicar.
  Importação por CSV entra sempre como linha nova.
- O `Prefer: resolution=merge-duplicates` nos nós de gravação é o que transforma o
  INSERT em upsert. Tirar isso quebra a segunda busca do mesmo termo.

## Licença

Uso interno. O repositório é público para servir de referência — todas as chaves,
URLs internas e dados de cliente ficam fora dele.
