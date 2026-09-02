# Harvest AI — de painel único a produto multi-cliente

Roadmap para transformar o painel atual em uma aplicação com login, contas
separadas por cliente e papéis de acesso, com a identidade da Figueira.

O painel que está em produção hoje (`/webhook/prospecta`) **continua no ar e
intocado** durante todo o percurso. A migração acontece só no fim, quando o
novo estiver validado.

> **Onde estamos (31/07/2026):** Fases 0 a 5, 8b e 9b entregues. Falta um
> restart do serviço `rest` no Supabase para as duas últimas levas
> funcionarem de verdade em produção — ver o aviso no topo do `ESTADO.md`.
> O que falta de feature está na seção **Por onde continuar**, no fim deste
> documento.

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

### ✅ Fase 8b — Perfil, senha provisória, SMTP, contas e prospecção por modos

Entregue em 31/07/2026, fora de ordem porque resolvia dor imediata (usuário
convidado sem conseguir entrar, sem jeito de excluir uma conta de teste).

- Senha provisória previsível (`NomeDaEmpresa1234`) em vez de aleatória, com
  troca obrigatória no primeiro login — mínimo 8, maiúscula, minúscula,
  número, caractere especial
- SMTP configurável pela tela (Contas → só super admin), com teste; convite e
  reset de senha saem por e-mail sozinhos quando configurado
- Perfil (`/perfil`): foto, nome, telefone, e-mail, senha — para qualquer papel
- Contas: editar (renomear) e excluir, com os usuários do Auth removidos junto
- Prospecção: mapa disponível **antes** da busca (clique ou CEP via ViaCEP +
  Nominatim), aba de importar planilha, aba de adicionar contato manualmente,
  botão "Limpar lista"
- Corrigido: o intervalo de envio configurado agora é o que o disparo usa de
  verdade (antes ficava sempre em 30–60s fixo, ignorando o preset escolhido)

**Não fiz**, por ficar fora do pedido direto: um dropdown de verdade no menu
"Prospecção" do topo (virou abas dentro da página — mesmo resultado, menos
mexida) e recuperação de senha 100% self-service por link (o "gerar nova
senha" do admin já cobre o caso, e um link de recuperação é mais fácil de
montar agora que o SMTP existe, se quiser depois).

---

### ✅ Fase 9b — Reestruturação: navegação, campanhas, erros, status, chamados

Entregue em 31/07/2026 (mesmo dia da 8b), por pedido explícito: a estrutura
antiga misturava conta de cliente, usuário e configuração de sistema numa
página só, e isso estava atrapalhando o dia a dia.

- **Navegação separada**: `/contas` (só CRUD de conta) · `/usuarios`
  (usuários da conta ativa) · `/equipe` (usuários da agência, só super
  admin) · `/sistema` (SMTP e infra, só super admin)
- **Campanhas** (`/campanhas`): busca, planilha ou lista manual vira uma
  campanha nomeável, com funil (encontradas, com WhatsApp, enviadas, erro).
  Corrigido de brinde: `prospecta_leads.tem_whatsapp` nunca era persistido
  de verdade
- **Log de erros por conta** — aba nova em Configurações
- **Status** (`/status`) — banco, SMTP, e as integrações da conta ativa
- **Chamados de suporte com SLA** (`/chamados`) — abrir, responder, fechar,
  reabrir, prazo de 4h. Schema (`conversas`/`conversa_mensagens`) desenhado
  genérico de propósito, pra virar chat interno da equipe do cliente depois

**Não fiz**, por pedido explícito de focar primeiro no suporte: chat interno
entre a equipe do próprio cliente (schema já suporta, falta só a tela) e
notificação de chamado por e-mail (SMTP já existe, é rápido de ligar depois).
"Quem respondeu" na campanha continua impossível até a Fase 7 (agente de
resposta) existir.

---

### ✅ Fase 9c — Enriquecimento de lead: decisor, LinkedIn e e-mail

Entregue em 01/08/2026, depois de analisar dois workflows n8n de referência
(Kipflow e Playbook Lab — ver `docs/enriquecimento.md` item 6) e comparar as
alternativas gratuitas sugeridas contra a documentação real de cada API antes
de escolher.

- **Perplexity** (`sonar-reasoning-pro`) acha o nome do sócio/decisor cruzando
  nome+endereço na web aberta — não depende do lead ter site nem CNPJ em mãos
  de antemão (era a limitação da Kipflow)
- **Serper** acha o LinkedIn pessoal (busca restrita a `linkedin.com/in/`)
- **Anymail Finder** acha e **valida** o e-mail corporativo por nome+domínio
- Tudo sob demanda por lead, botão "Enriquecer" na lista de resultados —
  nunca automático, mesmo padrão de custo controlado do crédito de SerpAPI
