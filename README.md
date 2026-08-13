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
| `sql/001_schema.sql` | Leads, buscas e mensagens (schema original, sem conta). |
| `sql/002_multitenant.sql` | Contas, perfis, papéis, credenciais por conta e RLS. |
| `sql/003_perfil.sql` | Foto de perfil (`avatar_url` + bucket `avatares`). |
| `sql/004_perfil_e_sistema.sql` | Telefone e senha provisória no perfil; config do sistema (SMTP). |
| `sql/005_ia_provedores.sql` | Troca `openai_key` fixo por `ia_provedor` + `ia_key` (múltiplos provedores). |
| `sql/006_ia_modelo.sql` | Campo de modelo de IA customizável por conta. |
| `sql/007_campanhas.sql` | Campanhas: agrupam leads de uma leva de prospecção com nome e funil. |
| `sql/008_conversas.sql` | Chamados de suporte (`conversas` + `conversa_mensagens`). |
| `scripts/sql.sh` | Roda SQL no Supabase sem abrir o Studio. |
| `docs/roadmap-saas.md` | O que já foi feito e o que vem — histórico fase a fase. |
| `docs/deploy.md` | Como sobe no VPS. |
| `docs/enriquecimento.md` | De prospecção fria para prospecção quente. |
| `n8n/prospecta-ia.json` | Workflow da versão anterior (painel único no n8n). |
| `painel/index.html` | Painel da versão anterior. Mantido como referência. |

A versão anterior continua funcionando para quem quiser só o n8n. O produto
novo é o `app/`. Os arquivos SQL são numerados na ordem em que devem rodar —
todos idempotentes, dá para rodar de novo sem medo.

## Banco de dados

Postgres via Supabase self-hosted. Todas as tabelas de dado de cliente têm
RLS (row level security): cada conta só enxerga as próprias linhas, exceto o
`super_admin`, que enxerga todas. Isso é a segunda camada de proteção — a
primeira é o servidor nunca aceitar `conta_id` vindo do navegador.

### Multi-conta e usuários

| Tabela | Colunas principais | Papel |
|---|---|---|
| `contas` | `id`, `nome`, `slug`, `ativo` | Uma linha por empresa cliente. |
| `perfis` | `id` (= `auth.users.id`), `conta_id`, `papel`, `nome`, `email`, `telefone`, `avatar_url`, `senha_provisoria` | Estende o usuário do Supabase Auth. `conta_id` nulo só para `super_admin`. `papel` é `super_admin` \| `admin` \| `operador`. |
| `conta_credenciais` | `conta_id` (PK), `serpapi_key`, `evolution_url`/`instancia`/`key`, `ia_provedor`, `ia_key`, `ia_modelo` | As chaves de cada cliente. Só `admin`/`super_admin` leem. |
| `conta_config_envio` | `conta_id` (PK), `modo`, `mensagens` (jsonb), `contexto`, `intervalo_min`/`max` | Como e com que ritmo a conta dispara. |
| `config_sistema` | singleton (`id=1`), `smtp_*` | Configuração de infraestrutura do sistema inteiro — não é por conta. |

### Prospecção

| Tabela | Colunas principais | Papel |
|---|---|---|
| `prospecta_campanhas` | `id`, `conta_id`, `nome`, `origem`, `encontradas`, `com_whatsapp` | O nome que o cliente dá a uma leva de busca/planilha/manual. |
| `prospecta_leads` | `id`, `conta_id`, `campanha_id`, `place_id` (dedupe), `empresa`, `telefone`, `tem_whatsapp`, `especialidades`, `rating`, `status` | Uma linha por empresa encontrada ou importada. |
| `prospecta_buscas` | `id`, `conta_id`, `termo`, `ll`, `total_resultados` | Uma linha por chamada à SerpAPI — controla crédito gasto. |
| `prospecta_mensagens` | `id`, `conta_id`, `lead_id`, `direcao`, `conteudo`, `status`, `erro` | O que foi gerado/enviado para cada lead, e o motivo quando falha. |

### Suporte

| Tabela | Colunas principais | Papel |
|---|---|---|
| `conversas` | `id`, `conta_id`, `assunto`, `categoria`, `status`, `prazo_sla`, `respondido_em` | Um chamado de suporte. Schema pensado para virar chat interno da equipe do cliente também (`tipo`), sem precisar mudar tabela. |
| `conversa_mensagens` | `id`, `conversa_id`, `autor_id`, `conteudo` | As respostas da thread. |

## Como funciona por dentro

