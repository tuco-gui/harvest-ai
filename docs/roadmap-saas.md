# Harvest AI — de painel único a produto multi-cliente

Roadmap para transformar o painel atual em uma aplicação com login, contas
separadas por cliente e papéis de acesso, com a identidade da Figueira.

O painel que está em produção hoje (`/webhook/prospecta`) **continua no ar e
intocado** durante todo o percurso. A migração acontece só no fim, quando o
novo estiver validado.

> **Onde estamos (31/07/2026):** Fases 0 a 5 entregues e em produção em
> `harvest.figueiramarketing.com.br`. O que falta está na seção
> **O que vem agora**, no fim deste documento — comece por lá.

---

## Por que esta ordem

O risco que justifica começar por aqui não é hipotético: hoje qualquer pessoa
com o link abre o painel, vê e altera as chaves da SerpAPI e da Evolution, e
dispara em nome do número conectado. Não há como entregar isso a um cliente
sem que ele possa, sem querer, apagar a configuração ou queimar os créditos.

O agente de resposta dá mais valor imediato, mas trabalha em cima de uma base
que precisa ser refeita. Fazer o agente antes significa fazê-lo duas vezes.

---

## Arquitetura de destino

```
Navegador                    Vercel                  Supabase              n8n
──────────                   ──────                  ────────              ───
app.harvest...  ──login──►  Next.js  ──────────►  Auth + RLS
                             │
                             └──POST /api/busca──►  (lê conta do JWT)
                                                        │
                                                        ▼
                                              conta_credenciais ◄──── n8n lê
                                                                       daqui
                                                                        │
                                                                        ▼
                                                              SerpAPI / Evolution
```

**A mudança de fundo:** as chaves saem do navegador. Hoje elas vivem no
`localStorage` e viajam no corpo de cada requisição. Passam a viver no
Supabase, protegidas por RLS, e o n8n as busca pelo `conta_id`. O navegador
nunca mais vê uma chave.

**Stack:** Next.js na Vercel (mesmo caminho do dashboard da Ortega), Supabase
para auth e dados, n8n mantido como motor de automação.

> **Como ficou:** o app subiu no **VPS**, não na Vercel — o plano gratuito da
> Vercel não servia e o VPS já tinha Traefik e Swarm. A imagem é construída no
> GitHub Actions e publicada no ghcr.io, porque compilar Next.js no VPS estoura
> a memória. O n8n ficou só como ponte da SerpAPI: o disparo vai direto do
> Next.js para a Evolution, um sistema em vez de dois.

---

## Papéis

| Papel | Quem | Pode |
|---|---|---|
| `super_admin` | Figueira | Tudo, em todas as contas. Cria contas e usuários. |
| `admin` | Dono da empresa cliente | Gerencia usuários e configurações **da própria conta**. Vê e edita credenciais. |
| `operador` | Equipe do cliente | Busca, importa, seleciona e dispara. **Não vê nem edita credenciais, nem configurações de envio.** |

O papel `operador` é a resposta direta ao "ele pode detonar tudo": quem opera
no dia a dia não alcança nada que quebre.

---

## Fases

### ✅ Fase 0 — Trancar a porta (hoje, ~20 min)

Antes de qualquer código: proteger o painel atual com Basic Auth no n8n, para
que ele deixe de ser público enquanto o resto é construído.

**Entrega:** painel atual pedindo usuário e senha.
**Tamanho:** P

---

### ✅ Fase 1 — Fundação: banco e autenticação

**Pré-requisito no VPS:** habilitar login por e-mail no GoTrue
(`GOTRUE_EXTERNAL_EMAIL_ENABLED=true`) e desligar o cadastro público
(`GOTRUE_DISABLE_SIGNUP=true`). Usuários passam a ser criados só pelo painel de
super admin, já confirmados — assim não precisamos de SMTP agora. SMTP só será
necessário quando quisermos "esqueci minha senha" self-service; até lá, você
redefine a senha pelo painel.

Tabelas novas:

| Tabela | Papel |
|---|---|
| `contas` | Uma linha por empresa cliente: nome, slug, logo, ativo |
| `perfis` | Liga `auth.users` → `conta_id` → papel |
| `conta_credenciais` | SerpAPI, Evolution, OpenAI de cada conta |
| `conta_config_envio` | Modo, mensagens do rodízio, contexto, intervalos |

E `conta_id` entra em `prospecta_leads`, `prospecta_buscas` e
`prospecta_mensagens`, com RLS por conta em todas.

**Entrega:** banco pronto, RLS testada (provo que a conta A não lê a conta B),
seu usuário super admin criado.
**Tamanho:** M

---

### ✅ Fase 2 — Aplicação Next.js com a cara da Figueira

Login, e as telas que já existem hoje reconstruídas: busca no Maps, importação
de CSV, lista de leads, disparo, configurações.

Design seguindo os tokens da marca: Montserrat e Inter, fundo `#111111`,
superfície `#1A1A1A`, vermelho `#C4191F` como identidade e **verde `#1A7A4A`
para os botões de ação** — nunca vermelho em CTA, que é regra da marca.

> **Correção:** o padrão virou o claro (`#F5F5F5`), que é o que o brand board
> define para documento; o escuro é o modo de post e slide. Ficaram os dois,
> com um botão que começa seguindo o tema do sistema.

O menu de configurações que discutimos entra aqui já resolvido: seções de
Conexões, Mensagens e Envios, e Usuários, cada uma visível conforme o papel.