- `lib/enriquecimento.ts` segue o mesmo desenho de `lib/ia.ts`: uma função por
  capacidade, chamador decide o que mostrar no erro

**Não fiz**, por decisão explícita de escopo: seletor multi-provedor por
capacidade (ex.: trocar Perplexity por CNPJ.ws) — só um provedor pago por
etapa por enquanto, igual o padrão de `ia_provedor` cobre depois se algum
cliente pedir. Score/temperatura (item 4 do `enriquecimento.md`) e reviews
como gancho (item 1) continuam não construídos.

---

### ✅ Fase 9d — Campanha navegável, lead expansível, duplicado avisado

Entregue em 02/08/2026, por reclamação direta do Guilherme depois de testar o
enriquecimento na prática: campanha era uma folha morta (clicar não levava a
lugar nenhum), o dado enriquecido sumia depois de aparecer uma vez, e buscar o
mesmo termo três vezes no mesmo dia criava três campanhas com os mesmos leads,
sem avisar nada.

- **Linha expansível** (Prospecção e dentro da campanha): "ver detalhes" abre
  todos os dados agregados daquele lead — empresa, endereço, telefone, site,
  categoria, CNPJ, decisor, LinkedIn, e-mail — num painel só, em vez de sumir
  depois do resultado inline.
- **`/campanhas/[id]`**: clicar numa campanha agora abre a lista de leads
  dela, com seleção, "Enriquecer selecionados" e "Disparar selecionados"
  (dispara sequencial, respeitando o intervalo configurado em Configurações
  → Tempo de envio) — a campanha deixou de ser só um número na tabela.
- **Duplicado não rouba mais campanha antiga.** O bug real: toda busca criava
  uma campanha nova, e o `upsert` por `place_id` reescrevia `campanha_id` do
  lead pra campanha nova — a mesma empresa "sumia" de uma campanha e
  reaparecia em outra, silenciosamente. Agora um lead que já existe só tem os
  dados atualizados (rating, telefone, WhatsApp); `campanha_id` não é mais
  tocado. A tela marca esses leads como "Já está em [campanha]" e ganha um
  botão **Excluir duplicados**.
- **Histórico de pesquisas** em Prospecção, usando `prospecta_buscas` (já
  existia, só não aparecia) — mostra termo/quando/resultados/novos, e avisa
  em cima da caixa de busca quando o termo digitado já foi buscado antes.
- **Corrigido de brinde**: quando o provedor do decisor era Perplexity sem
  chave cadastrada, a etapa era pulada sem gerar aviso nenhum — por isso
  "decisor não encontrado" aparecia pra tudo, sem pista do motivo real. Os
  avisos de enriquecimento agora aparecem na tela e ficam salvos em
  `prospecta_leads.erro_enriquecimento`, somados ao log de erros de disparo
  na mesma aba de Configurações.

**Não fiz**: telefone pessoal do decisor (nenhum provedor configurado hoje
faz isso; Apollo.io tem `reveal_phone_number`, dá pra ligar depois se pedir).

**Atualização (02/08/2026) — a Fase 9d só valia pra busca do Google Maps.**
O Guilherme notou: planilha e entrada manual nunca tiveram `place_id` (só o
Google Maps dá isso), e por causa disso nada do que foi construído na 9d
funcionava pra elas — sem enriquecer, sem duplicado avisado, sem persistir
antes do disparo. Corrigido: `lib/leads.ts` extraiu a lógica de
novos/duplicados da busca pra um lugar só; `gerarPlaceIdSintetico()` cria um
id estável (`csv:<conta>:<telefone>` / `manual:<conta>:<telefone>`,
escopado por conta pra não colidir entre clientes); nova rota
`/api/leads/importar` persiste planilha e manual **no momento da
importação**, não só no disparo. Com isso os três (busca, planilha, manual)
passam a ter exatamente o mesmo tratamento.

**Mais duas pequenas, empacotadas na mesma leva (02/08/2026):** "Limpar
histórico" de pesquisas (`DELETE /api/buscas`) e editar/excluir campanha
(`DELETE /api/campanhas` — desvincula os leads, nunca apaga eles), as duas
só pra quem não é operador.

**Atualização (02/08/2026) — a hierarquia `/contas/[id]` que ficou combinada
lá no início foi construída.** Só pro super admin: clicar no nome do cliente
em Contas abre uma página com abas — Usuários, Integrações (mostra só se
cada chave está cadastrada, não os valores), Campanhas, Log de erros e
Chamados — sem precisar "trabalhar nessa conta" antes. É overview: pra
editar qualquer coisa, ainda usa "Trabalhar nesta conta" e as telas normais
(decisão de escopo pra não duplicar rota seguindo `conta_id` explícito nas
APIs de escrita, que hoje sempre confiam na conta ativa da sessão). De
brinde, `/campanhas/[id]` passou a deixar o super admin ver campanha de
qualquer cliente sem trocar de conta ativa — antes só funcionava pra conta
ativa, então o link não abria vindo da página nova.