```
navegador → Next.js  → Supabase  (auth, contas, leads, credenciais)
                     → SerpAPI   (via ponte no n8n, por causa de CORS)
                     → Evolution (direto, para enviar e validar WhatsApp)
                     → IA        (direto, no modo "A IA escreve" — Groq,
                                   Gemini, Ollama Cloud, OpenAI ou Claude)
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

## Código

Next.js 15, App Router, TypeScript. Cada página é um Server Component que
busca os dados (via `supabaseAdmin()`, ignorando RLS de propósito — quem
decide o que cada um vê é o código, checando `perfilAtual()`) e passa pronto
para um componente `'use client'` que cuida da interação.

```
app/src/
├── app/
│   ├── entrar/page.tsx              login
│   ├── (app)/                       tudo que exige sessão — o layout aqui
│   │   │                            chama perfilAtual() e barra quem não
│   │   │                            está logado, e trava a navegação
│   │   │                            inteira se senha_provisoria for true
│   │   ├── page.tsx                 Prospecção (busca, mapa, planilha, manual, disparo)
│   │   ├── campanhas/page.tsx       funil por campanha
│   │   ├── configuracoes/page.tsx   conexões, mensagens, tempo de envio, erros
│   │   ├── usuarios/page.tsx        usuários da conta ativa
│   │   ├── contas/page.tsx          CRUD de conta (só super_admin)
│   │   ├── equipe/page.tsx          usuários da agência (só super_admin)
│   │   ├── sistema/page.tsx         SMTP (só super_admin)
│   │   ├── chamados/                lista + page.tsx / [id]/page.tsx (thread)
│   │   ├── status/page.tsx          saúde da ferramenta
│   │   └── perfil/page.tsx          foto, nome, telefone, e-mail, senha
│   └── api/                         uma pasta por rota; nome do arquivo é sempre route.ts
│       ├── busca/                   ponte pra SerpAPI (o navegador não fala com ela direto)
│       ├── disparo/                 envia UMA mensagem — o navegador chama em loop
│       ├── validar/                 confere WhatsApp de uma leva de telefones
│       ├── cep/                     geocodifica CEP (ViaCEP + Nominatim)
│       ├── campanhas/                cria/atualiza campanha
│       ├── conversas/                chamados de suporte + [id]/mensagens
│       ├── usuarios/                 criar, remover, gerar senha nova
│       ├── contas/                   criar, renomear, excluir conta
│       ├── perfil/                   dados, senha, foto (avatar/route.ts)
│       ├── configuracoes/            salva credenciais e regra de envio
│       ├── testar/                   testa cada integração sem gastar crédito
│       └── sistema/smtp/             configura e testa o SMTP do sistema
├── componentes/                     um `'use client'` por página, mesmo nome
├── lib/
│   ├── supabase/server.ts           perfilAtual() — a função mais importante do
│   │                                 projeto: deriva quem é o usuário e qual conta
│   │                                 ele enxerga a partir da sessão, nunca do cliente
│   ├── supabase/browser.ts          cliente Supabase pro navegador (login, sair)
│   ├── ia.ts                        adaptador dos 5 provedores de IA atrás de uma função só
│   ├── email.ts                     envio via SMTP (nodemailer)
│   └── senha.ts                     regra de senha forte + senha provisória previsível
└── middleware.ts                    renova a sessão a cada request e redireciona
                                       quem não está logado para /entrar
```

**A regra que atravessa o projeto inteiro:** o navegador manda a *intenção*
("buscar", "disparar", "criar usuário"), nunca um dado sensível como
`conta_id` ou uma chave. O servidor sempre deriva a conta da sessão verificada
(`perfilAtual()`) e só então decide o que fazer. Confiar no que vem do
navegador — mesmo que pareça inofensivo — é a categoria de bug mais cara de
um sistema multi-cliente.

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
5. **Busca** — `/api/busca` chama a SerpAPI direto do servidor (Next.js API
   route), sem intermediário. Não precisa de n8n nem de `N8N_WEBHOOK_BUSCA`
   (essa ponte existia só no painel HTML antigo, que rodava no navegador e
   esbarrava em CORS — o backend atual não tem essa limitação; decisão
   registrada em 2026-08-13, ver `00_ADMIN/RELATORIO_ENTREGAS.md`).
6. **Chaves do cliente** — entram pela tela, em Configurações → Conexões:
   SerpAPI, Evolution (endereço, instância e token) e a IA de sua escolha
   (Groq, Gemini, Ollama Cloud, OpenAI ou Claude). Ficam em
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

Login com sessão e guarda de rota · três papéis, com navegação separada por
escopo (Contas, Usuários da conta, Equipe da agência, Sistema) · senha
provisória com troca obrigatória no primeiro login · SMTP configurável pela
tela, com convite e reset de senha por e-mail · perfil com foto, nome,
telefone e e-mail editáveis · busca no Google Maps com validação de WhatsApp
e filtro por raio real (com aviso pra abrir o raio quando acha pouco) · mapa
com localização por clique ou CEP, disponível antes da busca · importação de
CSV · adicionar contato manualmente · IA com escolha de provedor (Groq,
Gemini, Ollama Cloud, OpenAI, Claude) e teste que gera mensagem de exemplo de
verdade · disparo real com pausar e parar, e log de erro por lead · mensagem
fixa, rodízio ou IA · presets de intervalo, aplicados de verdade no disparo ·
campanhas nomeáveis com funil (encontradas, com WhatsApp, enviadas, erro) ·
página de status da ferramenta · chamados de suporte com SLA · testes de
conexão que não gastam crédito · tema claro e escuro.

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
5. **Consumo por período** — campanhas já mostram o funil por leva; falta
   agregar por mês.
6. **"Esqueci minha senha" self-service** — hoje quem esqueceu pede pro admin
   clicar em "Gerar nova senha" em Usuários; com SMTP configurado dá pra
   trocar por um link de recuperação de verdade.
7. **Chat interno da equipe do cliente e notificação de chamado por e-mail** —
   o schema de chamados (`conversas`/`conversa_mensagens`) já foi desenhado
   pra isso, faltam só as telas.

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
