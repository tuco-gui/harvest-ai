# Prospecta IA

Prospecção ativa B2B: busca empresas no Google Maps, valida quem tem WhatsApp, escreve
uma abordagem personalizada com IA e dispara pelo WhatsApp. Um único workflow do n8n,
com o painel web servido pelo próprio n8n.

**Tudo se configura pela tela do painel** — chave da SerpAPI, Evolution API e webhook.
Para revender: importe o workflow no n8n do cliente, abra o painel, preencha a engrenagem.
Nenhuma chave fica dentro do workflow.

## Estrutura

| Caminho | O que é |
|---|---|
| `painel/index.html` | Fonte da verdade do painel. Editar aqui, nunca dentro do n8n. |
| `n8n/prospecta-ia.json` | Workflow para importar. |
| `sql/001_schema.sql` | As tabelas do Supabase. Idempotente. |
| `scripts/build-workflow.py` | Injeta o painel no workflow depois de editar o HTML. |
| `docs/enriquecimento.md` | Roadmap: de prospecção fria para prospecção quente. |

## Setup

1. **Banco** — rode `sql/001_schema.sql` no SQL Editor do Supabase. Em Supabase
   self-hosted, reinicie o PostgREST depois (ver observação no próprio arquivo).
2. **n8n** — importe `n8n/prospecta-ia.json`, aponte as credenciais `Supabase` e
   `OpenAI` e ative o workflow.
3. **Painel** — abra `<n8n>/webhook/prospecta`, clique na engrenagem e preencha:
   - Chave da SerpAPI **e** a URL de busca → `<n8n>/webhook/prospecta-busca`
   - Evolution API: URL base, instância e token (opcional)
   - URL do webhook de disparo → `<n8n>/webhook/<id do nó Webhook>`

## Os quatro webhooks

São portas de entrada independentes do mesmo workflow, cada uma chamada em um momento:

| Rota | Quando |
|---|---|
| `/webhook/prospecta` | abrir o painel (serve o HTML) |
| `/webhook/prospecta-busca` | clicar em "Buscar" — só repassa a chamada à SerpAPI |
| `/webhook/<id>` | clicar em "Enviar", um POST por prospect |

## Detalhes que custam caro quando esquecidos

- **O navegador não chama a SerpAPI direto.** É bloqueio de CORS. O painel original
  tentava contornar por três proxies públicos (`api.codetabs.com`, `api.allorigins.win`,
  `cors-anywhere.herokuapp.com`) — os três estão fora do ar, e foi isso que matou a busca.
  Daí a rota `prospecta-busca`: três nós que só repassam, sem guardar chave nenhuma.
- **Telefone precisa do DDI 55.** A Evolution API responde `exists: false` para número sem
  ele — resultado: todo mundo aparecia como "sem WhatsApp" e o disparo não chegava.
  `normalizarTelefone()` no painel é o único lugar que trata isso; validação, exibição e
  disparo passam por ela.
- **Paginação da SerpAPI é de 20 em 20** (`start=0,20,40…`). O parâmetro `num` é ignorado
  no engine `google_maps`.
- **Cada página de busca gasta 1 crédito** da SerpAPI.
- **Dois workflows ativos com o mesmo `path` de webhook não funcionam** — o n8n registra
  só o primeiro e o outro dá 404. Ao trocar de versão, desative a antiga antes de ativar
  a nova.
- **Importação por CSV**: só CSV (no Excel, "Salvar como → CSV UTF-8"). O link
  "Baixar modelo de planilha" no painel gera o arquivo com os cabeçalhos certos.

## Editando o painel

```bash
python3 scripts/build-workflow.py
```

e reimporte o JSON.

## Licença

Uso interno. O repositório é público para servir de referência — nenhuma chave,
URL interna ou dado de cliente entra nele.
