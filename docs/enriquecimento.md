# De prospecção fria para prospecção quente

Estado atual: a busca traz nome, telefone, rating, número de avaliações, categoria e site.
A IA escreve a abordagem em cima disso. É pouco — qualquer concorrente com a mesma SerpAPI
manda a mesma mensagem. O que segue é o caminho para mensagem que só faz sentido vinda de nós.

Ordem proposta por relação impacto/custo. Cada etapa é independente: dá para parar em
qualquer uma e já ter ganho.

---

## 1. Reviews como gancho — o maior salto por menos esforço

**O quê:** engine `google_maps_reviews` da SerpAPI, com o `place_id` que já gravamos.
Traz as avaliações recentes com nota, texto e data.

**Por quê:** a reclamação recente é o problema real, dito pelo cliente do prospect.
"Vi que três pessoas comentaram esse mês que ninguém responde o WhatsApp de vocês"
é uma abertura que não tem como ser genérica.

**Como:** um workflow separado que roda sobre `prospecta_leads` com `status='novo'`,
puxa as 10 avaliações mais recentes, manda para o modelo resumir em duas frases
(dor principal + citação curta) e grava em `prospecta_leads.resumo_site` — ou numa
coluna nova `resumo_reviews`. Depois o prompt de abordagem passa a receber isso.

**Custo:** 1 crédito SerpAPI por lead. Só vale para leads que passaram no filtro de score,
não para a base inteira.

**Cuidado:** não citar avaliação negativa de forma acusatória. O tom é "vi um padrão nos
comentários", nunca "seus clientes reclamam de você".

---

## 2. Sinais de maturidade digital

**O quê:** duas fontes combinadas.

- SerpAPI `type=place` no `place_id`: horário de funcionamento, serviços oferecidos,
  quantidade de fotos, faixa de preço, se responde avaliações.
- O scrape do site que já existe no workflow (`r.jina.ai`), lendo também o HTML cru
  para detectar: e-mail de contato, link de Instagram, Google Analytics, Meta Pixel,
  botão de WhatsApp, formulário de captura.

**Por quê:** define qual é a oferta. Quem não tem pixel nem GA não consegue medir nada —
é lead de performance. Quem tem tudo mas não responde avaliações é lead de reputação.
Sem isso a mensagem é sempre a mesma oferta genérica.

**Como:** colunas novas em `prospecta_leads` (`tem_pixel`, `tem_analytics`, `tem_site_proprio`,
`responde_reviews`) preenchidas no mesmo passo do scrape. O prompt escolhe o ângulo.

**Custo:** 1 crédito SerpAPI por lead (place), scrape é grátis.

---

## 3. Presença em busca

**O quê:** engine `google` com `q="<empresa> <cidade>"` e com `q="<categoria> <cidade>"`.

**Por quê:** dois argumentos concretos e verificáveis:
1. A empresa aparece quando alguém procura o nome dela? Se não, é um problema óbvio.
2. Quem está anunciando em cima da categoria dela? Se o concorrente aparece e ela não,
   isso é a mensagem inteira.

**Como:** workflow que roda por categoria (não por lead — uma busca de categoria serve
para todos os leads daquela categoria e cidade), guardando os anunciantes numa tabela
`prospecta_concorrentes`. O lead recebe só a referência.

**Custo:** baixo, porque é amortizado por categoria/cidade e não por lead.

---

## 4. Score e temperatura

**O quê:** um número em `prospecta_leads.score` (0–100) e um rótulo em `temperatura`.

**Fórmula proposta** (ajustar com os dados reais depois das primeiras semanas):

| Sinal | Peso | Racional |
|---|---|---|
| Tem WhatsApp validado | 25 | Sem isso não há canal. É eliminatório na prática. |
| Volume de avaliações (log) | 20 | Empresa com movimento tem orçamento. |
| Rating entre 3,5 e 4,5 | 15 | Quem está em 4,9 não sente dor; quem está em 2,0 tem problema que marketing não resolve. |
| Reclamação recente sobre atendimento | 15 | Dor que o nosso serviço endereça. |
| Não tem pixel/analytics | 10 | Não mede, logo não sabe que está perdendo. |
| Concorrente anunciando na categoria | 10 | Urgência real. |
| Tem site próprio | 5 | Sinal de que já investe. |

