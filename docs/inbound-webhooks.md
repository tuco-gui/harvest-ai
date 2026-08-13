# Inbound multiprovedor (Fase 3B) — configuração e validação real

Este documento cobre o que falta para levar a Fase 3B (implementada e
testada localmente) a produção: configurar os dois providers de verdade e
validar com uma mensagem real, sem nunca disparar nada automaticamente para
um cliente.

## O que já está pronto (local)

- `sql/017_inbound_eventos.sql` — migration da tabela, não aplicada.
- `app/api/webhook/waha/route.ts` — exige `X-Webhook-Hmac` (HMAC-SHA512).
- `app/api/webhook/evolution/[token]/route.ts` — exige o token no caminho.
- `WAHA_WEBHOOK_HMAC_KEY` e `EVOLUTION_WEBHOOK_TOKEN` — ver `.env.example`.

Sem essas duas variáveis configuradas no ambiente de produção, as rotas
rejeitam 100% dos webhooks (falha fechada) — isso é proposital, não um bug.

---

## 1. Configuração WAHA

**Endpoint de configuração:** `POST {WAHA_API_URL}/api/sessions/{session}` (na
criação) ou o endpoint de update de sessão, com `X-Api-Key: {WAHA_API_KEY}`.

**Nome da sessão:** já é determinístico — `wahaSessionName(contaId)` em
`lib/waha.ts` (`conta_<uuid sem hífen>`). É esse nome que a resolução de
conta (`lib/inboundConta.ts`) usa para voltar do webhook para o `conta_id`.

**Corpo a enviar** (documentação: waha.devlike.pro/docs/how-to/config,
/how-to/security):

```json
{
  "config": {
    "webhooks": [
      {
        "url": "https://harvest.figueiramarketing.com.br/api/webhook/waha",
        "events": ["message"],
        "hmac": { "key": "<mesmo valor de WAHA_WEBHOOK_HMAC_KEY>" }
      }
    ]
  }
}
```

- **Eventos necessários:** `message` (mensagem individual recebida). Não
  precisamos de `message.any` (inclui eco de mensagens enviadas — o pipeline
  já descarta `fromMe`, mas não há motivo para pedir volume a mais do WAHA
  nesta fase) nem de eventos de status/presença.
- **Autenticação/assinatura:** HMAC-SHA512 nativo — `hmac.key` na sessão
  precisa ser exatamente o valor de `WAHA_WEBHOOK_HMAC_KEY` no `.env` do
  Harvest. WAHA manda `X-Webhook-Hmac` (+ `X-Webhook-Hmac-Algorithm: sha512`)
  em cada chamada.
- **Alternativa global:** em vez de configurar por sessão, dá para setar
  `WHATSAPP_HOOK_HMAC_KEY` como env do próprio servidor WAHA — mesma chave,
  efeito equivalente. Preferir por sessão se o WAHA já hospeda outras
  integrações que não devem usar a mesma chave.

## 2. Configuração Evolution

**Endpoint:** `POST {evolution_url}/webhook/set/{evolution_instancia}` com
header `apikey: {evolution_key}` (mesmas três credenciais já cadastradas em
Configurações → Conexões para o disparo, ver `conta_credenciais`).

**Corpo a enviar** (documentação: docs.evolution-api.com/docs/04-Webhooks/00-set-webhook):

```json
{
  "webhook": {
    "enabled": true,
    "url": "https://harvest.figueiramarketing.com.br/api/webhook/evolution/<EVOLUTION_WEBHOOK_TOKEN>",
    "webhookByEvents": false,
    "events": ["MESSAGES_UPSERT"]
  }
}
```

- **Eventos necessários:** só `MESSAGES_UPSERT` — é o evento de mensagem
  recebida/enviada (o pipeline descarta `fromMe`). Não pedir
  `MESSAGES_UPDATE`, `SEND_MESSAGE`, `CONNECTION_UPDATE` etc. nesta fase.
- **`webhookByEvents` TEM que ser `false`.** Se `true`, a Evolution acrescenta
  um sufixo por evento à URL (`/messages-upsert`), e o token deixaria de
  bater com o caminho fixo que a rota espera.
- **Forma de identificar a instância:** campo `instance` no corpo de cada
  webhook (nome cadastrado em `conta_credenciais.evolution_instancia`) — é o
  que `resolverContaEvolution` usa.
- **Autenticação/assinatura:** a Evolution **não documenta HMAC/assinatura
  nativa** para webhooks (só `enabled`/`url`/`webhookByEvents`/`events`).
  Mitigação adotada: token compartilhado embutido no próprio caminho da URL
  (`EVOLUTION_WEBHOOK_TOKEN`), comparado em tempo constante. Gerar um valor
  longo e aleatório (ex.: `openssl rand -hex 32`) — não é uma senha para
  decorar, é só para não ficar num caminho adivinhável.

## 3. Procedimento de validação com payload real

**Importante: isto é teste de INBOUND — não dispara campanha nem mensagem
automática para ninguém.** O "envio" do passo 2 de cada bloco é você mandando
uma mensagem de UM número de teste (seu celular, por exemplo) PARA o número
conectado no WAHA/Evolution da conta — é o WhatsApp de terceiros (o do
Harvest) recebendo, não o Harvest mandando.

### WAHA

1. Configurar o webhook da sessão de teste conforme a seção 1.
2. De outro número (não o conectado no WAHA), mandar uma mensagem de texto
   qualquer para o número da sessão WAHA.
3. Checar os logs do Harvest (`docker service logs harvest_harvest`) ou,
   temporariamente, ler direto de `inbound_eventos` (`select * from
   inbound_eventos where provider = 'waha' order by criado_em desc limit 1`)
   — captura o payload bruto (`payload_bruto`) e o evento gravado.
4. **Confirmar o adapter:** os campos batem com o que `normalizarEventoWaha`
   espera (`event`, `session`, `payload.id/from/fromMe/body`)? Se o formato
   real divergir, é aqui que aparece — ajustar `lib/inboundWaha.ts` antes de
   confiar na fase.
5. **Confirmar `conta_id`:** o evento gravado tem o `conta_id` da conta dona
   da sessão de teste (não outra)?
6. **Confirmar telefone:** `telefone` bate com o número de quem mandou,
   normalizado (dígitos + DDI 55)?
7. **Confirmar `message_id`:** `message_id_externo` está preenchido e é
   estável (reenviar o MESMO clique de "reenviar" no WhatsApp, se possível,
   ou reprocessar manualmente o mesmo payload contra a rota, para checar o
   passo 8).
8. **Confirmar gravação única:** reprocessar o mesmo payload (replay manual
   do corpo capturado, com a mesma assinatura HMAC) não cria uma segunda
   linha em `inbound_eventos` — a resposta da rota deve vir com
   `"duplicado": true`.

### Evolution

Repetir os mesmos 8 passos, trocando "sessão WAHA" por "instância Evolution"
e usando o número conectado na Evolution daquela conta. Mesma checagem de
adapter (`normalizarEventoEvolution` — campos `event`, `instance`,
`data.key.id/fromMe/remoteJid`, `data.message`), mesmo `conta_id`/telefone/
`message_id`/idempotência.

### Depois dos dois

Registrar em `RELATORIO_ENTREGAS.md` (próxima entrega, não a 05) se os
payloads reais bateram com os adapters como estão, ou se foi preciso
ajustar algum campo — isso encerra a pendência "NÃO VERIFICADO" desta fase.