**Entrega:** app rodando em preview na Vercel, com login, fazendo tudo que o
painel atual faz.
**Tamanho:** G

---

### ✅ Fase 3 — Painel de super admin

Sua área: criar conta de cliente, criar os usuários dela, definir papéis,
ativar e desativar, e ver consumo por conta (buscas SerpAPI, disparos).

**Entrega:** você cria a conta da Guinffer pela tela, sem tocar no banco.
**Tamanho:** M

---

### ✅ Fase 4 — n8n multi-conta

Novo workflow, sem os webhooks de painel. Recebe `conta_id`, busca as
credenciais daquela conta no Supabase e usa. Um workflow atende todos os
clientes — acaba a duplicação por cliente.

O workflow atual continua ativo e intocado até esta fase estar validada.

**Entrega:** busca e disparo funcionando pelo app novo, com as chaves vindo do
banco.
**Tamanho:** M

---

### ✅ Fase 5 — Domínio e virada

Domínio próprio (ex.: `harvest.figueiramarketing.com.br`), migração dos dados
que já existem, e desligamento do painel antigo.

**Entrega:** cliente usando o app novo.
**Tamanho:** P

---

---

## O que vem agora

### Fase 6 — Conectar o número de WhatsApp pela tela

Hoje a conexão do WhatsApp é o único ponto do produto que não se resolve
sozinho: alguém da Figueira precisa criar a instância na Evolution por fora e
mandar ao cliente três campos técnicos — endereço, instância e token. Isso é o
que impede a entrega ser autônoma.

Como deve ficar, na aba **Conexões**:

1. Botão **Conectar número de WhatsApp**
2. O cliente dá um **nome à conexão** ("Comercial", "Loja Centro") — a palavra
   *instância* não aparece na tela em momento nenhum
3. Aparece o **QR Code**, ele lê pelo celular
4. A tela passa a mostrar **Conectado** com o número, e um botão de desconectar

Por trás, na API da Evolution:

| Passo | Chamada |
|---|---|
| Criar | `POST /instance/create` com `instanceName` e `integration: WHATSAPP-BAILEYS` |
| Pegar o QR | `GET /instance/connect/{nome}` — devolve `base64` do QR |
| Saber se conectou | `GET /instance/connectionState/{nome}` — `open` = conectado |
| Desconectar | `DELETE /instance/logout/{nome}` |

Detalhes que decidem se isso funciona ou vira suporte:

- O nome da instância na Evolution **não pode ser o que o cliente digitou** —
  dois clientes escolhem "Comercial" no mesmo dia. Use `{slug-da-conta}-{n}` e
  guarde o apelido bonito à parte, numa tabela `conta_conexoes`
  (`conta_id`, `apelido`, `instancia`, `numero`, `status`).
- O QR **expira em ~40 segundos**. A tela precisa buscar de novo sozinha, com
  um botão de gerar outro, senão vira chamado.
- A chave de admin da Evolution (`AUTHENTICATION_API_KEY`) fica no servidor,
  como variável de ambiente. Ela cria instâncias — **nunca** pode chegar ao
  navegador nem ficar em `conta_credenciais`.
- Enquanto isso não existe, seguimos na instância `Guilherme014`, que é a do
  Guilherme.

**Entrega:** o cliente conecta o próprio WhatsApp sem falar com ninguém.
**Tamanho:** M

---

### Fase 7 — Agente de resposta

Webhook recebendo `messages.upsert` da Evolution, memória em
`prospecta_mensagens` (a tabela já existe e já é preenchida no disparo), nó AI
Agent, e transferência para humano com resumo da conversa.

Depende da Fase 6: sem conexão gerenciada pelo app, não há como saber qual
webhook pertence a qual conta.

**Tamanho:** G

---

### Fase 8 — Os pendentes menores

- **Paginação da busca** — só traz 20; a rota já aceita `pagina`, falta o botão. **P**
- **Consumo por conta** — `prospecta_buscas` já registra tudo, falta a tela. **P**
- **Esqueci minha senha** — depende de SMTP no GoTrue. **P**
- **Enriquecimento** — ver `docs/enriquecimento.md`. **G**

---

## Riscos e coisas a decidir

**SerpAPI no plano gratuito.** 250 buscas/mês na conta atual. Com mais de um
cliente isso estoura em dias. Duas saídas: cada cliente traz a própria chave
(cadastrada na conta dele), ou a Figueira assina um plano pago e revende as
buscas. Isso é decisão comercial e **continua em aberto** — precisa estar
resolvida antes do segundo cliente.

**PostgREST self-hosted.** Toda tabela nova exige reiniciar o serviço `rest`,
senão `SELECT` funciona e `INSERT` devolve 404 mudo. Já documentado em
`sql/001_schema.sql`.

**SMTP.** Sem ele não há recuperação de senha self-service. Contornável na
Fase 1, mas vai incomodar quando houver vários operadores.

**Onde ficam as chaves dos clientes.** Guardadas em `conta_credenciais` com RLS
estrita e legíveis pela `service_role` do n8n. Isso protege de acesso por outro
cliente, mas quem tem a service key lê tudo. Criptografia em coluna é possível
e fica para depois — vale registrar que hoje não teremos.

---

## Por onde continuar

Fase 6. É a única coisa entre o produto de hoje e uma entrega em que o cliente
não depende de ninguém da Figueira para começar a usar.

Quem for continuar este trabalho: o estado atual, as credenciais e as
armadilhas já conhecidas estão em `ESTADO.md`, na raiz do projeto — fora do
git, na máquina do Guilherme.