`temperatura`: `quente` ≥ 70, `morno` 40–69, `frio` < 40.

**Efeito prático:** o painel passa a ordenar por score em vez da ordem do Google Maps,
e o disparo pega os N mais quentes em vez dos N primeiros.

---

## 5. Supressão e cadência

Coisas que evitam queimar o número do WhatsApp:

- **Nunca falar duas vezes com o mesmo `place_id`.** O UNIQUE já garante a linha única;
  falta a checagem `disparo='sim'` antes de enfileirar.
- **Mesmo telefone em leads diferentes** (franquia, mesmo dono): checar por telefone
  antes do disparo, não só por `place_id`.
- **Janela de contato:** só disparar em horário comercial e dia útil.
- **Follow-up em D+3** para quem não respondeu, usando `prospecta_mensagens` para saber
  quem recebeu o quê e quando. Máximo dois follow-ups, depois marca `descartado`.
- **Lista de exclusão:** clientes atuais e quem pediu para não receber mais.

---

## 6. Sócio e telefone do proprietário via CNPJ

**Pedido do Guilherme (31/07/2026):** em vez de falar só com "a empresa", falar com o dono.
Cruzar CNPJ e trazer nome e telefone dos sócios é mais valioso que qualquer outro dado da
lista hoje — muda a mensagem de "olá, empresa" para "olá, [nome]".

**Por que não é simples:** o Google Maps (SerpAPI `google_maps`) **não devolve CNPJ**. Não
tem esse campo. Para chegar no CNPJ a partir de um resultado de Maps, o caminho seria:

1. Casar `empresa` (nome) + `endereco`/cidade contra uma base de CNPJ por razão social —
   correspondência aproximada (fuzzy), sujeita a erro: nome fantasia raramente bate com
   razão social ("Bellaminy Bijuterias" no Maps pode ser "M. F. DE SOUZA COMÉRCIO LTDA" no
   CNPJ). Falso positivo aqui é grave: manda mensagem pro sócio errado.
2. Ou casar pelo telefone, se a base de CNPJ tiver telefone cadastrado (nem sempre tem, e
   quando tem, muitas vezes é telefone fixo antigo, não o WhatsApp que já validamos).

**Fontes possíveis:** BrasilAPI (`brasilapi.com.br`, gratuita, mas exige o CNPJ já em mãos —
não busca por nome) e bases pagas de enriquecimento (Speedio, Econodata, Data2CRM) que
fazem esse casamento por nome+telefone já prontas — custam por consulta ou por assinatura.

**Atualização (31/07/2026) — achamos uma candidata concreta: Kipflow.** O Guilherme trouxe
um workflow n8n + análise de um vídeo mostrando um agente que usa Apify (raspa Google Maps)
+ Kipflow (enriquece por domínio → CNPJ → LinkedIn → decisor → e-mail). Verifiquei a Kipflow
de verdade antes de confiar no que o vídeo/Gemini descreveram:

- **Real, é brasileira, e por trás dela está a Driva** (infraestrutura de dados B2B já
  estabelecida). Confirmei um endpoint funcionando na doc oficial (`docs.kipflow.io`):
  `GET https://data.z-api.driva.io/social/v1/companies/search?company_public_id=X` devolve
  `company_name`, `cnpj`, `website`, `staff_count`, cidade/UF — **R$ 0,49 por consulta**.
  Isso resolve a parte de "achar o CNPJ a partir de dado público" sem fuzzy-match por nome.
- **Não confirmei dois endpoints que o workflow usa**: busca de decisor
  (`/social/v1/personas/search` — a doc oficial mostra `/social/v1/people/search`, nome
  diferente) e geração de e-mail (`/contacts/v1/emails/generate-by-domain` — não apareceu em
  lugar nenhum que eu encontrei). O JSON do workflow tem `"aiBuilderAssisted": true` no
  próprio metadata — foi montado por IA, e esses dois endpoints podem estar desatualizados
  ou levemente errados. **Não construir nada contra eles sem testar com uma chave real primeiro.**
