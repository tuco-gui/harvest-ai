# PR #46 — correções e evidências da revisão

Data: 2026-11-06. Escopo: código e validação; sem merge, deploy, publicação de workflow ou habilitação de atendimento.

## 1. Contrato real dos workflows existentes

Consulta somente leitura pelo acesso SSH já existente à infraestrutura Figueira/n8n 2.34.5. Nenhum MCP/serviço foi instalado ou reconfigurado; nenhuma credencial foi exportada para o repositório.

| Workflow | Versão observada | Evidência |
|---|---|---|
| `njZxxrVJrrl6l96i` | `bef46edf-0589-4be4-8ea1-a6d131130b42` | Trigger passthrough; preparador lê `Nome`/`nome`, `WhatsApp`/`whatsapp`, `E-mail`/`email`; POST `.../production/cliente`; `retryOnFail=true`, 3 tentativas |
| `CZ3gAStDKp75yJtm` | `dcee769f-1eb0-4c64-a81d-e97517fcd3bb` | Planilha → resposta do protocolo + execução assíncrona direta do child |
| `pqVU7Tceb9Xv8dHs` | `ff17a1cd-bb47-4dba-914f-ba26126ec476` | Planilha → resposta do chat + execução assíncrona direta do mesmo child |

O novo Code node **Adaptar contrato do child existente** converte explicitamente:

| Harvest | Child existente |
|---|---|
| `cliente` | `Nome` |
| `telefone` | `WhatsApp`, normalizado com DDI |
| `email` | `E-mail` |
| `idempotency_key` | `Protocolo` |
| `midia`, origem/campanha documentadas | `Canal`, `Origem`, `Campanha` |

O child exige nome com pelo menos três caracteres e telefone. Cadastros com e-mail apenas não são inventados como WhatsApp: ficam capturados no Harvest, sem POST incompatível, até completar dados ou homologar uma API que suporte esse caso.

### Resultado disponível não comprova entrega ao CRM

A execução `2789395` do child consta como `success`, mas o resultado armazenado de **Enviar ao Superlogica** contém `status: SIMULADO`. A inspeção retornou somente metadados/estrutura sanitizada; nenhum nome, telefone, e-mail ou token de lead foi incluído nas evidências.

**Não há evidência nessa execução de cadastro efetivo no CRM.** Não foi criado um novo lead externo para fabricar confirmação. O resultado simulado observado é expressamente recusado pelos testes e pelo novo contrato.

Confirmação passa a depender de consulta LEADS, com sua credencial própria, e comparação de ID, imóvel e identidade. O contrato normalizado dessa consulta é:

```json
{
  "fonte": "api_leads",
  "status_http": 200,
  "completa": true,
  "leads": [
    {"id_superlogica":"<ID real>","codigo_anuncio":"CA0653_MMOL","telefone":"<telefone consultado>","email":"<se retornado>"}
  ]
}
```

Esse envelope é responsabilidade do adapter de consulta autenticado: deve ser produzido a partir da resposta real da API documentada, não do payload do lead, do HTTP de escrita ou da planilha. O endpoint/schema bruto LEADS continua sujeito à homologação operacional; não foi inventado. Consulta incompleta, múltiplos registros, imóvel/identidade divergentes ou erro não confirmam cadastro.

- Antes de POST, a consulta completa precisa provar ausência do cadastro.
- Cadastro já encontrado: retorna seu ID sem chamar o child.
- Após qualquer chamada ao child, até mesmo HTTP 200: retorna `reconciliar`; a próxima tentativa é somente consulta.
- Consulta após resultado ambíguo não encontrado: permanece em reconciliação, sem novo POST automático.
- O Harvest exige recibo com `origem_confirmacao=api_leads`, `tenant_id`, `idempotency_key`, `codigo_anuncio` e ID correspondente.

## 2. Um único escritor durante o cutover

`scripts/realize-cutover.mjs:prepararCutover` recebe os exports atuais e transforma cópias offline, mantendo IDs, conexões da planilha, resposta do protocolo e referências das credenciais existentes. Não faz chamadas de rede.

Nas origens, o nó de chamada direta ao child é **substituído**, não duplicado, por captura autenticada no Harvest. No child, retry é desativado e o HTTP passa a devolver resposta completa para auditoria sanitizada. Os três resultados saem com `active=false`.

O bridge usa a conexão n8n existente para ler os três workflows **publicados** antes de permitir qualquer escrita. `validarEscritorUnico` recusa:

