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

## 6. Controle de custo

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