---

### Fase 10 — Os pendentes menores

- **Paginação da busca** — só traz 20; a rota já aceita `pagina`, falta o botão. **P**
- **Consumo por conta, agregado por período** — campanhas já mostram o funil por leva; falta somar por mês. **P**
- **Enriquecimento — o resto** — score/temperatura, reviews como gancho, sinais de maturidade digital, presença em busca (itens 1–4 de `docs/enriquecimento.md`); e a análise unificada Kipflow + Playbook Lab ainda não escrita. **G**

---

## Riscos e coisas a decidir

**SerpAPI no plano gratuito.** 250 buscas/mês na conta atual. Com mais de um
cliente isso estoura em dias. Duas saídas: cada cliente traz a própria chave
(cadastrada na conta dele), ou a Figueira assina um plano pago e revende as
buscas. Isso é decisão comercial e **continua em aberto** — precisa estar
resolvida antes do segundo cliente.

**PostgREST self-hosted.** Toda tabela ou coluna nova exige reiniciar o
serviço `rest` de verdade — `SELECT` funciona na hora, `INSERT`/`PATCH`
continua 404/PGRST204 até o restart, mesmo com `NOTIFY`. Já aconteceu cinco
vezes no mesmo dia. Reinicie o `rest` **antes** de testar qualquer escrita
depois de rodar uma migração nova — e um restart só cobre todas as migrações
pendentes de uma vez, não precisa reiniciar depois de cada uma.

**WAHA não entrega webhook pra dois destinos ao mesmo tempo.** Hoje
`getOrCreateSession` (`app/src/lib/waha.ts`) cria a sessão só com
`config.engine`, nunca com `config.webhooks` — quem recebe o evento de
mensagem recebida é definido de forma global na instância WAHA (env var ou
painel do próprio WAHA), não por sessão, e não há nada no código do Harvest
que registre múltiplos destinos. Resultado: se o mesmo número está conectado
ao Harvest (via canal WAHA) e a um agente conversacional no n8n, só um dos
dois recebe a resposta do lead — o outro fica sem retorno. Suspeita do
Guilherme (02/09/2026): foi isso que aconteceu com o número da Guinffer
conectado no CRM, que não recebia os retornos. Duas saídas propostas: (i)
fazer o WAHA multiplexar o webhook pra vários destinos (ou o Harvest
reenviar pro n8n o que recebe), ou (ii) construir o agente
conversacional/follow-up direto dentro do Harvest, tirando o n8n do meio
pra esse fluxo. Ainda não decidido qual caminho seguir — precisa de
confirmação de como o webhook está configurado hoje na instância WAHA
antes de escolher.

**Chatwoot/Twenty — checado, nunca chegou a existir.** No início a ideia era
Chatwoot como mensageria e Twenty como CRM. Levantamento (02/09/2026): não há
nenhuma linha de código viva usando Chatwoot — só 3 comentários antigos
citando uma "Fase 3D" que nunca foi construída (`app/src/lib/inbound.ts`,
`app/src/lib/optoutResposta.ts`, `docs/deploy.md`). Twenty também nunca foi
ligado: `app/src/lib/twenty.ts` define `TwentyCrmBackend` mas todo método
lança `'Twenty backend não configurado (NÃO VERIFICADO)'`; o backend
realmente ativo é `SupabaseCrmBackend`, que virou o CRM (`oportunidades`,
`crm_atividades`) dentro do próprio Harvest. Ou seja: não existe nada pra
corrigir por causa da troca Evolution→WAHA — Chatwoot nunca esteve
conectado.

**SMTP.** ✅ Resolvido — configurável pela tela (Contas → super admin), na
Fase 8b. Falta só ligar num provedor de verdade quando você tiver a conta.

**Onde ficam as chaves dos clientes.** Guardadas em `conta_credenciais` com RLS
estrita e legíveis pela `service_role` do n8n. Isso protege de acesso por outro
cliente, mas quem tem a service key lê tudo. Criptografia em coluna é possível
e fica para depois — vale registrar que hoje não teremos.

---

## Por onde continuar

Reinicie o serviço `rest` primeiro — ver aviso no topo do `ESTADO.md`, cobre
várias migrações acumuladas de uma vez. Depois disso, Fase 6 (conectar
WhatsApp por QR): é a única coisa entre o produto de hoje e uma entrega em
que o cliente não depende de ninguém da Figueira para começar a usar.

Quem for continuar este trabalho: o estado atual, as credenciais e as
armadilhas já conhecidas estão em `ESTADO.md`, na raiz do projeto — fora do
git, na máquina do Guilherme.