- **Limitação estrutural, não é bug da Kipflow**: só enriquece quem tem site (a busca é por
  domínio). Boa parte da nossa base típica (salão, joalheria, padaria) não tem — esses leads
  ficam sem enriquecimento nenhum, do jeito que esse fluxo é desenhado.
- **Custo real**: R$0,49 por consulta de empresa, provavelmente +R$0,49 pela consulta de
  decisor (não confirmado) — bate com a estimativa do vídeo de R$0,60–1,00 por lead completo.
  Em volume, isso é dinheiro de verdade por lead.

**Como incorporaria no Harvest AI** (se a decisão comercial for "sim"): colunas novas em
`prospecta_leads` (`cnpj`, `decisor_nome`, `decisor_cargo`, `decisor_linkedin`, `email`,
`email_validacao`), uma rota `/api/enriquecer` chamada **por lead, sob demanda** — nunca
automática pra toda busca, mesmo padrão de custo controlado que já usamos pra crédito de
SerpAPI e token de IA — e a coluna "enriquecidas" no funil de Campanhas.

**Próximos passos, nessa ordem, antes de escrever qualquer código:**
1. Guilherme cria conta de teste na Kipflow (buscas indicam até 5.000 consultas grátis pra
   testar, mas isso não foi confirmado na página de preço — checar direto com eles)
2. Com uma chave real, confirmar os endpoints de decisor e e-mail batendo na API de verdade
3. Decidir o modelo de custo (por lead sob demanda, com um botão "Enriquecer" — mesmo padrão
   dos testes que já existem em Configurações)

**Decisão que falta:** vale pagar por uma base de enriquecimento pronta (mais confiável,
mais caro) ou tentar o casamento por conta própria (mais barato, mais falso positivo)?
Isso é decisão comercial — depende de quanto cada lead vale para o cliente que está
pagando pelo Harvest AI. Não construí nada disso ainda; fica para quando essa decisão
estiver tomada.

**Atualização (01/08/2026) — segundo workflow, Playbook Lab (Victor Baggio), resolve a
limitação da Kipflow.** O Guilherme trouxe um segundo workflow n8n (`[Lead Magnet] Google
Maps Scraping Tool`) + vídeo explicativo. Abri o JSON de verdade (não só a descrição) e
testei cada endpoint contra a documentação oficial de cada ferramenta antes de confiar:

- **Sem a flag `aiBuilderAssisted` no metadata** (diferente da Kipflow) — sinal de que foi
  montado por um humano, não gerado por IA numa tacada. Prompts dos agentes são longos e
  bem específicos (temperatura 0.2, âncora por cidade/CEP pra não bater na empresa errada).
- **Apify** roda o ator `Google Maps Scraper` (`compass/crawler-google-places`,
  `nwua9Gu5YrADL7ZDj`) — confirmado, é o ator público real. Plano free dá **US$5/mês em
  créditos que renovam todo mês** (recorrente, não único).
