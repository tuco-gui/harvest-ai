# Harvest AI

Prospecção ativa B2B: busca empresas no Google Maps ou importa uma planilha,
confere quem tem WhatsApp, escreve a abordagem (fixa, em rodízio ou com IA) e
dispara em ritmo controlado para não queimar o número.

Multi-cliente: cada empresa é uma **conta** com as próprias chaves, leads e
usuários. Uma conta nunca enxerga a outra.

> Este repositório é público de propósito — dá para clonar e usar. Nenhuma
> chave, URL interna ou dado de cliente entra aqui. Onde as credenciais ficam
> está descrito abaixo, sem os valores.

## Estrutura

| Caminho | O que é |
|---|---|
| `app/` | A aplicação Next.js 15 (App Router). É o produto. |
| `sql/001_schema.sql` | Tabelas de leads, buscas e mensagens. Idempotente. |
| `sql/002_multitenant.sql` | Contas, perfis, credenciais e as políticas de RLS. |
| `scripts/sql.sh` | Roda SQL no Supabase sem abrir o Studio. |
| `docs/roadmap-saas.md` | O que já foi feito e o que vem. |
| `docs/deploy.md` | Como sobe no VPS. |
| `docs/enriquecimento.md` | De prospecção fria para prospecção quente. |
| `n8n/prospecta-ia.json` | Workflow da versão anterior (painel único no n8n). |
| `painel/index.html` | Painel da versão anterior. Mantido como referência. |

A versão anterior continua funcionando para quem quiser só o n8n. O produto
novo é o `app/`.

## Como funciona por dentro

```
navegador → Next.js  → Supabase  (auth, contas, leads, credenciais)
                     → SerpAPI   (via ponte no n8n, por causa de CORS)
                     → Evolution (direto, para enviar e validar WhatsApp)
                     → OpenAI    (direto, no modo "A IA escreve")
```

A regra que sustenta a segurança: **o navegador nunca vê uma chave.** O front
chama `/api/*` com o pedido; o servidor deriva a conta da sessão verificada —
nunca do corpo da requisição — e usa a chave daquela conta.

O laço de disparo roda no navegador, uma chamada por lead, com o intervalo
entre elas. É isso que faz Pausar e Parar valerem de verdade: parar é
simplesmente não chamar de novo.

## Papéis

| Papel | Pode |
|---|---|
| `super_admin` | Tudo, em todas as contas. Cria contas e usuários. |
| `admin` | Gerencia usuários, chaves e mensagens **da própria conta**. |
| `operador` | Busca, importa, seleciona e dispara. Não alcança credenciais. |

O bloqueio do operador é aplicado na tela **e** na rota — esconder o botão não
é permissão.

## Subindo do zero

1. **Banco** — rode `sql/001_schema.sql` e depois `sql/002_multitenant.sql`.
   Em Supabase self-hosted, garanta `PGRST_DB_CHANNEL_ENABLED=true` no serviço
   `rest`; sem isso, tabela nova dá `SELECT` normal e `INSERT` com 404 mudo.
2. **Auth** — no GoTrue: `GOTRUE_EXTERNAL_EMAIL_ENABLED=true` e
   `GOTRUE_DISABLE_SIGNUP=true`. Usuários só nascem pelo painel, já confirmados
   (sem SMTP não haveria e-mail de convite).
3. **Primeiro usuário** — crie um `super_admin` pelo Studio ou pela API admin,
   com `user_metadata` contendo `papel: "super_admin"`.
4. **App** — copie `app/.env.example` para `app/.env.local`, preencha, e
   `cd app && npm install && npm run dev`.
5. **Ponte da busca** — a SerpAPI não aceita chamada direta do navegador
   (CORS). Suba um webhook no n8n que só repassa a chamada e aponte
   `N8N_WEBHOOK_BUSCA` para ele.
6. **Chaves do cliente** — entram pela tela, em Configurações → Conexões:
   SerpAPI, Evolution (endereço, instância e token) e OpenAI. Ficam em
   `conta_credenciais`, uma linha por conta.

## Onde ficam as credenciais

Nenhuma no git. Elas vivem em três lugares:

- `.env` na raiz (fora do git) — as chaves de operação da agência
- `app/.env.local` (fora do git) — o que o app precisa para subir
- `conta_credenciais` no Supabase — as chaves de cada cliente, que o app lê
  em tempo de execução

Se você clonou este repositório: `app/.env.example` lista as variáveis
necessárias.

## Publicar

`git push` em `app/**` dispara o build da imagem no GitHub Actions
(`.github/workflows/imagem.yml`). O build **não** roda no VPS de propósito:
compilar Next.js pede 1,5–3 GB de RAM em pico. Depois do build:

```bash
docker service update --image ghcr.io/<org>/harvest-ai:latest --force harvest_harvest
```

Detalhes em `docs/deploy.md`.

## O que já funciona

Login com sessão e guarda de rota · três papéis · painel de contas e usuários ·
busca no Google Maps com validação de WhatsApp · importação de CSV · mapa com
pino de região · disparo real com pausar e parar · mensagem fixa, rodízio ou
IA · presets de intervalo · testes de conexão que não gastam crédito · tema
claro e escuro.

## O que falta

1. **Conectar o WhatsApp pela tela (QR Code).** Hoje alguém precisa criar a
   instância na Evolution por fora e colar URL, instância e token. O certo é o
   cliente clicar em "Conectar número", dar um nome à conexão, ler o QR e
   pronto. Endpoints: `POST /instance/create`,
   `GET /instance/connect/{nome}` (devolve o QR),
   `GET /instance/connectionState/{nome}`.
2. **Agente de resposta.** O fluxo é de mão única: quando o lead responde,
   ninguém escuta. Falta o webhook de `messages.upsert`, memória da conversa
   (a tabela `prospecta_mensagens` já existe e já é preenchida no disparo) e
   transferência para humano com resumo.
3. **Paginação da busca.** Só traz a primeira página de 20. A rota já aceita
   `pagina`; falta o botão.
4. **Enriquecimento** — ver `docs/enriquecimento.md`.
5. **"Esqueci minha senha"** — depende de SMTP no GoTrue. Hoje o super admin
   redefine.
6. **Consumo por conta** — `prospecta_buscas` já registra cada busca; falta a
   tela.

## Detalhes que custam caro quando esquecidos

- **Telefone precisa do DDI 55.** Sem ele a Evolution responde `exists: false`
  e todo lead vira "sem WhatsApp".
- **Paginação da SerpAPI é de 20 em 20** (`start=0,20,40…`). O parâmetro `num`
  é ignorado no engine `google_maps`. Cada página gasta 1 crédito.
- **RLS que barra devolve 204, não 403.** O PostgREST vê zero linhas e reporta
  sucesso. Use `Prefer: return=representation` e confira o array, nunca o
  status.
- **Importação por CSV**: só CSV (no Excel, "Salvar como → CSV UTF-8"). O
  botão "Baixar modelo" gera o arquivo com os cabeçalhos certos. Colunas que o
  sistema não reconhece não são descartadas — viram contexto para a IA.

## Licença

Uso interno da Figueira Marketing. O repositório é público para servir de
referência e poder ser duplicado.