- publicação/versão não confirmada;
- qualquer origem ainda conectada por subworkflow ao escritor antigo;
- zero ou mais de um caminho HTTP de captura após a planilha;
- destino/credencial de captura não conferidos;
- child ainda com retry automático ou sem resposta HTTP completa.

Os nós de leitura devem selecionar a credencial n8n institucional já existente; isso não cria outro MCP. Falha de leitura bloqueia o caminho de escrita.

Plano versionado: `n8n/realize-cutover-plan.json`. **Antes de ativar**: exportar novamente, pausar intake em janela controlada, drenar as execuções antigas/childs assíncronos/retries/em espera, revisar e publicar os três patches na mesma janela e conferir o grafo publicado. Só depois liberar o cadastro CRM. Essa drenagem evita sobreposição com execuções antigas que usam snapshot do workflow anterior. O código não marca esse procedimento como concluído nem muda os workflows ativos nesta entrega.

## 3. Migration 054 contra o schema atual

Foi inspecionado o catálogo PostgreSQL atual: tipos, defaults, constraints e assinaturas de funções das tabelas referenciadas. Não foram lidas linhas de leads ou valores de credenciais. A função existente `crm_validar_atendimento_canal()` é reutilizada para a nova tabela de pausas.

Correções na migration:

- exige `evidencia_homologacao IS NOT NULL` explicitamente; CHECK SQL não pode aceitar aprovação incompleta pela lógica de NULL;
- ledger distingue `cancelado` de `incerto`: só reserva conhecida como não enviada pode ser liberada/repetida;
- pausa humana independente da existência da sessão, por conta/canal/telefone;
- RPCs de assunção/liberação e cancelamento atômicos, restritos à service role;
- isolamento de canal e workspace preservado.

Validações executadas:

1. **PGlite/PostgreSQL em memória**, com DDL real das migrations anteriores e constraints/funções existentes. Bootstrap apenas de `auth`/`storage`. O seed legado da migration 028 contém `RECORD[]`/`conta_modulos` e foi excluído da reprodução de schema; seu DDL permanece integral e a migration histórica não foi alterada.
2. **PostgreSQL 15 atual do Harvest**, via `scripts/test-bdr-postgres.mjs --rollback-only`, com dados fictícios em tenants aleatórios, `lock_timeout=2s`, `statement_timeout=20s` e **ROLLBACK obrigatório**. Verificados: assunção pré-sessão, inbound preservado, dedupe, liberação/versionamento, cancelamento conhecido, proteção de envio confirmado, captura LP/minichat convergente, origem imutável e permissões RPC.

Saída da execução real:

```text
NOTICE: PASS BDR: schema atual, ownership, cancelamento, dedupe LP/minichat, origem e permissões
ROLLBACK
rollback_confirmado
t
```

Blob Git da migration validada: `1de3af216e22330e87de3ad4f0f176f853cb1925`. Nenhuma tabela BDR ou linha de teste permaneceu no banco operacional; a migration ainda precisa de aplicação autorizada após revisão. Como é próprio do PostgreSQL, sequências/identities usadas pelos inserts fictícios podem avançar mesmo com ROLLBACK; não houve reaproveitamento ou alteração de leads existentes.

## 4. Apontamentos adicionais do review

- Review `4494128616`: reserva abortada no último check agora é cancelada atomicamente, sem travar a mensagem nova. Timeout após invocar transporte continua `incerto`, sem retry cego.
- Review `4494128628`: assunção Chatwoot anterior ao primeiro inbound fica persistida em `bdr_pausas`. Inbound atribuído aplica pausa e ainda passa pela pipeline canônica, mantendo a Inbox e a auditoria.

## 5. Testes e reprodução

- Suíte geral: **77/77 aprovada**.
- `npm run test:bdr`: **22/22 aprovados**, incluindo os dois testes SQL, os Code nodes do artefato real e regressões de ownership/cancelamento.
- TypeScript e build de produção: **aprovados**; 77 páginas estáticas geradas.
- `node scripts/realize-bridge-artifact.mjs`: verifica que o export versionado corresponde ao gerador/contratos testados.
- PostgreSQL operacional: dry-run transacional aprovado, sem persistência.

Executar uma etapa por vez com `NODE_OPTIONS=--max-old-space-size=1024`, `UV_THREADPOOL_SIZE=1`, `--test-concurrency=1`; build com `HARVEST_BUILD_CPUS=1`.

O export n8n é gerado e inativo. A configuração `app/vercel.json` bloqueia previews automáticos apenas desta branch de revisão. Não altera deployments da `main`. Atendimento real continua desativado, sem reinstalação de serviços ou mudança de credenciais protegidas.