- **Perplexity API** (`sonar-reasoning-pro`) faz o papel de achar o decisor — cruza
  CNPJ/QSA/site/diretórios/LinkedIn num agente com prompt próprio. **Não depende do lead
  ter site** (tem um branch `Website?`: se tem site, extrai o conteúdo com o Tavily e passa
  pro prompt; se não tem, busca só com nome/endereço) — isso resolve exatamente a limitação
  que a Kipflow tinha ("só enriquece quem tem site"). Custo: sem free tier, mas a taxa por
  requisição (US$5–14/1.000, [doc oficial](https://docs.perplexity.ai/docs/getting-started/pricing))
  sai mais barato que os R$0,49/consulta da Kipflow.
- **Tavily** acha o LinkedIn pessoal (busca restrita a `linkedin.com/in/`) — nó dedicado
  real (`@tavily/n8n-nodes-tavily`). **Free tier real: 1.000 créditos/mês, sem cartão**
  ([doc oficial](https://docs.tavily.com/documentation/api-credits)).
- **Anymail Finder** acha e valida o e-mail por nome+domínio. Endpoint (`POST
  /v5.1/find-email/person`), parâmetros e formato de resposta batem 100% com a
  [doc oficial](https://anymailfinder.com/email-finder-api/docs/find-person-email) —
  diferente da Kipflow, aqui não achei nenhum endpoint estranho. Cobra 1 crédito só quando
  acha e-mail válido; trial de 100 créditos grátis por 14 dias, pago a partir de ~US$29/mês.
- **Duas coisas que o vídeo narra mas o JSON baixável não faz** (só percebi comparando os
  dois): (1) o vídeo fala em usar o **Unipile** pra raspar o perfil completo do LinkedIn —
  não existe nenhum nó de Unipile no workflow real, ele só guarda a URL achada pelo Tavily;
  (2) o vídeo diz que quando acha o LinkedIn usa o LinkedIn pra achar o e-mail e quando não
  acha usa nome+domínio — no JSON os dois nós de Anymail Finder são idênticos, sempre
  nome+domínio, nunca usam a URL do LinkedIn. Não muda a conclusão de que o workflow é real,
  só mostra que o vídeo é uma versão simplificada/narrada, não 1:1 com o arquivo.

**Não construí nada disso ainda.** Essa foi só a análise do Workflow 2 sozinho comparado
com o Harvest AI, como pedido. A próxima etapa é juntar Kipflow + esse workflow + Harvest AI
numa arquitetura só, pensando no plano básico (busca) vs. premium (decisor + LinkedIn +
e-mail) que o Guilherme quer vender.

**Atualização (01/08/2026) — decisão final da pilha, depois de checar as alternativas
gratuitas sugeridas pelo Gemini contra a documentação real de cada uma:**

- **CNPJ.ws / Minha Receita (grátis) não substitui a Perplexity.** Resolve só metade do
  problema: busca por CNPJ, não por nome de empresa. O Google Maps não devolve CNPJ, então
  ainda precisaríamos achar o CNPJ a partir do nome primeiro — o mesmo risco de fuzzy-match
  já registrado no início deste item. Além disso, o plano grátis é limitado a **3
  requisições/minuto**. Fica como complemento (confirmar razão social depois de já ter o
  CNPJ), não como substituto do passo de descoberta.
- **Google Custom Search API está sendo descontinuada** (fecha pra usuários novos em 2026,
  desliga em 01/01/2027) — não vale construir em cima dela.
- **DuckDuckGo scraper é contra os Termos de Uso do DuckDuckGo** e quebra com frequência —
  não é uma opção séria pra um SaaS pago.
- **Groq/Gemini** já resolvido, já em produção (`lib/ia.ts`) — sem mudança necessária.
- **Achado que o Gemini não sugeriu**: **Serper.dev** é melhor que a Tavily pra achar
  LinkedIn — 2.500 buscas grátis (crédito único, não mensal) e depois US$0,30–1 a cada 1.000
  buscas, contra US$8/1.000 da Tavily fora do free tier.
- **Gerar e-mail por tentativa de padrão MX sem validar é pior que não ter e-mail** —
  queima reputação de domínio/IP mandando pra endereço que pode não existir, o mesmo
  cuidado do item 5 (Supressão e cadência) pro WhatsApp.

**Pilha decidida:**

| Etapa | Provedor | Por quê |
|---|---|---|
| Decisor (CNPJ/sócio) | **Perplexity** (`sonar-reasoning-pro`) | Único que resolve nome→decisor num passo só. Sem free tier, mas barato por lookup (~R$0,03–0,08 de taxa + tokens). |
| LinkedIn pessoal | **Serper.dev** | Mais barato que Tavily em escala, sem os problemas de ToS/descontinuação das opções grátis. |
| E-mail do decisor | **Anymail Finder** | Único da lista que valida de verdade (não é chute de padrão). |
| Filtro de categoria / mensagens | **Groq/Gemini** | Já em produção, grátis. |

Custo estimado num volume baixo (~100 leads enriquecidos/mês): Perplexity ~R$6–10, Serper
R$0 (dentro do free), e-mail R$0–150 dependendo do volume. Nessa escala o módulo quase não
pesa — a escolha grátis-vs-pago importa mais quando o volume crescer.

**Decisão de escopo (01/08/2026):** implementar com **um provedor por etapa agora**
(Perplexity + Serper + Anymail Finder), sob demanda por lead — não construir o seletor
multi-provedor por conta (como em `ia_provedor`/`ia_key`) já de início. Adicionar
alternativas depois reaproveitando o mesmo padrão de schema, se algum cliente pedir.

**Construído (01/08/2026)** — ver Fase 9c em `docs/roadmap-saas.md`. `sql/009_enriquecimento.sql`
(colunas de chave em `conta_credenciais`, colunas de decisor em `prospecta_leads`),
`lib/enriquecimento.ts` (as três chamadas), `/api/enriquecer` (rota sob demanda, por
`place_id`), seção de chaves + testes em Configurações, botão "Enriquecer" na lista de
resultados da Prospecção. Falta reiniciar o `rest` do Supabase antes de testar de verdade
(ver aviso no topo do `ESTADO.md`). A análise unificada Kipflow + Playbook Lab + Harvest AI
que tinha ficado pendente não chegou a ser escrita como documento separado — a decisão de
pilha acima já é, na prática, essa junção.

**Atualização (02/08/2026) — dois provedores por etapa, pra rodar sem gastar nada até fechar
venda.** O Guilherme pediu: "não estou com grana pra investir agora" (o modelo de negócio é
oferecer o enriquecimento como parte paga só depois que fecha um cliente). Adicionado
`decisor_provedor` (`perplexity` | `gratis`) em `conta_credenciais`, reaproveitando o que a
conta já tem: no modo grátis, `buscarDecisorGratis()` faz a mesma busca-web que já fazíamos
pro LinkedIn (Serper/Tavily) e manda o resultado pra IA já configurada (Groq/Gemini, que já
são grátis) extrair o nome do decisor — sem chave nova, sem custo. Fica documentado que é
**menos preciso** que a Perplexity de propósito: ela é feita sob medida pra pesquisa com
raciocínio, um LLM genérico lendo snippet de busca não tem a mesma qualidade. O caminho
natural: testar/demonstrar com o modo grátis, trocar pra Perplexity quando o cliente pagante
justificar o custo.

**Atualização (02/08/2026) — Apollo.io e Snov.io como opção pra e-mail, ao lado da Anymail
Finder (nenhuma sai).** `email_provedor` (`anymail` | `apollo` | `snov`) em
`conta_credenciais`. Verificado antes de implementar:

- **Apollo.io**: `POST api.apollo.io/api/v1/people/match`, header `X-Api-Key`, precisa do
  parâmetro `reveal_personal_emails: true` — sem ele a API nem devolve o e-mail. Cota grátis
  é instável (relatos de queda de 10.000 pra ~720 créditos/mês); documentei isso na tela
  em vez de prometer um número.
- **Snov.io**: bem mais complexo que os outros três — autentica por **client_id + client_secret**
  (OAuth2 `client_credentials`, token de 1h), e a busca de e-mail é **assíncrona**: `POST
  /v2/emails-by-domain-by-name/start` devolve um `task_hash`, que precisa ser consultado em
  `GET /v2/emails-by-domain-by-name/result` até sair (implementei um polling de até 10x/2s =
  20s). Exige domínio — não aceita nome de empresa como a Anymail Finder aceita.

---

## 7. Controle de custo

`prospecta_buscas` já registra termo, página, total de resultados e quantos leads novos
saíram. Com isso dá para:

- Ver o custo real por lead novo, por termo de busca.
- Parar automaticamente um termo quando N páginas seguidas não trazem nenhum
  `place_id` inédito — é o sinal de que aquela cidade/categoria esgotou.
- Comparar a produtividade dos termos e concentrar crédito onde rende.

---

## Ordem de execução sugerida

1. Rodar a versão atual por duas semanas e acumular base — sem dados reais, qualquer
   fórmula de score é chute.
2. Etapa 2 (maturidade digital), que é a mais barata e já muda a oferta.
3. Etapa 1 (reviews), aplicada só nos leads que a etapa 2 marcou como promissores.
4. Etapa 4 (score) calibrada com a taxa de resposta observada.
5. Etapa 5 (cadência) antes de aumentar volume — é o que protege o número.
6. Etapa 3 (presença em busca) por último: é a de maior esforço de implementação.
