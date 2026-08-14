# Relatório de Entregas — Harvest AI

> Relatório cumulativo. Cada fase adiciona uma nova seção "Entrega NN" sem apagar as anteriores.

---

## Entrega 01 — Organização e migração

**Data:** 2026-08-12
**Escopo:** INSTITUCIONAL — Harvest AI
**Executor:** Orquestrador Estratégico Figueira (Claude, Cowork)

### Ações executadas

1. Consulta prévia: `/Users/gui_t/Figueira_Marketing/AGENTS.md`, Brain (`brain/00-sistema/CONSTITUICAO.md` referenciado, `PRECEDENCIA.md`, `GOVERNANCA-AGENTES.md`, `POLITICA-DOCUMENTACAO-OFICIAL.md`), documentação atual do Harvest (`00_ADMIN/contexto-do-projeto.md`, `decisoes.md`, `lousa-orquestracao.md`, Auditoria V2 BUILD vs REUSE), estado real do Git em `CODIGO/harvest-ai/` e produção.
2. Descoberta de estado real desatualizado nos documentos: `lousa-orquestracao.md` registrava HAI-001A como "pronto para aplicar", mas o Git mostra o merge já concluído em 2026-08-07 (`e9d8d8f`). Também identificada uma feature completa não documentada em `00_ADMIN/`: integração WAHA como segundo provedor de WhatsApp (10 commits, 2026-08-08 a 2026-08-12, HEAD atual `5c418f3`).
3. Cópia integral (rsync -a, preservando metadados, permissões e `.git`) de `/Volumes/HD EXTERNO/FIGUEIRA/HARVEST_AI` para o caminho canônico `/Users/gui_t/Figueira_Marketing/apps/Harvest_ai`. Origem **não foi apagada nem modificada**.
4. Criação dos dois documentos institucionais desta fase (ver "Arquivos criados").

### Implementações já concluídas (registro — não executadas nesta fase, apenas documentadas)

- **HAI-001A — Isolamento multi-tenant `(conta_id, place_id)`:** concluído e mesclado em `main` (`ddd22d6` → merge `e9d8d8f`, 2026-08-07). Estava documentado como pendente; corrigido nesta entrega no Plano Mestre.
- **Integração WAHA (segundo provedor WhatsApp):** concluída no código entre 2026-08-08 e 2026-08-12 — spec, plano de implementação, coluna `whatsapp_provider` em `conta_credenciais`, client WAHA (`lib/waha.ts`), rota `/api/waha/session`, seletor de provedor + QR em Configurações, rotas de disparo/validação com suporte a WAHA, hardening pós-revisão (degradação graciosa, isolamento de operador, limites de concorrência), e regra final de fonte única de verdade sem fallback silencioso (`5c418f3`). **Não possui ADR formal em `decisoes.md`** — registrado como pendência.

### Arquivos criados

- `/Users/gui_t/Figueira_Marketing/apps/Harvest_ai/00_ADMIN/PLANO_MESTRE_HARVEST.md` (novo)
- `/Users/gui_t/Figueira_Marketing/apps/Harvest_ai/00_ADMIN/RELATORIO_ENTREGAS.md` (novo, este arquivo)

### Arquivos alterados

- Nenhum arquivo de código ou documentação pré-existente foi alterado. Nenhuma feature nova foi iniciada, conforme escopo da Fase 1.

### Validações executadas

| Item | Origem | Destino | Resultado |
|---|---|---|---|
| Caminho | `/Volumes/HD EXTERNO/FIGUEIRA/HARVEST_AI` | `/Users/gui_t/Figueira_Marketing/apps/Harvest_ai` | OK |
| Contagem de arquivos (excl. resource forks `._*`) | 12.143 | 12.143 | ✅ Idêntico |
| Contagem de diretórios | 1.687 | 1.687 | ✅ Idêntico |
| Git branch (`CODIGO/harvest-ai`) | `main` | `main` | ✅ Idêntico |
| Git status | limpo, sincronizado com `origin/main` | limpo, sincronizado com `origin/main` | ✅ Idêntico |
| Git remote | `https://github.com/tuco-gui/harvest-ai.git` | `https://github.com/tuco-gui/harvest-ai.git` | ✅ Idêntico |
| Git HEAD | `5c418f3d0cf8a0118e04d20ca0582e255d167fbb` | `5c418f3d0cf8a0118e04d20ca0582e255d167fbb` | ✅ Idêntico |
| `git worktree list` | 1 worktree (a própria raiz) | 1 worktree (a própria raiz) | ✅ Sem worktrees vinculados a caminhos externos |
| Hash SHA-256 — `README.md` (raiz) | `3bcba64...` | `3bcba64...` | ✅ Idêntico |
| Hash SHA-256 — `00_ADMIN/decisoes.md` | `808296c...` | `808296c...` | ✅ Idêntico |
| Hash SHA-256 — `00_ADMIN/lousa-orquestracao.md` | `18f8365...` | `18f8365...` | ✅ Idêntico |
| Hash SHA-256 — `CODIGO/harvest-ai/README.md` | `711a1e1...` | `711a1e1...` | ✅ Idêntico |
| Hash SHA-256 — `CODIGO/harvest-ai/app/package.json` | `a29b8ce...` | `a29b8ce...` | ✅ Idêntico |
| Hash SHA-256 — `CODIGO/harvest-ai/app/package-lock.json` | `947dae1...` | `947dae1...` | ✅ Idêntico |

**Nota sobre tamanho em disco:** `du -sh` reporta ~3,9 GB na origem (HD externo) e ~669 MB no destino (SSD interno) para o mesmo conteúdo. Diferença é atribuída ao tamanho de bloco/alocação do filesystem do HD externo (não a perda de dados) — confirmado pela contagem de arquivos idêntica e hashes idênticos nos arquivos críticos amostrados, incluindo dentro de `node_modules`.

### Problemas encontrados

- Documentação operacional (`lousa-orquestracao.md`, `decisoes.md`, `contexto-do-projeto.md`) estava desatualizada em relação ao Git real (HAI-001A já mesclado; integração WAHA implementada e não documentada). Corrigido no `PLANO_MESTRE_HARVEST.md`; os arquivos originais não foram editados nesta fase (fora do escopo — apenas leitura).
- Diretório `.worktrees/` existe em `CODIGO/harvest-ai/` mas está vazio e sem worktrees Git vinculados (confirmado via `git worktree list`); ignorado desde o commit `27b6299` (`.gitignore`). Sem impacto na migração.
- `du -sh` reporta tamanhos muito diferentes entre origem e destino (ver nota acima) — investigado e não é perda de dados.

### Pendências (para próximas fases)

1. Formalizar ADR da integração WAHA em `00_ADMIN/decisoes.md` (documentação apenas — não é implementação nova).
2. Confirmar se **ROT-001** (rotação de segredos expostos — Supabase service role, Baserow token, `.claude/settings.local.json`) já foi executado; se não, é ação crítica de segurança pendente.
3. HAI-001B (criptografia de credenciais no banco) e RLS-001 (auditoria de policies) seguem não iniciados.
4. Origem em `/Volumes/HD EXTERNO/FIGUEIRA/HARVEST_AI` **permanece intacta** — decisão sobre quando descontinuá-la como referência fica para uma fase futura, mediante aprovação explícita.
5. Nenhum deploy, alteração de produção, ou implementação de CRM/Chatwoot/Twenty/Vine foi realizada — todos fora do escopo desta fase.

---

*Próxima seção ("Entrega 02 — ...") deve ser adicionada abaixo desta linha, sem apagar o conteúdo acima.*

## Entrega 02 — Correção de governança do Plano Mestre

**Data:** 2026-08-13
**Escopo:** INSTITUCIONAL — Harvest AI
**Executor:** Orquestrador Estratégico Figueira (Claude, Cowork)
**Autorização:** explícita de Guilherme, restrita a `00_ADMIN/PLANO_MESTRE_HARVEST.md`

### Trechos corrigidos

1. **Infraestrutura de produção** (seção 7): removida referência incorreta a "Next.js/Vercel". Corrigido para: produção na **VPS Figueira**, orquestração **Docker Swarm**, proxy **Traefik**, deploy por imagem/container, banco Supabase.
2. **Roadmap técnico, item CI-001** (seção 4): removida referência a "Vercel"; substituída por build de imagem/container + deploy via Docker Swarm/Traefik na VPS Figueira.
3. **Decisão de escopo de produto** (seção 1 e seção 5): ADR-002 mantido como histórico e marcado como atualizado; adicionado **ADR-007** (novo, Aceito, 2026-08-13) — Harvest é a experiência principal/unificada; Twenty é o motor de CRM; Chatwoot é o motor de conversas; Harvest pode expor CRM/pipeline/conversas/mensageria na própria UX sem reconstruir a lógica interna desses produtos.
4. **Visão modular de SaaS** (nova seção 1.1): registrados os planos CRM / CRM+Mensageria / CRM+Prospecção / Completo, explicitamente sem billing implementado.
5. **Roadmap comercial** (nova seção 4.1): registrada a ordem campanha_leads → histórico de contato → inbound → opt-out/supressão → pipeline outbound → Chatwoot → Twenty → experiência unificada → IA/classificação → fila/idempotência → enriquecimento → atribuição Meta/Google → planos SaaS. HAI-001B, RLS-001 e ROT-001 **não foram removidos** — permanecem no roadmap técnico (seção 4) e nos alertas críticos (seção 8).
6. **VineCRM** (seção 5): formalizado como (1) implementação anterior do mesmo esforço, (2) referência de UX, (3) possível fonte de componentes/código — explicitamente **não é um terceiro produto**.

### Motivo

Revisão da Entrega 01 identificou: (a) inconsistência factual sobre a infraestrutura de produção (documento afirmava Vercel; produção real roda em VPS própria com Docker Swarm/Traefik); (b) decisão de escopo de produto desatualizada frente à direção comercial atual (Harvest como experiência unificada expondo CRM/mensageria, não apenas "não vira CRM"); (c) ausência de visão modular de planos e de roadmap comercial no documento mestre; (d) posicionamento do VineCRM não estava formalizado como não-produto.

### Arquivos alterados

- `/Users/gui_t/Figueira_Marketing/apps/Harvest_ai/00_ADMIN/PLANO_MESTRE_HARVEST.md` (editado — 149 → 195 linhas)
- `/Users/gui_t/Figueira_Marketing/apps/Harvest_ai/00_ADMIN/RELATORIO_ENTREGAS.md` (esta seção, adicionada)

### Alterações de código/produção

**Nenhuma.** Esta entrega é exclusivamente documental/governança, restrita ao arquivo autorizado. Nenhum código, configuração de infraestrutura, deploy ou dado de produção foi alterado.

## Entrega 04 — Fase 3A: Base outbound e proteção

**Data:** 2026-08-13
**Escopo:** INSTITUCIONAL — Harvest AI (código local, `CODIGO/harvest-ai`)
**Branch local:** `feat/fase-3a-base-outbound-protecao` (commit `710767f`, não enviado ao remoto)
**Objetivo:** base segura para campanhas, histórico, inbound e atendimento por IA (etapa 1 do roadmap comercial).

### Implementado

1. **`campanha_leads`** — relação N:N entre lead e campanha (`sql/016_base_outbound_protecao.sql`), com backfill dos vínculos já implícitos em `prospecta_leads.campanha_id`. A coluna original é preservada como "campanha de origem"; o histórico completo de em quais campanhas um lead esteve passa a viver nesta tabela. `lib/leads.ts` (`salvarLeads`) e `api/disparo/route.ts` gravam o vínculo automaticamente, para leads novos e repetidos.
2. **Histórico de contato** (`historico_contato`) — uma linha por tentativa de disparo (data/hora, campanha, provider, status, origem), indexado por telefone (não só por lead_id, porque o mesmo número pode reaparecer sob lead diferente). Populado em todo caminho de `api/disparo`: sucesso, erro de provider, e bloqueio por supressão.
3. **Proteção contra contato duplicado** — `lib/historicoContato.ts::contatoJaAbordado` consulta a última tentativa por telefone e devolve data/campanha/status. É puramente informativo (retornado como `contatoAnterior` na resposta de `/api/disparo`); **não bloqueia** o envio, conforme especificado.
4. **`conta_supressao`** — supressão central por `(conta_id, telefone normalizado)`, independente de campanha e de provider.
5. **Barreira final pré-envio** — `estaSuprimido` é checado duas vezes em `api/disparo/route.ts`: (a) assim que o provider é conhecido, antes de gastar uma chamada de IA; (b) imediatamente antes da chamada real ao WAHA/Evolution, cobrindo o caso de o contato ser suprimido durante a geração da mensagem. Nos dois pontos, um bloqueio é registrado em `historico_contato` com `status='bloqueado_supressao'`.
6. **Dois providers mantidos** — nenhuma alteração na lógica de seleção WAHA/Evolution (`usaWaha`/`ehWaha`) nem nas chamadas de envio em si; a proteção nova envolve essas chamadas sem alterá-las. Sem fallback silencioso (comportamento pré-existente intocado).
7. **Normalização de telefone unificada** — `lib/telefone.ts` extrai a lógica que já existia duplicada (inline) em `api/busca/route.ts` e `componentes/Prospeccao.tsx`. As duas cópias antigas **não foram tocadas** (fora do escopo desta fase); só o código novo usa a versão canônica.

### Não implementado nesta fase (fora de escopo, conforme instrução)

Pipeline Kanban, Twenty, Chatwoot, IA atendente, cadências, atribuição, redesign de UI. A UI existente (Prospecção/Campanhas) não foi alterada — `contatoAnterior` é devolvido pela API mas ainda não é consumido por nenhum componente React (previsto para a Fase 3F, "UX operacional mínima"). Vine CRM não foi tocado.

### Arquivos alterados/criados

- `sql/016_base_outbound_protecao.sql` (novo — migration)
- `tests/sql/verificar_016_base_outbound_protecao.sql` (novo — verificação SQL não destrutiva)
- `app/src/lib/telefone.ts` (novo)
- `app/src/lib/supressao.ts` (novo)
- `app/src/lib/historicoContato.ts` (novo)
- `app/src/lib/campanhaLeads.ts` (novo)
- `app/src/lib/leads.ts` (editado — `salvarLeads` grava `campanha_leads`)
- `app/src/app/api/disparo/route.ts` (editado — barreiras de supressão, histórico, vínculo de campanha)
- `tests/telefone.test.js` (novo)
- `tests/protecao-outbound.test.js` (novo)

### Migrations criadas (não aplicadas em produção)

`sql/016_base_outbound_protecao.sql` — cria `campanha_leads`, `historico_contato`, `conta_supressao` com RLS, grants e backfill. **Não executada.** Rodar com `./scripts/sql.sh -f sql/016_base_outbound_protecao.sql` quando aprovado (script fala direto com o Supabase self-hosted de produção — por isso não foi rodado nesta fase).

### Testes e QA local

| Item do QA pedido | Como foi validado | Resultado |
|---|---|---|
| Mesmo lead em duas campanhas | `tests/protecao-outbound.test.js` (simulação da constraint) + `tests/sql/verificar_016_...sql` (insere de fato 2 vínculos e conta) | OK |
| Histórico preservado | `verificar_016_...sql` — 2 tentativas por telefone, providers diferentes | OK |
| Telefone normalizado | `tests/telefone.test.js` — formatações diferentes colapsam no mesmo valor | OK |
| Contato já abordado detectado | `contatoJaAbordado` implementado e revisado por leitura; sem instância Supabase disponível nesta sessão para teste de integração ponta a ponta | Implementado, **não testado contra banco real** |
| Opt-out central bloqueando envio | `tests/protecao-outbound.test.js` (`podeEnviar`) + `verificar_016_...sql` (isolamento por conta) + leitura do fluxo em `disparo/route.ts` | OK na lógica; **não testado contra banco real** |
| Isolamento por `conta_id` | `verificar_016_...sql`, item 5 (telefone suprimido em conta A não aparece suprimido em conta B) | OK |
| Sem regressão no envio WAHA/Evolution | Chamadas de envio (`wahaSendText`, fetch Evolution) e seleção de provider não foram alteradas, só envolvidas pelas barreiras; `npx tsc --noEmit` e `npm run build` passaram limpos | OK |
| Build | `npm run build` (Next.js 15.1.3) — compilou, checou tipos, gerou as 33 páginas/rotas, incluindo `/api/disparo` | ✅ Passou |

**Lint:** `npm run lint` pediu configuração inicial interativa do ESLint (nenhum `.eslintrc`/config commitado no repo) — condição pré-existente, não relacionada a esta entrega. Não configurado nesta fase para não tomar uma decisão de tooling fora do escopo pedido.

**Limite importante:** os testes automatizados validam a lógica pura (normalização, decisão de bloqueio, idempotência de vínculo) e o schema SQL isoladamente. Nenhuma chamada real ao Supabase de produção foi feita — não há credenciais/ambiente de teste disponíveis nesta sessão. A validação ponta a ponta (API `/api/disparo` completa, com banco real) só é possível depois de aplicar a migration.

### Pendências para produção (requerem aprovação explícita — não executadas)

1. **Aplicar `sql/016_base_outbound_protecao.sql`** no Supabase de produção via `./scripts/sql.sh -f sql/016_base_outbound_protecao.sql` (script fala direto com a URL de produção lida do `.env`).
2. **Rodar `tests/sql/verificar_016_base_outbound_protecao.sql`** logo depois, para confirmar em produção. Corrigido no fechamento desta entrega: o script agora roda dentro de `begin;`/`rollback;` — os dados de teste ("3A Teste") não sobrevivem, passando ou falhando a verificação. Não requer limpeza manual.
3. **Merge da branch `feat/fase-3a-base-outbound-protecao`** em `main` e push — não feito nesta fase (fica local).
4. Depois da migration aplicada: revisar se `historico_contato`/`campanha_leads` devem entrar em algum job de retenção/expurgo (não avaliado nesta fase).

### Próximo passo recomendado

Fase 3B (Inbound: WAHA, Evolution, normalização de eventos) pode começar assim que a migration desta entrega for aplicada — `historico_contato` e `campanha_leads` são pré-requisito de dados para o que 3B/3C vão consumir (registrar resposta, opt-out).

### Fechamento pré-produção (2026-08-13)

Trabalho local antes de aplicar a migration em produção — nenhum write em produção foi feito nesta parte:

- **Correção do verificador:** `tests/sql/verificar_016_base_outbound_protecao.sql` passou a rodar dentro de `begin;`/`rollback;`. Antes, os dados de teste ("3A Teste") ficariam gravados permanentemente ao rodar contra produção; agora nada sobrevive, passando ou falhando a verificação. A migration `sql/016_base_outbound_protecao.sql` **não foi alterada**.
- **Atualização do Plano Mestre:** `00_ADMIN/PLANO_MESTRE_HARVEST.md` sincronizado com a meta operacional até 17/08/2026 (seção 1.2), a ordem vigente 3A→3F + depois (seção 4.1, reescrita com tabela de status por fase), a Fase 3A marcada como `IMPLEMENTADA LOCALMENTE — AGUARDANDO MIGRATION/DEPLOY`, e a nomenclatura Conversas ≠ Chamados registrada explicitamente (seção 3) para não colidir quando a Fase 3D for implementada. Decisões mantidas (WAHA+Evolution configuráveis por conta sem fallback silencioso; Harvest/Supabase = prospecção/outbound; Chatwoot = conversas; Twenty = CRM pós-qualificação) reforçadas na seção 5.
- **Nenhum write em produção ainda:** migration 016 não aplicada, verificação não rodada contra produção, branch `feat/fase-3a-base-outbound-protecao` (commit `710767f`) segue só local, sem merge/push, sem deploy.

### Execução em produção (2026-08-13)

Autorização explícita recebida para aplicar em produção. Ordem executada:

1. **Migration aplicada** — `./scripts/sql.sh -f sql/016_base_outbound_protecao.sql` contra o Supabase self-hosted de produção. Exit 0, sem erros.
2. **Verificador transacional rodado em produção** — `./scripts/sql.sh -f tests/sql/verificar_016_base_outbound_protecao.sql`. Todas as asserções passaram (N:N campanha_leads, duplicata bloqueada, histórico com 2 providers, supressão única e isolada por conta) e o `ROLLBACK` limpou tudo. Confirmado por consulta independente pós-verificação: **zero linhas** com dados "3A Teste" em `contas`, `prospecta_leads`, `campanha_leads`, `historico_contato` e `conta_supressao`.
3. **Schema validado em produção (read-only):**
   - As 3 tabelas existem; RLS ativo nas 3 (`relrowsecurity = true`).
   - Policies `*_por_conta` presentes e idênticas ao padrão do resto do sistema: `(conta_id = minha_conta()) OR sou_super_admin()`.
   - Constraints corretas: `campanha_leads` com `UNIQUE (campanha_id, lead_id)`; `conta_supressao` com `UNIQUE (conta_id, telefone)`; FKs com `ON DELETE CASCADE`/`SET NULL` conforme a migration.
   - Índices presentes nas 3 tabelas (conta_id, lead_id, campanha_id, telefone).
   - Backfill correto: 26 leads com `campanha_id` preenchido em `prospecta_leads` → 26 vínculos criados em `campanha_leads`, 0 pendências.
4. **Merge e push** — branch `feat/fase-3a-base-outbound-protecao` (commits `710767f`, `1afb3cc`) enviada ao remoto; merge fast-forward em `main` (`5c418f3..1afb3cc`); `main` enviada ao GitHub.
5. **Deploy oficial (VPS Figueira + Docker Swarm + Traefik):**
   - Push para `main` (alterando `app/**`) disparou o workflow `Publicar imagem` no GitHub Actions automaticamente — build e push da imagem para `ghcr.io/tuco-gui/harvest-ai`, tags `latest` e `1afb3cca825ff64bf0c480270e1b7db1e186484b`. Sucesso em 1m12s.
   - Atualização do serviço na VPS via SSH: `docker service update --image ghcr.io/tuco-gui/harvest-ai:1afb3cca825ff64bf0c480270e1b7db1e186484b --force harvest_harvest`. Serviço convergiu (`Service harvest_harvest converged`), tarefa antiga (`5c418f3`) desligada de forma limpa, sem downtime observável (1 réplica, rolling update padrão do Swarm).
6. **QA pós-deploy (não destrutivo, sem envio real de WhatsApp):**
   - Logs do serviço pós-deploy: `Next.js 15.1.3 ✓ Ready`, sem erros/exceptions.
   - `GET /` → 307 para `/entrar` (middleware de autenticação funcionando); `GET /entrar` → 200; `GET /dashboard` sem sessão → 307 para `/entrar`; `POST /api/disparo` sem sessão → 307 para `/entrar` (rota protegida, sem crash).
   - Sem regressão de dados: contagens em produção pós-deploy — 2 contas, 179 leads, 12 campanhas, 2 registros em `conta_credenciais` (todas as contagens condizem com o estado pré-migration; nenhuma linha perdida).
   - Provider por conta sem ambiguidade: das 2 contas com credenciais, 1 usa `waha` e 1 usa `evolution`, nenhuma com `whatsapp_provider` nulo — confirma que a resolução de provider (`usaWaha`/`ehWaha`) segue como fonte única de verdade, sem espaço para fallback silencioso.
   - **Bloqueio de contato suprimido e registro de histórico:** validados estruturalmente contra o schema real de produção pelo verificador transacional do passo 2 (mesma constraint `UNIQUE (conta_id, telefone)` e isolamento por conta que a rota `/api/disparo` usa em tempo de execução) e pelos testes locais (`tests/protecao-outbound.test.js`) rodados contra o **mesmo commit** (`1afb3cc`) agora em produção. Não foi disparada nenhuma mensagem real a um lead real nesta verificação — decisão deliberada para não gerar contato indevido durante o QA.
   - **Nenhum incidente.** Nenhum rollback (nem da migration, nem do deploy) foi necessário.
7. **Status final:** Fase 3A **concluída em produção**. Ambas as tabelas novas já têm dados reais (backfill de 26 vínculos); a partir de agora, qualquer rollback que envolva `drop` dessas tabelas precisa de nova avaliação (pode haver tráfego real acumulado desde o deploy).

---

## Entrega 05 — Fase 3B: Inbound multiprovedor

**Data:** 2026-08-13
**Escopo:** INSTITUCIONAL — Harvest AI (código local, `CODIGO/harvest-ai`)
**Branch local:** `feat/fase-3b-inbound-multiprovedor` (commit `05514b8`, não enviado ao remoto)
**Objetivo:** camada única de inbound (WAHA + Evolution → formato interno comum), preparando dados para a Fase 3C (opt-out/status de resposta) e 3D (Chatwoot + IA).

### Arquitetura implementada

```
webhook WAHA  ──┐                                      ┌── historico_contato (última campanha)
                ├─► adapter → evento normalizado ──┐    │
webhook Evol.  ──┘                                 ├─► resolução de conta ─► idempotência ─► vínculo lead/histórico ─► inbound_eventos
                                                    │
                                          (mesmo formato interno,
                                           não importa o provider)
```

Rotas (`app/api/webhook/waha`, `app/api/webhook/evolution`) são finas de propósito: só parsing + adapter + chamada ao pipeline comum (`lib/inbound.ts`). Nenhuma lógica comercial duplicada entre os dois webhooks.

### Implementado

1. **Modelo normalizado (`lib/inboundTipos.ts`)** — `EventoInboundNormalizado`: `provider`, `telefone` (normalizado), `mensagem`, `messageIdExterno`, `timestamp`, `nomeContato`, `tipoMensagem` (texto/mídia/outro), `fromMe`, `payloadBruto` (guardado só como referência/auditoria, nunca usado para decisão de negócio). `contaId`/`leadId`/`campanhaId` são resolvidos DEPOIS da normalização, nunca vêm do payload externo.
2. **Adapter WAHA (`lib/inboundWaha.ts`)** — converte `{ event, session, payload: { id, from, fromMe, body, hasMedia, notifyName, timestamp } }` para o formato interno. Ignora eventos que não são `message`/`message.any` (ack, state.change etc.) e mensagens de grupo (`@g.us` — fora de escopo desta fase, não há um único telefone/lead a correlacionar).
3. **Adapter Evolution (`lib/inboundEvolution.ts`)** — converte `{ event: "messages.upsert", instance, data: { key: { id, fromMe, remoteJid }, pushName, message, messageTimestamp } }` para o MESMO formato interno. Mesmas regras de descarte (evento diferente de `messages.upsert`, mensagens de grupo).
4. **Resolução de conta (`lib/inboundConta.ts`)** — nunca confia em `conta_id` vindo do payload externo:
   - **WAHA:** reconstrói o `conta_id` a partir do nome da sessão (`conta_<uuid sem hífen>`, mesma função determinística de `lib/waha.ts`) e CONFIRMA contra `conta_credenciais` que a conta existe e está de fato configurada como `waha`.
   - **Evolution:** busca em `conta_credenciais` por `evolution_instancia` + `whatsapp_provider = 'evolution'`; só resolve se encontrar exatamente 1 conta (0 ou mais de 1 = não resolve).
   - Se não resolver: `console.error` estruturado (sem gravar nada em tabela de tenant nenhuma) e retorno técnico `conta_nao_resolvida` — nunca associa à conta errada.
5. **Idempotência (`lib/inbound.ts` + `sql/017_inbound_eventos.sql`)** — checa existência por `(conta_id, provider, message_id_externo)` antes de processar; unique constraint no banco como backstop de corrida (trata `23505` como duplicata, não como erro).
6. **Vínculo com histórico existente** — localiza lead só por telefone normalizado + `conta_id` (nunca por nome/fuzzy); busca o `campanha_id` do último `historico_contato` para aquele telefone/conta como preparação para a Fase 3C. Telefone sem lead correspondente ainda é aceito como evento válido (`lead_id = null`), sem inventar vínculo.
7. **`fromMe` descartado no pipeline** — mensagens ecoadas do próprio Harvest nunca viram "resposta recebida" (checagem é a primeira coisa que `processarEventoInbound` faz).
8. **Dois providers, mesmo pipeline** — nenhuma duplicação de lógica comercial entre os adapters; WAHA e Evolution seguem configuráveis por conta, sem fallback silencioso (mesma regra da Fase 3A).

### Não implementado nesta fase (fora de escopo, conforme instrução)

Chatwoot, IA atendente, Twenty, pipeline visual, UI Vine, cadências, classificação avançada de resposta (opt-out/respondeu fica para a Fase 3C — este pipeline só prepara os dados: telefone, lead, última campanha).

### Arquivos criados

- `sql/017_inbound_eventos.sql` (novo — migration, **não aplicada em produção**)
- `app/src/lib/inboundTipos.ts` (novo)
- `app/src/lib/inboundWaha.ts` (novo)
- `app/src/lib/inboundEvolution.ts` (novo)
- `app/src/lib/inboundConta.ts` (novo)
- `app/src/lib/inbound.ts` (novo — pipeline comum)
- `app/src/app/api/webhook/waha/route.ts` (novo)
- `app/src/app/api/webhook/evolution/route.ts` (novo)
- `tests/inbound.test.js` (novo)

Nenhum arquivo existente foi alterado — Fase 3B é aditiva.

### Migration criada (não aplicada em produção)

`sql/017_inbound_eventos.sql` — cria `inbound_eventos` (RLS por conta, unique `(conta_id, provider, message_id_externo)`). **Não executada.** Rodar com `./scripts/sql.sh -f sql/017_inbound_eventos.sql` quando aprovado.

### Testes e QA local

| Item do QA pedido | Como foi validado | Resultado |
|---|---|---|
| Payload WAHA válido | `tests/inbound.test.js` — normaliza campos, telefone, mensagem, tipo | OK |
| Payload Evolution válido | idem, formato `messages.upsert` | OK |
| Mesmo formato interno após normalização | `assert.deepStrictEqual` nas chaves dos dois eventos normalizados | OK |
| Telefone normalizado | jid sem DDI explícito normaliza igual ao jid completo (mesma premissa de `telefone.test.js`) | OK |
| Identificação correta da conta | reconstrução determinística da sessão WAHA → `conta_id` exato; nomes fora do padrão não resolvem | OK |
| Mensagem duplicada não processada duas vezes | simulação de `(conta_id, provider, message_id_externo)` já visto | OK |
| Mensagem do próprio sistema ignorada | `fromMe: true` — pipeline descarta antes de qualquer outra coisa | OK |
| Conta desconhecida não contamina outro tenant | sessão/UUID malformado não resolve conta nenhuma; sem conta, pipeline retorna erro técnico sem gravar | OK |
| Lead existente localizado | busca por telefone normalizado + conta_id | OK |
| Telefone desconhecido aceito sem inventar vínculo | busca sem resultado não bloqueia o evento, só deixa `leadId = null` | OK |
| Regressão | `telefone.test.js`, `protecao-outbound.test.js`, `envio.test.js` — todos passando | OK |
| `npx tsc --noEmit` | sem erros | ✅ Passou |
| `npm run build` | compilou, gerou as 37 rotas incluindo `/api/webhook/waha` e `/api/webhook/evolution` | ✅ Passou |

**Limite importante — payloads reais não verificados:** os formatos de payload do WAHA e da Evolution usados nos adapters são baseados na documentação pública de cada projeto (WAHA: `waha.devlike.pro/docs/how-to/receive-messages` e `/how-to/event-message`; Evolution: documentação pública + issues do repositório oficial), **não em um webhook real desta instância**. Antes de cadastrar o webhook em produção, é necessário capturar 1 payload real de cada provider e conferir se os nomes de campo batem com o que os adapters esperam — isso está marcado como pendência abaixo, não como HIPÓTESE silenciosa.

### Pendências para produção (requerem aprovação explícita — não executadas)

1. **Aplicar `sql/017_inbound_eventos.sql`** no Supabase de produção via `./scripts/sql.sh -f sql/017_inbound_eventos.sql`.
2. **Capturar e validar 1 payload real de cada provider** antes de confiar cegamente nos adapters — o formato foi implementado a partir de documentação pública, não de um webhook real desta instância (ver limite acima).
3. **Cadastrar o webhook real no WAHA** apontando para `https://harvest.figueiramarketing.com.br/api/webhook/waha`.
4. **Cadastrar o webhook real na Evolution** apontando para `https://harvest.figueiramarketing.com.br/api/webhook/evolution/<EVOLUTION_WEBHOOK_TOKEN>` (rota passou a exigir o token no caminho — ver Fechamento pré-produção abaixo), com `webhookByEvents: false`.
5. **Merge da branch `feat/fase-3b-inbound-multiprovedor`** em `main` e push — não feito nesta fase.
6. **Deploy** (imagem + `docker service update` na VPS, mesmo processo da Fase 3A) — não feito nesta fase.
7. **Gerar e definir `WAHA_WEBHOOK_HMAC_KEY` e `EVOLUTION_WEBHOOK_TOKEN`** na stack de produção (Portainer) — sem essas duas variáveis, as rotas rejeitam 100% dos webhooks (proposital, ver Fechamento pré-produção). A mesma `WAHA_WEBHOOK_HMAC_KEY` também precisa ser configurada no lado do WAHA (`config.webhooks[].hmac.key`) — ver `docs/inbound-webhooks.md`.

### Próximo passo recomendado

Fase 3C (opt-out e status de resposta) pode começar assim que a migration desta entrega for aplicada e pelo menos um payload real de cada provider tiver sido validado — `inbound_eventos` é o dado de entrada que 3C vai classificar (respondeu, opt-out, etc.).

### Fechamento pré-produção (2026-08-13)

Trabalho local de preparação — nenhum write em produção, nenhuma alteração de webhook real, nenhum merge/push:

- **Migration 017 revisada:** schema confirmado 100% aditivo (1 tabela nova, nenhuma tabela existente tocada); RLS ativa com a mesma policy-padrão (`conta_id = minha_conta() ou sou_super_admin()`); isolamento por `conta_id`; `UNIQUE (conta_id, provider, message_id_externo)` é a idempotência; índices em `conta_id`, `(conta_id, telefone)` e `lead_id`. Comentário de rollback explícito adicionado ao arquivo (drop da policy + da tabela — só se necessário e só antes de tráfego real).
- **Verificador criado:** `tests/sql/verificar_017_inbound_eventos.sql`, mesmo padrão `begin;`/`rollback;` da 016 — testa idempotência, isolamento entre contas, `message_id` repetido em contas diferentes (não deve conflitar, já que a constraint é por conta) e telefone sem lead correspondente (aceito, sem inventar vínculo). Nenhum dado "3B Teste" sobrevive, passando ou falhando.
- **Segurança dos webhooks implementada:** `lib/inboundSeguranca.ts` — WAHA usa o HMAC-SHA512 nativo do provider (`X-Webhook-Hmac` sobre o corpo cru, chave em `WAHA_WEBHOOK_HMAC_KEY`); Evolution não documenta assinatura nativa, então a mitigação é um token no próprio caminho da URL (`/api/webhook/evolution/<token>`, `EVOLUTION_WEBHOOK_TOKEN`) — rota migrou de estática para dinâmica. As duas falham fechado: sem a variável de ambiente configurada, 100% dos webhooks são rejeitados (nunca um "modo inseguro" silencioso). `tests/inbound-seguranca.test.js` cobre aceitação, rejeição sem segredo, rejeição com assinatura/token errado, e confirma que corpo alterado em 1 byte já invalida o HMAC.
- **QA local adicional:** payload malformado devolve só `{ ok: false, erro: "payload inválido" }` — sem stack, sem segredo, sem eco do corpo recebido (verificado por teste, não só por leitura de código). Instância Evolution cadastrada em mais de uma conta não resolve para nenhuma (nunca "a primeira encontrada") — mesma regra já valia para 0 contas, agora coberta também para >1.
- **Configuração real dos providers levantada** (sem alterar nada, sem expor secrets): documentada em `docs/inbound-webhooks.md` — endpoint e corpo exatos para configurar o webhook no WAHA (`config.webhooks[].hmac.key`, evento `message`) e na Evolution (`webhook/set/{instancia}`, `webhookByEvents: false`, evento `MESSAGES_UPSERT`), com a ressalva de que `webhookByEvents` **precisa** ficar `false` para o token no caminho continuar funcionando.
- **Procedimento de validação com payload real documentado** (`docs/inbound-webhooks.md`, seção 3) — 8 passos por provider (configurar webhook → mandar mensagem real de teste → capturar payload → confirmar adapter/conta_id/telefone/message_id/gravação única). Explicitamente marcado como teste **inbound only**: nenhuma campanha ou mensagem automática é disparada durante a validação.
- **Build/testes:** todos os 5 arquivos `tests/*.test.js` passando (`envio`, `telefone`, `protecao-outbound`, `inbound`, `inbound-seguranca`); `npx tsc --noEmit` e `npm run build` limpos após a mudança de rota (foi preciso limpar o cache `.next` uma vez, por causa dos tipos gerados da rota estática antiga que a rota dinâmica substituiu).
- **Nenhum write em produção ainda:** migration 017 não aplicada; webhooks reais não cadastrados no WAHA nem na Evolution; branch `feat/fase-3b-inbound-multiprovedor` (commits `05514b8`, `11c2bac`) segue só local, sem merge/push; nenhum deploy.

---

## Entrega 06 — Fase 3B em produção

**Data:** 2026-08-13
**Escopo:** INSTITUCIONAL — Harvest AI
**Branch:** `main`, commits `11c2bac` (merge de `feat/fase-3b-inbound-multiprovedor`) e `e277e8e` (correção de middleware, ver abaixo).

### Execução em produção

1. **Migration aplicada** — `./scripts/sql.sh -f sql/017_inbound_eventos.sql`. Exit 0.
2. **Verificador transacional rodado em produção** — `verificar_017_inbound_eventos.sql`, todas as asserções passaram (idempotência, isolamento entre contas, `message_id` repetido entre contas não conflita, telefone sem lead aceito). Confirmado por consulta independente: zero linhas "3B Teste" remanescentes. Schema revalidado read-only: RLS ativa, `UNIQUE (conta_id, provider, message_id_externo)`, FKs corretas.
3. **Secrets gerados e definidos na stack** — `WAHA_WEBHOOK_HMAC_KEY` e `EVOLUTION_WEBHOOK_TOKEN` (64 hex cada, `openssl`/`crypto.randomBytes`), aplicados via `docker service update --env-add` direto na stack de produção. Valores nunca impressos neste relatório nem no chat.
4. **Merge e push** — `feat/fase-3b-inbound-multiprovedor` (`05514b8`, `11c2bac`) mesclada em `main` (fast-forward) e enviada.
5. **Deploy** — imagem `11c2bac` publicada e aplicada via `docker service update --force`.

### Bug crítico encontrado e corrigido no QA de produção

O QA pós-deploy revelou que `middleware.ts` (matcher global de autenticação) interceptava `/api/webhook/waha` e `/api/webhook/evolution/[token]` **antes** de chegarem às rotas, redirecionando toda chamada sem cookie de sessão para `/entrar` (307) — e o WAHA/Evolution nunca têm cookie de sessão do Harvest. **Os dois webhooks estariam completamente inoperantes em produção sem esta correção.**

Correção: bypass explícito no início do `middleware` para `pathname.startsWith('/api/webhook/')`, já que a autenticação desses endpoints é própria (HMAC/token, `lib/inboundSeguranca.ts`), não por sessão. Commit `e277e8e`, testado localmente (`tsc --noEmit` + `npm run build`) e implantado imediatamente (nova imagem, novo `docker service update`). Confirmado depois: `/api/webhook/waha` e `/api/webhook/evolution/<token qualquer>` passaram a responder `401` (rejeição correta por assinatura/token) em vez de `307`.

### QA pós-deploy

- Logs limpos, sem erro/exceção.
- `/entrar` → 200.
- `/api/webhook/waha` sem HMAC → 401 (antes da correção: 307 — bug).
- `/api/webhook/evolution/<token inválido>` → 401 (idem).
- **Teste sintético assinado corretamente** (HMAC/token válidos, sessão/instância inexistentes de propósito): as duas rotas processaram normalmente até a resolução de conta e devolveram `{"ok":false,"erro":"conta_nao_resolvida"}` — confirma que segurança, parsing e adapter funcionam ponta a ponta em produção. **Nada foi gravado em `inbound_eventos`** (comportamento correto: conta não resolvida não persiste) — confirmado por consulta read-only depois do teste.

### Configuração real dos providers

**Contas em produção com credenciais de WhatsApp:**

| Conta | Provider | Instância/sessão configurada |
|---|---|---|
| Guinffer Pratas | `waha` | sim — sessão `WORKING`, número `5511951783049` |
| Teste | `evolution` | **não** — `evolution_instancia`/`evolution_url` nulos, conta nunca conectou a Evolution de verdade |

**WAHA — configurado.** `PUT /api/sessions/{sessão}` com `config.webhooks` apontando para `https://harvest.figueiramarketing.com.br/api/webhook/waha`, evento `message`, `hmac.key` = `WAHA_WEBHOOK_HMAC_KEY`. A sessão reiniciou (`STARTING` → `WORKING`, comportamento documentado do WAHA ao atualizar config de sessão existente) e voltou conectada, com o webhook confirmado em `config.webhooks` (1 item).

**Evolution — NÃO configurado.** A única conta com `whatsapp_provider = evolution` (“Teste”) não tem instância Evolution real conectada (`evolution_instancia` nulo). Não há como cadastrar um webhook real sem uma instância existente para apontar — **não fabriquei uma instância de teste na Evolution de produção para isso.** Fica como pendência explícita: quando alguma conta conectar a Evolution de verdade em Configurações → Conexões, cadastrar o webhook seguindo `docs/inbound-webhooks.md`.

### Teste inbound real

**WAHA — parcialmente validado.** O pipeline completo (segurança → adapter → resolução de conta → idempotência → gravação) foi confirmado funcionando em produção com um payload sintético assinado corretamente (ver QA acima). **Falta o teste com uma mensagem real** enviada de um número de verdade para `5511951783049` — isso depende de uma ação humana (mandar a mensagem pelo WhatsApp), que não está ao alcance deste agente. Procedimento pronto em `docs/inbound-webhooks.md`, passos 1–8.

**Evolution — bloqueado.** Sem instância real conectada, não há o que testar.

### Arquivos alterados nesta execução

- `app/src/middleware.ts` (correção do bug crítico acima, commit `e277e8e`)

### Pendências

1. **Enviar 1 mensagem real de teste para `5511951783049`** (WhatsApp, de outro número) e então conferir `select * from inbound_eventos where provider='waha' order by criado_em desc limit 1` — confirma o formato real do payload WAHA contra o que `lib/inboundWaha.ts` espera.
2. **Conectar uma conta real à Evolution** antes de qualquer configuração/teste de webhook Evolution ser possível.
3. Depois do item 1: se o payload real bater com o adapter, encerrar a ressalva "NÃO VERIFICADO" da Entrega 05. Se divergir, ajustar `lib/inboundWaha.ts` e reaplicar.

---

*Próxima seção ("Entrega 07 — ...") deve ser adicionada abaixo desta linha, sem apagar o conteúdo acima.*

---

## Entrega 07 — Fase 3B.1: UX operacional e WhatsApp multicanal

**Data:** 2026-08-13
**Escopo:** INSTITUCIONAL — Harvest AI (código local, `CODIGO/harvest-ai`)
**Branch local:** `main` (trabalho local, **não** enviado ao remoto — aguarda aprovação de produção)
**Status:** pacote local completo. **Nenhum write em produção, nenhum merge/push, nenhuma migration aplicada.**

### Contexto

Assumo a execução a partir do handoff do Claude Code (Fase 3B.1). O objetivo é a UX
operacional para a cliente (Guinffer Pratas) usar o Harvest: permissões server-side,
módulos por conta, WhatsApp multicanal, escolha do número no disparo (fixo/rodízio),
rastreabilidade por canal, melhorias de Campanhas, e Status/Saúde.

### Auditoria da migration 018 (feita antes de construir)

`sql/018_fase_3b1_ux_operacional.sql` (criada pelo Claude, local) foi auditada linha a
linha:
- **Referências válidas:** `contas`, `conta_credenciais.{whatsapp_provider,evolution_instancia}`,
  `historico_contato`, `prospecta_campanhas` — todas existem (migrations 002/015/008/007).
- **RLS:** usa os helpers já consagrados `minha_conta()`/`sou_super_admin()`; policy padrão
  `(conta_id = minha_conta()) OR sou_super_admin()`.
- **Backfill idempotente:** `whatsapp_canais` criado 1 por `conta_credenciais` existente, sem
  duplicar; `evolution_instancia` preservada.
- **Constraints/índices:** `UNIQUE(canal_id)` implícito (PK), `whatsapp_canais_conta_id_fkey`
  (CASCADE), índice `conta_id`.
- **Reversibilidade:** bloco de rollback comentado no fim do arquivo.
- **Sem conflito com `conta_credenciais`:** a tabela `whatsapp_canais` é a entidade operacional;
  `conta_credenciais.whatsapp_provider` vira só o default dos novos canais.

Conclusão: migration **aprovada para aplicação** (mas NÃO aplicada nesta fase).

### Implementado (código local)

1. **Permissões server-side (não só menu).** `lib/autorizacao.ts` com `modulosDaConta`,
   `temModulo`, `carregarModulos`. O `layout.tsx` carrega `modulos_habilitados` da conta e
   passa ao `Topo`; a nav de Usuários some quando o módulo não está habilitado. Endpoints
   restritos (canais, configurações, campanhas) checam `papel` direto no servidor — acesso
   direto de operador a `/api/canais` (POST/PATCH/DELETE) retorna **403**.
2. **Módulos por conta.** `contas.modulos_habilitados` (default `['whatsapp','ia','usuarios',
   'chamados','status']`). Admin da conta cliente enxerga só o habilitado; `enriquecimento`
   interno fica visível só para `super_admin` (a seção em Configurações é ocultada via
   `mostraEnriquecimento`). Sem hardcode de Guinffer — a conta recebe módulos por configuração.
3. **WhatsApp multicanal.** `lib/whatsappCanais.ts` (entidade Canal, seleção fixo/rodízio,
   regras de elegibilidade). Rotas `app/api/canais/route.ts` (GET lista, POST cria) e
   `app/api/canais/[id]/route.ts` (PATCH atualiza/torna padrão, DELETE). A UI em
   `Configuracoes.tsx` ganha a seção "WhatsApp — canais": tabela (nome, número, provider,
   status, padrão, ações) + formulário "Conectar número" (WAHA/Evolution). WAHA preserva a
   sessão/QR existente; Evolution só aparece conectado se houver instância real.
4. **Vários números por conta.** `whatsapp_canais` suporta N canais; a arquitetura já prevê
   canal por usuário/equipe/pipeline/campanha (campos prontos, sem implementar tudo agora).
5. **Disparo fixo / round robin.** `app/api/disparo/route.ts` resolvido por canal: recebe
   `canalId` + `modoEnvio` (`fixo`|`rodizio`), escolhe via `resolverCanalDisparo`, e grava
   `historico_contato.canal_id`. Rodízio é **determinístico** (semente = índice do lead,
   não random), ignora canal inativo/desconectado/outra-conta, sem fallback silencioso.
   `registrarTentativaContato` ganha `canalId`.
6. **Rastreabilidade por canal.** `prospecta_campanhas.modo_envio_numero` + `canal_ids`
   persistidos (PATCH aceita `modoEnvio`/`canalIds`). `CampanhaDetalhe.tsx` tem o seletor
   "Número de envio" (fixo num canal ou rodízio entre os ativos); `Campanhas.tsx` mostra
   coluna "Bloqueado" (opt-out/supressão por campanha).
7. **Campanhas.** Métricas derivadas de dados reais (enviadas/erros por `prospecta_mensagens`,
   bloqueados por `historico_contato`). Sem invenção de números. Volume por canal fica
   implícito no `canal_id` do histórico (a tela detalha ao clicar).
8. **Inteligência Artificial.** Seção preservada e visível para admin da conta. Providers
   existentes mantidos; BYOK do cliente já é o padrão (`ia_key` nunca retornada ao browser,
   `configuracoes/route.ts` só grava quando enviada, nunca loga).
9. **Status / Saúde.** `status/page.tsx` evoluído para: Banco, SMTP, Busca, WhatsApp
   (Evolution), IA, **WhatsApp — canais** (ativos/conectados), **Inbound/webhooks** (eventos
   recentes) e **Erros recentes** (sanitizados — nunca stack trace, segredo, token ou URL
   interna). `super_admin` não recebe nada além do sanitizado.

### Não implementado nesta fase (conforme escopo)

Chatwoot, bot/IA atendente, Twenty, pipeline Kanban completo, cadências, atribuição, billing.
Vine CRM não foi alterado.

### Arquivos criados/alterados

- `sql/018_fase_3b1_ux_operacional.sql` (pré-existente, auditado — migration)
- `tests/sql/verificar_018_fase_3b1_ux_operacional.sql` (novo — verificação SQL transacional
  `begin; …; rollback;`)
- `app/src/lib/autorizacao.ts` (novo — módulos por conta / permissões)
- `app/src/lib/whatsappCanais.ts` (novo — entidade Canal + seleção fixo/rodízio)
- `app/src/app/api/canais/route.ts` (novo — GET/POST canal)
- `app/src/app/api/canais/[id]/route.ts` (novo — PATCH/DELETE canal)
- `app/src/lib/historicoContato.ts` (editado — `canalId` em `registrarTentativaContato`)
- `app/src/app/api/disparo/route.ts` (editado — resolução multicanal + canal_id)
- `app/src/app/(app)/layout.tsx` (editado — carrega módulos, passa ao Topo)
- `app/src/componentes/Topo.tsx` (editado — nav por módulo)
- `app/src/app/(app)/configuracoes/page.tsx` (editado — busca canais + módulos)
- `app/src/componentes/Configuracoes.tsx` (editado — seção multicanal + gate enriquecimento)
- `app/src/app/(app)/campanhas/page.tsx` (editado — opt-out + canais)
- `app/src/componentes/Campanhas.tsx` (editado — coluna Bloqueado + canais prop)
- `app/src/app/(app)/campanhas/[id]/page.tsx` (editado — canais)
- `app/src/componentes/CampanhaDetalhe.tsx` (editado — seletor "Número de envio")
- `app/src/app/api/campanhas/route.ts` (editado — persiste modo_envio_numero/canal_ids)
- `app/src/app/(app)/status/page.tsx` (editado — canais/inbound/erros sanitizados)
- `tests/unit/whatsappCanais.test.ts` (novo — 19 asserts, roda com `node --experimental-strip-types`)

### Testes e QA local

| Item | Como validado | Resultado |
|---|---|---|
| `npx tsc --noEmit` | compilação de todo o `app/src` | ✅ limpo |
| `npm run build` | Next.js 15.1.3, 37 rotas, incl. `/api/canais`, `/api/canais/[id]` | ✅ passou |
| Rodízio determinístico | `tests/unit/whatsappCanais.test.ts` (semente 0/1/2/3, wrap, igualdade, 3/3/3) | ✅ 19/19 |
| Rodízio ignora inativo/desconectado | teste unitário | ✅ |
| Fixo: id inexistente / inativo → null (sem fallback) | teste unitário | ✅ |
| Isolamento de tenant no resolver | teste unitário (só retorna do array recebido) | ✅ |
| Supressão continua bloqueando | leitura do fluxo em `disparo/route.ts` (barreira mantida, agora grava `canal_id`) | ✅ lógica íntegra |
| Verificação SQL 018 | `tests/sql/verificar_018_*.sql` (read-only local, não contra produção) | pronto p/ rodar |

**Limite:** testes de unidade cobrem a lógica pura (seleção de canal) e o schema SQL isolado.
Nenhuma chamada real ao Supabase de produção foi feita — não há credenciais/ambiente de teste
nesta sessão. A validação ponta a ponta (API de disparo com banco real, WAHA real) depende da
aplicação da migration 018.

### Pendências para produção (requerem aprovação explícita — NÃO executadas)

1. **Aplicar `sql/018_fase_3b1_ux_operacional.sql`** via `./scripts/sql.sh -f sql/018_…`.
2. **Rodar `tests/sql/verificar_018_…sql`** em produção (transacional, rollback limpa).
3. **Backfill de canais existentes:** a migration cria 1 canal por `conta_credenciais` (a conta
   Guinffer Pratas vira ter 1 canal WAHA com base na sessão já WORKING). Confirmar que o número
   `5511951783049` aparece no canal.
4. **Merge da `main` local + push** (commits desta entrega ainda estão só no working tree local).
5. **Deploy** (imagem + `docker service update` na VPS, mesmo processo da 3A/3B).
6. **QA pós-deploy:** disparo fixo num canal, rodízio entre 2 canais, e conferir
   `historico_contato.canal_id` preenchido.
7. **ROT-001:** confirmar se as credenciais expostas no VineCRM (ver Auditoria Vine CRM) já
   foram rotacionadas — ação crítica de segurança, independente desta fase.

### Pronto para entregar à cliente?

**Parcial — código local pronto e validado (tsc + build + testes unitários).** Falta a
autorização de produção (aplicar 018, merge/push, deploy) para a cliente efetivamente usar.
Nenhuma ação de produção foi tomada.

---


### Correção 3B.1.1 — QA operacional (LOCAL, 2026-08-13)

Correções de QA real da 3B.1, executadas **localmente** (sem produção, sem push,
sem deploy). A Fase 3C (opt-out/status de resposta) permanece intacta — NENHUMA
migration 019 aplicada, nenhum deploy da 3C.

**1. WhatsApp consolidado (1 seção).** Removidos os blocos sobrepostos "WhatsApp —
provedor padrão" e o "WhatsApp" legado (QR connect duplicado). Restou só "WhatsApp —
canais", que lista nome/número/provider/status/canal padrão/ações e permite conectar
novo número, configurar e excluir. Provider agora pertence ao CANAL (não há mais
"provider padrão" separado na UX do cliente).

**2. Canal padrão.** Renomeado visualmente para "Canal padrão"; explicação: "usado
quando uma campanha não seleciona um número específico". Botão "Definir como padrão".
A regra de 1-por-conta já existia (PATCH/POST em /api/canais desmarca os outros).

**3. WAHA reconciliado (bug de backfill).** Causa: o backfill (018) criou o canal com
status='desconhecido' e numero=null — não consultava a sessão WAHA. Agora
carregarCanais reconcilia cada canal WAHA com a sessão real (wahaSessionName ->
getStatus/getNumeroConectado): se WORKING, canal='conectado' + número real; senão
'desconectado'. Fonte de verdade = sessão WAHA derivada do conta_id. NÃO cria QR novo,
NÃO duplica sessão. Na Guinffer, o canal 2 (waha) passa a mostrar o número conectado e
status correto ao abrir Configurações.

**4. Permissões de admin cliente (server-side).** ADMIN CLIENTE não vê mais: chave
SerpAPI (note sanitizada no lugar), configuração interna de enriquecimento (note
"gerenciado pela equipe" no lugar dos campos Perplexity/Serper/Tavily/Snov/Anymail),
nem testes internos. SUPER_ADMIN continua vendo tudo. Gating aplicado no componente
(eSuperAdmin) e a fonte (chaves) continua só no servidor — nunca exposta ao cliente.

**5. Testar conexões filtrado.** ADMIN CLIENTE vê só "Testar busca" (agora reflete a
ponte real — ver #7), "Testar WhatsApp" e "Testar IA". SUPER_ADMIN vê também Serper,
Tavily, Snov, Apollo, Anymail, Perplexity.

**6. IA.** Mantida visível, BYOK preservado, sem expor secret, sem mudança no bot.

**7. Bug da busca — causa raiz e correção.** "Testar busca" validava só a CHAVE da
SerpAPI (serpapi.com/account), enquanto a busca REAL passa pela PONTE n8n
(N8N_WEBHOOK_BUSCA). Chave válida != ponte funcionando -> o teste passava mesmo com a
ponte quebrada ("Não consegui falar com a ponte de busca"). Correção: centralizada a
chamada à ponte em lib/ponteBusca.ts (chamarPonte), usada TANTO por "Testar busca"
(modo 'prova') QUANTO pela busca real (modo 'busca'). Divergência eliminada — o teste
agora reflete o caminho de verdade.

**8. Log operacional / Status.** lib/logOperacional.ts registra eventos sanitizados
em historico_contato (origem='log'): timestamp, componente, operação, código, mensagem
segura, conta_id, correlation id. NUNCA registra token/key/secret/.env. Status/Saúde
agora mostra "Logs operacionais" (Busca/WhatsApp/Inbound/IA/Banco), sanitizados; cliente
vê resumo, super_admin vê detalhe técnico adicional. A falha de busca da QA aparece lá.

**9. Campanhas.** Confirmado uso da arquitetura 018: seletor "Número de envio" (Canal
padrão / fixo / Round Robin com canais participantes), só canais ativos/da-conta/válidos.
Métricas reais: enviados, respondidos (3C), bloqueados, erros, volume por canal — sem
métricas inventadas.

**Arquivos (3B.1.1):**
- app/src/lib/waha.ts (export getStatus; getNumeroConectado)
- app/src/lib/whatsappCanais.ts (reconciliarStatusWaha; carregarCanais reconcilia)
- app/src/lib/ponteBusca.ts (novo — chamarPonte compartilhada)
- app/src/lib/logOperacional.ts (novo — log sanitizado)
- app/src/app/api/busca/route.ts (usa chamarPonte)
- app/src/app/api/testar/route.ts (Testar busca prova a ponte)
- app/src/componentes/Configuracoes.tsx (1 seção WhatsApp; canal padrão; gating cliente; testes)
- app/src/app/(app)/configuracoes/page.tsx (prop eSuperAdmin)
- app/src/app/(app)/status/page.tsx (logs operacionais)
- app/tsconfig.json (allowImportingTsExtensions p/ testes)
- tests/unit/logOperacional.test.ts (novo — sanitização)

**Testes/QA local:** npx tsc --noEmit OK · npm run build OK · unit canais (19) OK ·
optout (3C, 21) OK · sanitização (3B.1.1) OK.

**Pendências de produção:** 3B.1.1 reaproveita schema existente (sem nova migration).
Para Stephanie usar em produção falta o deploy da 3B.1 (018) + agora da 3B.1.1, mais QA
pós-deploy (Guinffer: número WAHA no canal, testes filtrados, busca real pela ponte).
3C segue LOCAL, sem 019/deploy.


## Entrega 08 — Fase 3C: Opt-out e status de resposta (LOCAL)

**Data:** 2026-08-13
**Escopo:** INSTITUCIONAL — Harvest AI (código local, `CODIGO/harvest-ai`)
**Status:** pacote local completo. **Nenhuma migration aplicada em produção, nenhum
deploy, nenhum push** — executado LOCALMENTE conforme pedido.

### Contexto

Fase 3C do roadmap comercial ("Opt-out e status de resposta", `PLANO_MESTRE_HARVEST.md`
linha 144). O gap real: a 3B já captura inbound em `inbound_eventos`, mas NADA
detectava "o lead respondeu" nem "o lead pediu opt-out". A 3C fecha esse loop.

### Auditoria prévia (reuso, não duplicação)

- `conta_supressao` (016/3A) já guarda opt-out (`motivo='opt_out'`) e bloqueia disparo
  via `lib/supressao.ts`. → opt-out reusa a supressão central, não cria tabela nova.
- `prospecta_leads` (001/007) já tem `respondeu_em` + `status='respondeu'`. → resposta
  só marca o que já existe.
- `historico_contato` (016) já grava contato; 3C passa a registrar entrada
  (`origem='resposta'`, `status='optout'`/`'recebido'`).
- O próprio pipeline 3B já tinha o comentário "só preparação para a Fase 3C".

### Implementado (código local)

1. **`sql/019_fase_3c_optout_resposta.sql`** — idempotente (safe re-run): índices
   `prospecta_leads_respondeu_idx`, `historico_contato_resposta_idx`,
   `inbound_eventos_optout_idx`; coluna de apoio `inbound_eventos.tipo_evento`
   (`'mensagem' | 'optout'`); bloco de rollback comentado.
2. **`lib/optoutResposta.ts`** — função PURA de classificação (`classificarMensagem`,
   `ehOptOut`). Opt-out = palavra-chave explícita PT-BR (pare/parar/stop/cancelar/
   cancele/remover/remova/retirar/não perturbe/não quero mais/não mande mais/sair/
   unsubscribe/descadastrar…). **"não" sozinho NÃO é opt-out** (objeção ≠ pedido de
   parada) — evita falso positivo. Case-insensitive, sem acento, tolera pontuação.
3. **`lib/inbound.ts`** (pipeline 3B) — após gravar `inbound_eventos`:
   - opt-out → `suprimirTelefone(opt_out)` + `historico_contato` (origem=resposta,
     status=optout, motivo). Supressão central passa a bloquear disparo automaticamente.
   - resposta comum → marca `prospecta_leads.respondeu_em`/`status='respondeu'`
     (sem sobrescrever a 1ª resposta via `.is('respondeu_em', null)`) + `historico_contato`
     (origem=resposta, status=recebido).
   - `inbound_eventos.tipo_evento` preenchido com a classificação (auditoria).
4. **Campanhas** — `campanhas/page.tsx` conta `respondeu` por campanha
   (`prospecta_leads.respondeu_em not null`); `Campanhas.tsx` ganha coluna "Respondeu"
   e texto de ajuda atualizado (opt-out automático explicado).

### Arquivos

- `sql/019_fase_3c_optout_resposta.sql` (novo — migration)
- `tests/sql/verificar_019_fase_3c_optout_resposta.sql` (novo — `BEGIN→ROLLBACK`)
- `app/src/lib/optoutResposta.ts` (novo — classificação pura)
- `app/src/lib/inbound.ts` (editado — reflixo opt-out/resposta no funil)
- `app/src/app/(app)/campanhas/page.tsx` (editado — conta respondeu)
- `app/src/componentes/Campanhas.tsx` (editado — coluna Respondeu + texto)
- `tests/unit/optoutResposta.test.ts` (novo — 21 asserts)

### Testes e QA local

| Item | Como | Resultado |
|---|---|---|
| `npx tsc --noEmit` | compila `app/src` | ✅ limpo |
| `npm run build` | Next 15.1.3 | ✅ passou |
| Classificação opt-out (explícito) | `tests/unit/optoutResposta.test.ts` | ✅ |
| NÃO opt-out (objeção/"não") | teste unitário | ✅ |
| Tolerância acento/ponto/espaço | teste unitário | ✅ |
| `tests/unit/whatsappCanais.test.ts` | regressão 3B.1 | ✅ 19/19 |
| Verificação SQL 019 | `tests/sql/verificar_019_*.sql` (read-only local) | pronto p/ rodar |

### Pendências para produção (NÃO executadas — fora do "local")

1. Aplicar `sql/019_*`; 2. rodar verificação SQL; 3. commit/merge/push; 4. deploy;
5. QA pós-deploy com mensagem real inbound da Guinffer (confirma `respondeu_em` +
   `conta_supressao` em opt-out). Até lá, permanece **local**.

### Observação de escopo

3C trata "status de resposta" como *detecção de que houve resposta* — o
enriquecimento do *conteúdo* da resposta (qualificar/responder) fica para a 3D
(Chatwoot/Twenty), conforme o roadmap. Não foi construído agente de resposta aqui.

---

## Entrega 09 — Handoff Gemini: reconciliação + busca nativa (sem n8n)

**Data:** 2026-08-13
**Escopo:** INSTITUCIONAL — Harvest AI
**Executor:** Orquestrador Estratégico Figueira (Claude, Cowork) — retomando após limite de
uso, com trabalho intermediário do Gemini CLI no mesmo workspace.

### Reconciliação (auditoria real, não por memória)

A sessão anterior havia parado com a Fase 3B.1 "pela metade". As Entregas 07 e 08 (escritas
pelo Gemini) descreviam esse trabalho como **local, não enviado, não deployado**. A
reconciliação desta entrega **auditou a realidade** (git + produção, não os textos) e encontrou
uma divergência: o trabalho avançou além do que as Entregas 07/08 registram, sem atualização
documental correspondente. Especificamente:

| Item | Entregas 07/08 diziam | Realidade confirmada nesta auditoria |
|---|---|---|
| Branch/commits 3B.1 | "não enviado ao remoto" | `main` em `cbcd092` (3B.1.1), **mesclado e enviado** — `git status` mostra "up to date with origin/main" |
| Migration 018 | "nenhuma aplicada em produção" | **Aplicada** — `whatsapp_canais`, `historico_contato.canal_id`, `contas.modulos_habilitados` **existem no banco de produção** (consulta direta via `scripts/sql.sh`, read-only) |
| Deploy | "nenhum" | Imagem `ghcr.io/tuco-gui/harvest-ai:latest` rodando na VPS há ~1h no momento da checagem; task anterior era `e277e8e...` (fix pré-3B.1) — condiz com deploy do 3B.1.1; `GET /api/canais` responde `307` (rota existe, protegida) |
| Migration 019 (3C) | "não aplicada" | **Confirmado correto** — `inbound_eventos.tipo_evento` não existe em produção. 3C genuinamente ainda é só local. |
| Working tree | — | Confirmado: `campanhas/page.tsx`, `Campanhas.tsx`, `lib/inbound.ts` modificados + `lib/optoutResposta.ts`, `sql/019_*`, `tests/sql/verificar_019_*`, `tests/unit/optoutResposta.test.ts` não commitados — exatamente o pacote da 3C, intacto. |

**Ação:** `PLANO_MESTRE_HARVEST.md` seção 4.1 corrigida (linhas 3B.1/3B.1.1 adicionadas como
CONCLUÍDA EM PRODUÇÃO, com a nota explícita da divergência encontrada). Entregas 07/08 **não
foram apagadas nem reescritas** (política de preservar histórico) — esta seção documenta a
correção por cima.

**Causa provável da divergência:** as Entregas 07/08 foram escritas na hora em que aquele
trabalho *ainda* era local; o merge/push/deploy aconteceram depois, sem uma atualização de
fechamento equivalente à Entrega 06 (que a 3B teve). Fica registrado como aprendizado de
processo: fechar a entrega documental só depois da ação real (merge/deploy), não antes.

### Busca nativa — remoção da ponte n8n

**Arquitetura anterior:** `Browser → /api/busca (Next.js) → N8N_WEBHOOK_BUSCA → n8n → SerpAPI`.
A ponte existia por causa do CORS do painel HTML antigo (que rodava direto no navegador);
o Harvest atual já tem backend próprio, então a ponte era um salto desnecessário — decisão
registrada como **ADR-008** no Plano Mestre.

**Arquitetura nova:** `Browser → /api/busca (Next.js) → SerpAPI` — direto, sem n8n.

**Implementado (branch local `feat/busca-nativa-sem-n8n`, commit `0e724c1`, NÃO mesclada/
enviada/deployada):**

- `app/src/lib/serpapi.ts` (novo) — substitui `lib/ponteBusca.ts` (removido). Chama
  `serpapi.com/search.json` direto; a `api_key` só entra na URL dentro desta função — quem
  chama nunca monta a URL com a chave. Diferencia erros: `CREDENCIAL_AUSENTE`,
  `CREDENCIAL_INVALIDA`, `CREDITOS_ESGOTADOS`, `TIMEOUT`, `ERRO_SERPAPI`, `FALHA_INTERNA`.
  Log sanitizado via `logOperacional.ts` (reaproveitado, igual à 3B.1.1).
- `app/src/app/api/busca/route.ts` (editado) — usa `chamarSerpApi` em vez de `chamarPonte`;
  removida a checagem de `N8N_WEBHOOK_BUSCA`.
- `app/src/app/api/testar/route.ts` (editado) — "Testar busca" usa a MESMA função da busca
  real (preserva a garantia da 3B.1.1 de não ter dois caminhos divergentes).
- `README.md` e `app/.env.example` — atualizados, removida a instrução de subir webhook n8n
  para a busca.

**Preservado:** engine `google_maps`, `hl=pt`, `gl=br`, paginação (`start`), coordenadas/raio
(`ll`, cálculo de distância), tratamento de erros por conta, isolamento multi-tenant (conta
sempre vem da sessão verificada, nunca do corpo da requisição — inalterado), logs sanitizados.

**Achado, não corrigido nesta entrega (fora do escopo pedido):** `logOperacional.ts` grava em
`historico_contato`, cuja coluna `conta_id` é `NOT NULL` (migration 016); quando `contaId` é
`null` (contexto de sistema/super_admin, previsto no próprio comentário do módulo), o insert
falha silenciosamente (try/catch engole o erro — "log nunca derruba o fluxo principal"). Logs
de sistema sem conta nunca são persistidos. Registrado como pendência técnica menor.

### Testes e QA local

| Item | Como | Resultado |
|---|---|---|
| `tests/unit/serpapi.test.ts` (novo, 11 asserts) | mock de `fetch`, sem rede/banco real | ✅ 11/11 |
| Regressão — todos os `tests/*.test.js` (5) | `node tests/*.test.js` | ✅ |
| Regressão — `tests/unit/*.test.ts` (whatsappCanais, optoutResposta, logOperacional) | `node --experimental-strip-types` | ✅ |
| `npx tsc --noEmit` | `app/` | ✅ limpo |
| `npm run build` | Next 15.1.3, 37 rotas incl. `/api/busca`, `/api/testar` | ✅ passou |

### n8n — auditoria read-only (não alterado)

- `docker service ls` na VPS confirma: `n8n_n8n_editor` (1/1), `n8n_n8n_webhook` (1/1),
  `n8n_n8n_worker` (1/1), `n8n_n8n_reset_user` (0/1), `n8n_ytworker` (0/1).
- **Só 1 worker replicado** — condiz com o relato de execuções presas em "Queued/Starting
  soon" por horas (gargalo de concorrência entre workflows de clientes diferentes).
- **Nenhuma alteração de infraestrutura foi feita** — nem reinício, nem workers, nem
  Redis/queue mode/concurrency, nem workflows de outros escopos (Ortega/Carolline/Taborda).
  Correção da fila n8n fica registrada como **tarefa separada**, fora deste escopo.

**Dependências do Harvest em n8n — classificação:**

| Função | Onde | Classificação |
|---|---|---|
| Busca (Google Maps) | `N8N_WEBHOOK_BUSCA` | Era **CORE** — **migrado** nesta entrega (local, não deployado) |
| Disparo WhatsApp | `/api/disparo` (WAHA/Evolution diretos) | Já não depende de n8n — confirmado no código, nenhuma mudança necessária |
| IA (geração de mensagem) | `lib/ia.ts` (chamadas diretas aos provedores) | Já não depende de n8n |
| Enriquecimento (decisor/LinkedIn/e-mail) | `lib/enriquecimento.ts` (chamadas diretas) | Já não depende de n8n |
| Inbound (webhooks WAHA/Evolution) | `/api/webhook/*` (Fase 3B) | Já não depende de n8n |
| Automações/produtos independentes (fora do core do Harvest) | workflow **Prospecta IA** (busca, CSV, geração de mensagem, disparo, waits, integrações via n8n) | **PRODUTO/IMPLEMENTAÇÃO INDEPENDENTE** — não é dependência do Harvest, não foi tocado, **permanece ativo e preservado**; ver correção de governança na Entrega 10 |

Conclusão: **busca era a única dependência CORE real de n8n no *caminho crítico do Harvest*** —
depois desta migração (quando deployada), o backend do Harvest deixa de precisar do n8n para sua
própria lógica core. Isso **não implica remoção, desativação ou depreciação do n8n** em nenhum
outro escopo: o Prospecta IA e demais automações/integrações via n8n continuam existindo,
ativos e fora do escopo desta migração. Ver correção de governança registrada na Entrega 10.

### Git — como a 3C foi preservada

Nenhum `reset`, `clean` destrutivo, ou stash foi usado. Estratégia: nova branch
`feat/busca-nativa-sem-n8n` criada a partir de `main` (`cbcd092`); `git add` **seletivo** só
dos arquivos da busca nativa (`serpapi.ts`, `api/busca/route.ts`, `api/testar/route.ts`,
`README.md`, `.env.example`, `tests/unit/serpapi.test.ts`, remoção de `ponteBusca.ts`); commit
`0e724c1`. Os arquivos da 3C (modificados e não rastreados) **nunca foram tocados** — continuam
exatamente como o Gemini deixou, tanto em `main` quanto na nova branch (mesma working tree).
Confirmado por `git status --short` antes e depois: mesmas 7 entradas da 3C, inalteradas.

### Produção

**Já em produção (confirmado nesta auditoria):** Fases 3A, 3B (parcial — WAHA sim, Evolution
não), 3B.1 e 3B.1.1 completas (migration 018 + deploy `cbcd092`/`:latest`).

**Só local:**
- Fase 3C completa (migration 019 + código) — não commitada, não deployada.
- Busca nativa sem n8n — branch `feat/busca-nativa-sem-n8n`, commit `0e724c1`, não mesclada/
  enviada/deployada.

**Ações que exigem autorização explícita (nenhuma executada nesta entrega):**
1. Merge de `feat/busca-nativa-sem-n8n` em `main` + push.
2. Deploy da imagem resultante na VPS.
3. Commit + aplicação de `sql/019_fase_3c_optout_resposta.sql` em produção (Fase 3C).
4. Deploy da Fase 3C.
5. Qualquer alteração na infraestrutura do n8n (fila, workers, Redis, Kong/Traefik).
6. Repontar a imagem de produção de `:latest` (tag flutuante) para uma tag fixa por SHA —
   observação de higiene: os deploys anteriores (3A, 3B) sempre usaram o SHA completo; o
   deploy do 3B.1/3B.1.1 usou `:latest`, o que funciona mas é menos reprodutível/rastreável.
   Recomendação para o próximo deploy: voltar ao padrão de tag fixa.

### Pronto para os próximos passos?

- **Deploy da busca nativa:** código pronto, testado, revisado — **pronto para autorização**,
  não deployado ainda.
- **Retomar 3C → 3D:** a Fase 3C está com o pacote local completo (código + migration +
  testes, conforme Entrega 08) e preservada intacta; **pronta para revisão e autorização de
  produção** assim que solicitado. 3D (Chatwoot) seguindo não iniciado, conforme roadmap.

---

## Entrega 10 — Correção de governança: n8n / Prospecta IA (documentação apenas)

**Data:** 2026-08-13
**Tipo:** correção de interpretação/documentação. **Nenhum código, branch, produção ou
infraestrutura n8n foi alterado nesta entrega.**

### Motivo da correção

A Entrega 09 (busca nativa) descreveu corretamente a implementação técnica, mas parte da sua
linguagem — em especial a frase de conclusão "*o Harvest deixa de ter qualquer caminho crítico
passando por n8n*" e a classificação do Prospecta IA como item "**PERIFÉRICO**... não
investigado a fundo" — podia ser lida, fora de contexto, como uma recomendação de que o n8n (ou
o workflow Prospecta IA) deveria ser removido, desativado ou tratado como código morto. **Essa
nunca foi a decisão tomada e esta entrega corrige o registro para eliminar essa ambiguidade.**

### Decisão de governança (registrada aqui e refletida no ADR-008 atualizado)

1. **Remover a dependência de n8n do *core* do Harvest ≠ remover o n8n do ecossistema
   Figueira.** A migração da Entrega 09 afeta exclusivamente a busca do Google Maps dentro do
   backend do Harvest (`/api/busca`, `/api/testar`).
2. **O workflow Prospecta IA está preservado.** Não foi apagado, desativado, desmontado, teve
   webhooks removidos, ou foi tratado como código morto. Nenhuma ação foi tomada sobre ele nesta
   entrega nem na Entrega 09 — apenas observado, de forma read-only, ao nível de serviços Docker
   (`docker service ls`), na auditoria da Entrega 09.
3. **Prospecta IA segue como implementação/produto independente**, podendo continuar oferecendo
   busca, importação CSV, geração de mensagens, disparo, waits e integrações via n8n,
   independentemente da evolução do Harvest.
4. **n8n permanece ativo na Figueira** para: (1) Prospecta IA / eventual oferta de entrada;
   (2) automações periféricas do Harvest; (3) integrações customizadas; (4) workflows
   específicos de clientes (Ortega, Carolline, Taborda e outros).
5. **Formulação de referência (substitui qualquer leitura de "n8n deve ser removido"):**
   > "n8n não deve ser dependência desnecessária do core do Harvest; permanece como plataforma
   > de automação, integração e execução de produtos/workflows independentes."
6. **Hipótese registrada — Prospecta IA como potencial oferta de entrada:** fica registrada
   como **hipótese de decisão comercial/arquitetura**, a ser avaliada no futuro, a possibilidade
   de o Prospecta IA (via n8n) se tornar uma **oferta de entrada/versão econômica** da Figueira,
   paralela ao Harvest, para clientes com necessidade mais simples. **Nenhum pricing, billing,
   ou plano comercial foi implementado ou detalhado nesta entrega** — é apenas uma hipótese
   registrada para decisão futura.

### Verificação: alguma alteração anterior adaptou o Prospecta IA ao Harvest atual?

Investigação limitada ao que já havia sido levantado na auditoria read-only da Entrega 09
(`docker service ls` mostrando os serviços `n8n_n8n_editor`, `n8n_n8n_webhook`,
`n8n_n8n_worker`, `n8n_n8n_reset_user`, `n8n_ytworker`, com suas contagens de réplica). **Não
foi feita, nem nesta entrega nem na anterior, inspeção interna dos nós/configuração do workflow
Prospecta IA** — apenas observação de nível de serviço Docker. **Não há evidência, no material
levantado até aqui, de que alguma alteração tenha sido feita especificamente para adaptar o
Prospecta IA ao Harvest atual.** Registrado honestamente como **não investigado a fundo**, e
não como "confirmado que nada foi alterado" — se essa verificação for necessária, é um item
separado de escopo, que exigiria abrir o editor n8n e inspecionar o workflow diretamente
(fora do escopo desta correção documental).

### Correções aplicadas nos documentos

- `PLANO_MESTRE_HARVEST.md`, seção 5: ADR-008 reescrito para deixar explícito que o Prospecta
  IA é preservado, que a remoção de n8n é escopo exclusivo do core do Harvest, e para registrar
  a hipótese de oferta de entrada.
- `RELATORIO_ENTREGAS.md`, Entrega 09: a linha da tabela de dependências referente ao Prospecta
  IA e a frase de conclusão foram reescritas para remover a ambiguidade — **sem apagar o texto
  original da Entrega 09 como um todo**, apenas a linha e a frase específicas que geravam a
  leitura incorreta (edição pontual permitida porque o texto continha uma imprecisão factual de
  enquadramento, não um fato histórico verificado que precisasse ser preservado inalterado; o
  restante da Entrega 09 — reconciliação, implementação técnica, testes, produção — permanece
  intacto).

### O que NÃO foi alterado nesta entrega (confirmado)

- Branch `feat/busca-nativa-sem-n8n` — intocada.
- Arquivos locais da Fase 3C — intocados.
- Produção (VPS, banco, deploy) — intocada.
- Infraestrutura n8n (serviços, workers, Redis, queue, concurrency, workflows) — intocada.
- Nenhum código foi alterado; apenas `PLANO_MESTRE_HARVEST.md` e `RELATORIO_ENTREGAS.md`.

### STATUS GOVERNANÇA N8N / PROSPECTA IA
- Plano Mestre atualizado
- Relatório atualizado
- Prospecta IA preservado
- nenhuma alteração n8n
- busca nativa preservada
- 3C preservada

---

## Entrega 11 — Prontidão operacional para entrega ao cliente (Guinffer Pratas)

**Data:** 2026-08-13/14. **Escopo:** diagnóstico + correção LOCAL. Nenhum deploy, migration ou
alteração de produção/n8n nesta entrega (autorização explícita ausente para essa parte).

### P0 — Inbound / opt-out

**FATO VERIFICADO:** produção tem 8 linhas reais em `inbound_eventos` (consulta direta ao
banco), incluindo um evento real com `mensagem = "Sair"` (id 13, conta
`4d4aa4f6-207b-442b-ba65-ac73fd9ab442`, `recebido_em = 2026-08-14 00:01:50 UTC`) — o teste do
cliente **chegou** ao backend. Em todas as 8 linhas, `lead_id` e `campanha_id` estão `null`.

**BUG CONFIRMADO #1 — causa raiz do "SAIR" não virar opt-out:** o `inbound.ts` **local** (Fase
3C, não deployado) já tem a lógica de opt-out completa (`classificarMensagem` +
`suprimirTelefone`); mas o `inbound.ts` **em produção** (commit `acbf563`) é a versão anterior à
3C, sem essa lógica — `git diff HEAD -- app/src/lib/inbound.ts` confirma exatamente essa
diferença. Ou seja: o pipeline capturou o "Sair", mas produção ainda não sabe classificar
opt-out porque a 3C nunca foi deployada. Isso já era esperado e está documentado — não é bug
novo, é a Fase 3C aguardando autorização de deploy.

**BUG CONFIRMADO #2 — mais grave, e este SIM é um bug real de código (corrigido localmente):**
o payload real do evento de opt-out mostra que o WhatsApp do contato usa **endereçamento LID**
(`_data.key.addressingMode: "lid"`) — nesse modo, `payload.from` vem como
`21342044815384@lid`, um identificador opaco, **não um telefone**. O adapter WAHA
(`lib/inboundWaha.ts`) fazia `from.split('@')[0]` sem checar isso, gravando o número do LID como
se fosse `telefone`. Resultado: nenhuma correlação com `prospecta_leads` funciona (todas as 8
linhas com `lead_id: null`), e — crucial — **mesmo depois da 3C ser deployada, a supressão seria
aplicada a um "telefone" que não existe, sem bloquear o número real em disparos futuros**. O
payload real também mostra a saída: `_data.key.remoteJidAlt = "5514997554659@s.whatsapp.net"` —
o telefone real. Confirmado que esse telefone bate com um lead real em produção
(`prospecta_leads.id=570`, `empresa="Guilherme"`, `campanha_id=18`, `disparo='sim'`) — ou seja,
é o mesmo destinatário do disparo real, exatamente como esperado.

**CORREÇÃO LOCAL aplicada (`app/src/lib/inboundWaha.ts`, `app/src/lib/telefone.ts`):**
1. O adapter agora detecta `addressingMode === 'lid'` (ou `from` terminando em `@lid`) e usa
   `_data.key.remoteJidAlt` (JID baseado em telefone real) em vez de `from`. Sem
   `remoteJidAlt` disponível, o evento é **descartado** (falha fechada) em vez de gravar um LID
   como telefone.
2. `normalizarTelefone` ganhou um limite superior de 13 dígitos (telefone BR com DDI cabe em
   12-13) — defesa em profundidade contra qualquer LID (14-15 dígitos) que escape por outro
   caminho no futuro.
3. Testes novos em `tests/inbound.test.js` (casos 11-13) usando o formato real do payload de
   produção (números trocados) — cobre: LID resolvido corretamente via `remoteJidAlt`; LID sem
   `remoteJidAlt` descartado; `normalizarTelefone` rejeitando dígitos de tamanho de LID.

**BUG CONFIRMADO #3 — por que a tela Saúde mostrava "sem eventos recentes" mesmo com 8 eventos
reais:** `status/page.tsx` selecionava a coluna `tipo` de `inbound_eventos` — coluna que **nunca
existiu** (confirmado via `information_schema.columns`; colunas reais: `tipo_mensagem`, e
`tipo_evento` só depois da migration 019 da 3C). PostgREST rejeita a query inteira por coluna
inexistente; `data` vem `null`; a UI silenciosamente mostra "sem eventos recentes". **CORREÇÃO
LOCAL:** troquei para `tipo_mensagem` (coluna real) e passei a logar o erro se a query falhar
(em vez de engolir silenciosamente).

**PENDENTE PRODUÇÃO (requer autorização):**
- Deploy da correção do adapter WAHA (bug #2) — sem isso, mesmo com a 3C deployada, opt-out via
  contatos LID continuaria não funcionando de verdade.
- Deploy da correção da tela Saúde (bug #3).
- Deploy da Fase 3C (migration 019 + `optoutResposta.ts` + `inbound.ts` atualizado) — sem isso,
  bug #1 (opt-out não processado em produção) continua.
- **Dado de produção:** os 8 eventos já gravados têm `telefone` = LID (lixo), não o telefone
  real — não há supressão retroativa a aplicar a partir deles hoje; quando a 3C + correção LID
  forem deployadas, o comportamento passa a ser correto **a partir dali**. Reprocessar os 8
  eventos antigos (para aplicar supressão retroativa ao telefone real) é uma decisão de dado de
  produção — registrada aqui como pendência, não executada.
- Regra "`não` isolado NÃO é opt-out" — já implementada e testada em `optoutResposta.ts`
  (Fase 3C local, teste `"não" sozinho` passa), nada a mudar.

**HIPÓTESE (não verificada):** o adapter Evolution (`lib/inboundEvolution.ts`) não foi
auditado quanto a um problema análogo ao LID do WAHA — Evolution normalmente usa JIDs
`@s.whatsapp.net` e não tem o mesmo mecanismo de "linked ID" do WAHA/Baileys NOWEB, então o
risco é considerado baixo, mas isso é uma hipótese, não uma verificação feita nesta entrega.

### P0 — Consistência campanha/leads (PRATA 925 ATIBAIA)

**FATO VERIFICADO:** em produção, a campanha `id=26` "PRATA 925 ATIBAIA" (criada
2026-08-13 23:57) tem `encontradas=2`, `com_whatsapp=2`; `campanha_leads` tem exatamente 2 linhas
para essa campanha (`lead_id` 598 e 599); e ambos os leads (598, 599) têm
`prospecta_leads.campanha_id=26` preenchido corretamente. **A campanha está, agora,
internamente consistente (2 = 2 = 2).** A busca que gerou essa campanha
(`prospecta_buscas.id=36`) também registra `total_resultados=2`. Uma busca anterior pelo mesmo
termo em 2026-08-10 (`id=33`) também retornou só 2 resultados. **Em nenhum lugar do banco há
registro de uma busca por "PRATA 925 ATIBAIA" retornando 20 resultados.**

**HIPÓTESE (não confirmada — requer reproduzir com o cliente):** o "20" relatado não corresponde
a nenhum dado persistido para este termo específico; existem, sim, outras campanhas históricas
("joalheria em botucatu", id=9; "joias em botucatu", id=5) com `encontradas=20` de fato. A
hipótese mais provável é uma confusão de tela — ou o cliente viu um número transitório da tela
de busca (contagem bruta de resultados do Google Maps antes do filtro de WhatsApp/duplicidade,
que a SerpAPI comumente retorna em lotes de ~20) e não o número persistido da campanha depois de
salva, ou olhou a campanha errada na lista. **Não fabriquei um vínculo histórico para "explicar"
os 20** — sem evidência de onde esse número veio, fica registrado como não resolvido.

**RECOMENDAÇÃO para fechar isso com segurança amanhã:** pedir ao cliente para reproduzir ao
vivo (nome exato do termo buscado, print da tela no momento do "20"), e, junto, revisar o fluxo
de busca (`Prospeccao.tsx` / `/api/busca`) para diferenciar claramente "resultados brutos do
Google Maps" de "leads realmente salvos/filtrados" na UI — isso é o mesmo problema estrutural
que motiva a mudança de modelo "pesquisa ≠ campanha" pedida separadamente (ver abaixo).

### Mudança de modelo (pesquisa ≠ campanha), configuração de campanha, cadência, agendamento,
### disparo com estado durável, semântica de métricas, reestruturação da tela Saúde, QA de
### light/dark mode

**NÃO PRONTO — não implementado nesta entrega.** Cada um desses itens é, sozinho, uma mudança de
arquitetura ou de superfície de produto (schema, fluxo de UX em várias telas, e em alguns casos
— agendamento/disparo com estado durável — infraestrutura de execução server-side/queue que hoje
não existe no Harvest). Implementar de forma apressada, sem QA completo e sem revisar impacto em
dados históricos (campanhas antigas, `campanha_leads`, `historico_contato`, permissões,
supressão), é exatamente o tipo de "solução frágil de última hora" que o próprio pedido pede
para evitar. Ficam registrados como **roadmap priorizado**, na ordem sugerida:
1. Separar "pesquisa/lista" de "campanha" (schema já tem `campanha_leads` como tabela de
   associação — dá para reaproveitar; `prospecta_leads.campanha_id` direto precisa virar
   opcional/legado).
2. Configuração de campanha (mensagem fixa/rodízio/IA, canal, cadência) — a maior parte dos
   dados já existe em `conta_config_envio`/`whatsapp_canais`; falta granularidade por campanha.
3. Estado durável de disparo (não depender de estado de React/browser) — precisa de uma tabela
   de progresso por campanha e, para agendamento de verdade, um mecanismo server-side (cron/
   queue) que hoje não existe — **não inventar um scheduler no browser**, como o próprio pedido
   determina.
4. Semântica de métricas (leads vs. mensagens vs. respostas vs. opt-outs) — direto de fazer, mas
   depende de #2/#3 para fazer sentido de ponta a ponta.
5. Reestruturação da tela Saúde (Status→Saúde, canais reais, timeline única) — depende parcial
   das correções P0 já feitas (a query de inbound já está corrigida).
6. QA completo de light/dark mode em todas as telas.

### Regressão

| Verificação | Resultado |
|---|---|
| `tests/*.test.js` (5 arquivos, incl. `inbound.test.js` com os 3 casos novos) | ✅ todos ok |
| `tests/unit/*.test.ts` (4 arquivos) | ✅ todos ok |
| `npx tsc --noEmit` | ✅ limpo |
| `npm run build` | ✅ 37 rotas, sem erro |

### Git / 3C

Nenhum `reset --hard` nem `clean` destrutivo. Trabalho feito diretamente sobre `main` (mesmo
commit deployado, `acbf563`), com os 7 arquivos da Fase 3C intocados e as 3 correções novas
(`inboundWaha.ts`, `telefone.ts`, `status/page.tsx`) e o teste atualizado (`inbound.test.js`)
como modificações adicionais na mesma working tree. `git status --short` confirmado antes/depois
— nada commitado, nada perdido.

### STATUS PRONTIDÃO OPERACIONAL HARVEST

**P0**
- inbound WAHA: cadeia auditada ponta a ponta com evidência real de produção.
- causa do SAIR não processado: **3 causas reais identificadas** — (1) 3C não deployada
  (esperado); (2) bug de endereçamento LID no adapter WAHA (**corrigido localmente**); (3) bug
  de coluna inexistente na tela Saúde (**corrigido localmente**).
- 3C: preservada intacta, local, pronta para deploy quando autorizado.
- vínculo campanha/leads: campanha citada está consistente HOJE no banco; origem do "20"
  relatado não confirmada (hipótese registrada, não fabricada).
- pesquisa ≠ campanha: não implementado — roadmap.
- estado do disparo: não implementado — roadmap.
- métricas: não implementado — roadmap.

**Campanhas:** criação explícita, mensagem/rodízio/IA, cadência, canal, agendamento — nada
implementado nesta entrega (roadmap acima).

**Saúde:** query de inbound corrigida; reestruturação visual completa (resumo por componente,
timeline única, canais reais detalhados) não implementada.

**UI:** QA de light/dark mode não realizado nesta entrega.

**QA:** testes unitários ✅, `tsc` ✅, `build` ✅, regressão completa ✅.

**Git:** tudo em `main` local, 3C preservada, 3 arquivos de correção + 1 teste atualizados, nada
commitado/enviado.

**Produção:** ainda exige autorização para: deploy da correção LID+Saúde; deploy da Fase 3C;
qualquer decisão sobre reprocessar os 8 eventos inbound já gravados com telefone incorreto.

**Classificação para entrega amanhã: PRONTO COM RESSALVAS.**

Bloqueadores reais para uma demonstração honesta amanhã:
1. As correções P0 de hoje (LID + tela Saúde) e a Fase 3C precisam ser **deployadas** para o
   opt-out funcionar de ponta a ponta em produção — isso requer autorização e uma janela de
   deploy antes da demo.
2. O modelo pesquisa≠campanha, configuração de campanha, cadência, agendamento, estado durável
   de disparo, métricas e reestruturação de Saúde **não estarão prontos amanhã** — a
   recomendação é demonstrar o Harvest no estado atual (busca, campanhas simples, disparo,
   inbound/opt-out uma vez deployado) e apresentar os itens acima como roadmap próximo, em vez
   de prometer uma versão que ainda não existe.
3. Sem reproduzir o "20 encontradas" com o cliente, não dá para garantir que o mesmo susto não
   se repita ao vivo — vale alinhar expectativa antes da demo.

---

## Entrega 12 — Continuação: implementação local do que ficou pendente (Guinffer Pratas)

Continuação direta da Entrega 11. A orientação explícita nesta rodada foi **implementar
localmente o máximo possível** do escopo antes classificado como roadmap, em vez de reescopar
tudo de novo — só documentar como pendência o que exigisse decisão arquitetural real ainda não
tomada (ex.: executor server-side de agendamento). Todo o trabalho abaixo está em commits locais
na branch `fase-prontidao-operacional` (criada a partir de `main`, sem push), preservando os 7
arquivos da Fase 3C e a migration 019.

### 1. Fechamento do P0 de ontem

FATO VERIFICADO — as correções LID (`inboundWaha.ts`) e telefone (`telefone.ts`) da Entrega 11
seguem intactas; `tests/inbound.test.js` continua com os 3 casos novos passando. Os 8 eventos
inbound antigos gravados com telefone incorreto (era LID) **não foram reprocessados** — decisão
de reprocessar ou não é de produção e continua pendente de autorização explícita.

### 2. Status por item (formato exigido)

| # | Item | Status | Observação |
|---|---|---|---|
| 1 | Pesquisa ≠ campanha (lista vs. campanha) | **IMPLEMENTADO** | `prospecta_campanhas.tipo` (sql/020); busca/importar/manual só salvam leads; "Salvar lista"/"Criar campanha" explícitos em Prospeccao.tsx via `POST /api/campanhas` com `leadIds`. |
| 2 | Configuração de campanha — nome/leads/número | **IMPLEMENTADO** | Já existia (modo_envio_numero/canal_ids); reaproveitado sem mudança. |
| 3 | Configuração de campanha — estratégia de mensagem (fixa/rodízio 2-5/IA) | **IMPLEMENTADO** | Painel em CampanhaDetalhe.tsx; `mensagem_modo/mensagens/contexto_ia` na campanha; `disparo/route.ts` usa o override da campanha quando definido, senão cai na config da conta. |
| 4 | Cadência (rápida/moderada/conservadora/personalizada) | **IMPLEMENTADO** | `cadencia_modo/min/max` na campanha; loop de disparo em CampanhaDetalhe.tsx usa a faixa efetiva (preset ou personalizada) em vez do intervalo fixo da conta. |
| 5 | Agendamento (agora/agendar, timezone, status) | **PARCIAL** | Campo `agendado_para/timezone` e `status` (rascunho/agendada/em_execucao/...) salvos e editáveis; a campanha fica marcada "agendada". **Falta o executor real** (cron/fila) que dispara sozinho no horário — isso é infraestrutura de execução em background que o Harvest não tem hoje e não deveria ser implementada às pressas sem revisão de arquitetura (idempotência, retomada após falha, concorrência entre contas). Hoje, "agendar" é controle/organização; o disparo em si continua manual. Documentado na própria UI, para o operador não ser pego de surpresa. |
| 6 | Disparo — UX sem lista sumir | **JÁ ESTAVA OK** | CampanhaDetalhe.tsx nunca limpava a lista após disparo (achado da auditoria anterior); confirmado de novo nesta rodada. |
| 7 | Disparo — estado durável (sobrevive a refresh) | **PARCIAL** | As métricas agregadas (enviadas, contatados, erros, etc.) agora vêm do servidor (`historico_contato`) e sobrevivem a refresh. O **progresso do disparo em andamento** (ex. "12 de 40, continue de onde parou") continua em estado de React — não persiste se a aba fechar no meio de um disparo. Persistir isso exigiria uma tabela de progresso por campanha e endpoint de retomada; não implementado nesta entrega. |
| 8 | Métricas — semântica correta | **IMPLEMENTADO** | "Mensagens enviadas" (total) separado de "Leads contatados" (distintos) em CampanhaDetalhe.tsx e na lista de Campanhas.tsx, calculado via `historico_contato` (não mais joins frágeis por `prospecta_leads.campanha_id`). |
| 9 | Saúde — renomear preservando rota | **IMPLEMENTADO** | Menu mostra "Saúde"; rota continua `/status`. |
| 10 | Saúde — timeline única (erros + logs) | **IMPLEMENTADO** | Seções separadas viram uma lista única ordenada por data; eventos citando "n8n" marcados como histórico/resolvido. |
| 11 | Saúde — status real por canal WhatsApp | **IMPLEMENTADO** | Tabela nova com canal/provider/status/ativo direto de `whatsapp_canais`. |
| 12 | Saúde — detalhe por papel (ADMIN vs SUPER_ADMIN) | **JÁ ESTAVA OK** | Mascaramento de texto para não-super-admin já existia nos logs; preservado na timeline unificada. |
| 13 | Light/dark — contraste (select/textarea/option, disabled) | **PARCIAL** | Regras globais adicionadas (`select`, `textarea`, `option` usam `var(--sunken)`/`var(--ink)`; `:disabled` visível em qualquer input/select/textarea/button). **Não foi feita uma varredura visual campo a campo** em todas as telas listadas no pedido original (Chamados, Usuários, modais) — a correção é estrutural (nível de CSS global, então cobre essas telas por herança), mas não houve QA visual tela a tela com screenshot, por não haver navegador disponível nesta sessão para inspecionar renderizado. |
| 14 | Largura de layout (Saúde/Campanhas) | **IMPLEMENTADO** | `.pagina-larga` (1180px em vez de 820px) aplicada em Saúde, Campanhas e detalhe de campanha. |
| 15 | Nota de roadmap — navegação/sidebar | **IMPLEMENTADO** | Registrado abaixo, no Plano Mestre. |
| 16 | Consistência campanha/leads (robustez pós-PRATA-925) | **IMPLEMENTADO** | `campanhas/[id]/page.tsx` agora une leads via FK antiga **e** via `campanha_leads` (N:N), deduplicando — deixa de depender só da FK de "1ª campanha" que causa subcontagem quando o lead é reaproveitado. |

### QA obrigatório

| Verificação | Resultado |
|---|---|
| `tests/*.test.js` (5 arquivos) | ✅ todos ok |
| `tests/unit/*.test.ts` (4 arquivos) | ✅ todos ok |
| `npx tsc --noEmit` (após cada bloco de mudança) | ✅ limpo |
| `npm run build` | ✅ 37 rotas, sem erro |
| Migration 020 — dry-run transacional (`begin; <020> + <verificador>; rollback;` via `scripts/sql.sh`) | ✅ passou, nada persistido (banco único self-hosted não tem instância local separada — dry-run transacional é o equivalente seguro de "testar localmente" aqui) |

### Git

Branch local `fase-prontidao-operacional` (a partir de `main`, sem push), 3 commits:
1. `fix(inbound): trata LID do WAHA e limita normalizarTelefone`
2. `feat(3c): pipeline de opt-out/resposta no inbound (local, nao deployado)`
3. `feat(campanhas): pesquisa != campanha, config de campanha, metricas duraveis, saude unificada`

`main` continua exatamente no commit `acbf563` (o mesmo em produção). Nenhum `reset --hard`,
`clean` destrutivo ou push. Migration 019 e os 7 arquivos da Fase 3C preservados intactos.

### Produção

Nada aplicado. Continuam pendentes de autorização explícita: deploy desta branch, aplicação das
migrations 019 e 020, e qualquer decisão sobre os 8 eventos inbound antigos com telefone LID.

### STATUS IMPLEMENTAÇÃO PRONTIDÃO HARVEST

**Implementado localmente (11 de 16 itens):** modelo pesquisa≠campanha, config de mensagem por
campanha, cadência, métricas corretas, Saúde renomeada, timeline unificada, status real por
canal, detalhe por papel, largura de layout, nota de roadmap de navegação, robustez
campanha/leads.

**Parcial (3 de 16):** agendamento (salva/mostra, mas sem executor automático — decisão de
arquitetura, não implementação apressada), estado durável de disparo (métricas sim, progresso
em andamento não), QA visual de contraste (correção estrutural feita, varredura tela a tela não).

**Já estava OK (2 de 16):** disparo não limpa a lista; detalhe por papel nos logs.

**Bloqueadores reais para amanhã** (isto é: coisas que genuinamente não podem virar "pronto" sem
mais trabalho ou mais decisão):
1. Nada disto está em produção — depende de autorização de deploy (LID/Saúde P0, Fase 3C,
   migrations 019 e 020, e esta branch).
2. Agendamento automático (executor server-side) não existe — se o cliente perguntar "o disparo
   agendado dispara sozinho?", a resposta honesta hoje é não.
3. Progresso de disparo em andamento não sobrevive a fechar a aba no meio do envio.

**Classificação: PRONTO COM RESSALVAS** — para uma demo, o Harvest tem hoje localmente: modelo
pesquisa≠campanha funcional, configuração de campanha completa (mensagem/cadência/canal),
métricas corretas, Saúde reestruturada. As ressalvas (agendamento sem executor, progresso de
disparo não durável, produção ainda não atualizada) devem ser ditas ao cliente com a mesma
transparência da Entrega 11 — não são bloqueadores de "não funciona", são limites reais e
conhecidos do que foi construído.

---

## Entrega 13 — Autorização de produção, deploy e QA real (Fase 3C + prontidão operacional)

**Data:** 2026-08-14
**Escopo:** INSTITUCIONAL — Harvest AI. QA operacional: CLIENTE — Guinffer Pratas.
**Branch:** `fase-prontidao-operacional` mesclada em `main` (`ec5268b`), mais correção pontual
de QA (`321e5fc`).
**Autorização:** explícita do responsável (Guilherme), cobrindo migrations em produção, writes
técnicos, commit/merge/push, CI, deploy, QA pós-deploy, testes reais controlados e correções
de regressão encontradas no próprio QA.

### Deploy

- **Migrations aplicadas em produção:** `019_fase_3c_optout_resposta.sql` e
  `020_fase_pronta_operacional.sql`. 016/017/018 confirmadas já aplicadas antes — não
  reaplicadas.
- **BUG CONFIRMADO na 019, corrigido antes de aplicar de verdade:** o arquivo criava um índice
  parcial `where tipo_evento = 'optout'` antes de criar a própria coluna `tipo_evento` — a
  primeira tentativa de aplicação falhou com `column "tipo_evento" does not exist`. Confirmado
  que `scripts/sql.sh` roda o arquivo inteiro como uma transação implícita: a falha não deixou
  resíduo (índices/coluna não existiam depois, checado por consulta direta). Corrigida a ordem
  (coluna antes dos índices), criado `tests/sql/dryrun_019_combinado.sql` (a migration real +
  verificação, dentro de `begin/rollback`) para testar de verdade antes de reaplicar. Reaplicada
  com sucesso; verificador transacional (`verificar_019_...sql`) passou.
- **Merge:** `fase-prontidao-operacional` → `main`, commit `ec5268b` (25 arquivos, 1345
  inserções). Push `origin/main`.
- **CI:** workflow "Publicar imagem" verde (`31762401353`, ~1m18s).
- **Swarm:** `harvest_harvest` atualizado para a imagem do commit `ec5268b`, convergência 1/1
  confirmada, sem loop de restart, logs sem exceção crítica.

### QA de produção — achado e corrigido durante o próprio QA

- **BUG CONFIRMADO no card "WhatsApp (Evolution)" da tela Saúde:** checava só se
  `conta_credenciais.evolution_url/evolution_key` existiam — campos legados que continuavam
  preenchidos na conta Guinffer mesmo sem nenhum canal Evolution realmente conectado hoje
  (confirmado: zero linhas `provider='evolution'` em `whatsapp_canais` para essa conta; o único
  canal real é WAHA). O card mostrava "OK — configurado" de forma enganosa — exatamente o
  falso-positivo que a autorização pediu para evitar ("não mostrar Evolution saudável apenas por
  possuir configuração antiga"). **Corrigido, testado (`tsc`, 5 testes, build) e redeployado**
  dentro desta mesma autorização: commit `321e5fc`, imagem publicada, CI verde, Swarm atualizado
  e convergido. Confirmado ao vivo depois: o card passou a mostrar "Atenção — credenciais
  salvas, mas nenhum canal Evolution conectado agora".
- **Achado não-bloqueante, registrado para amanhã:** ao carregar `/chamados` por navegação
  direta de URL (hard reload), o tema salvo (`localStorage.harvest_tema`) às vezes não é
  restaurado antes da pintura (a página abre no tema padrão, escuro, em vez do tema salvo);
  navegando pelo link do menu (como um usuário real faz) o tema persiste corretamente. Não causa
  texto ilegível em nenhum dos dois temas — por isso não foi tratado como bloqueador de deploy,
  só registrado.

### QA real — resultado por item

| Item | Resultado |
|---|---|
| Busca não cria campanha automaticamente | ✅ confirmado em produção (busca real "joalheria em botucatu": 20 encontradas, botões "Salvar lista"/"Criar campanha" — nenhuma campanha automática) |
| Criação explícita de campanha | ✅ campanha real criada via `POST /api/campanhas` (mesmo endpoint da UI) |
| Contagem listagem = detalhe | ✅ 2 = 2 em ambas as telas |
| Enriquecimento | ✅ `POST /api/enriquecer` respondeu 200 sem erro (lead sem dado público disponível — resposta correta, não é falha) |
| Config de campanha (mensagem rodízio + textos + cadência personalizada) | ✅ salvo via `PATCH /api/campanhas`, confirmado no painel após reload |
| Agendamento não exposto como pronto | ✅ select travado em "agora", aviso explicativo visível, sem scheduler novo criado |
| Métricas semânticas | ✅ campanha real "TESTE-WAHA-3C real" (criada pelo Guilherme, 2 leads reais, 2 mensagens): Leads contatados 2, Mensagens enviadas 2, depois Responderam 1 e Opt-outs 1, todos corretos |
| Inbound real — mensagem normal | ✅ evento real recebido; telefone `5514988209683` correto (não LID); lead certo (id 613, "junior"); `respondeu_em` preenchido; histórico gravado; métrica "Responderam" refletiu na hora |
| Inbound real — SAIR | ✅ evento classificado `tipo_evento=optout`; telefone certo (`5514997554659`, lead "Guilherme", id 570); `conta_supressao` recebeu entrada (`motivo=opt_out`); histórico gravado (`status=optout`, motivo sanitizado); campanha mostrou "Opt-outs: 1" |
| Bloqueio pós opt-out | ✅ chamada real a `POST /api/disparo` para o mesmo número devolveu `403` (`"Este contato está suprimido (opt-out) e não pode receber disparo."`), nenhuma mensagem foi enviada, tentativa registrada como `bloqueado_supressao` |
| Auditoria eventos LID antigos | ✅ 8 eventos (ids 6–13) auditados: 6 têm sufixo `@lid` (telefone real só recuperável chamando a API do WAHA por contato — não é determinístico só com SQL); 2 têm sufixo `@newsletter` (mensagens de canal/newsletter, não são contato de opt-in/opt-out e devem ficar de fora de qualquer reprocessamento). Nenhum reprocessamento automático foi feito. |
| Saúde | ✅ WAHA aparece como canal real conectado da Guinffer; Evolution não aparece mais falsamente saudável; sem duplicidade de erro entre seções; textos sanitizados |
| Light/dark | ✅ sem texto ilegível em Prospecção, Campanhas (incl. painel de config), Configurações, Chamados, Saúde, em ambos os temas |

### Pendências reais para amanhã

1. **Reprocessamento dos 6 eventos `@lid` antigos** — requer chamar a API de contatos do WAHA
   por LID (chamada externa, não é só SQL) para recuperar o telefone real; precisa de
   idempotência (não duplicar histórico/supressão) antes de rodar. Não faz sentido incluir os 2
   eventos `@newsletter` nesse trabalho.
2. **Agendamento automático** (executor server-side) — segue não implementado, deliberadamente,
   e a UI segue não apresentando como pronto.
3. **Progresso de disparo durável após fechar a aba** — segue não implementado.
4. Achado do tema claro/escuro em `/chamados` por navegação direta de URL — cosmético, não
   ilegível, registrado acima.

---

## Entrega 14 — Fechamento final para entrega ao cliente (Stephanie/Guinffer Pratas)

**Data:** 2026-08-14
**Escopo:** INSTITUCIONAL — Harvest AI. QA operacional: CLIENTE — Guinffer Pratas.
**Branch:** `main`, commit `581cda9` (após `321e5fc` da Entrega 13).

### Pré-check

Produção confirmada rodando a imagem/commit mais recente aprovado antes de começar
(`321e5fcdf420...`, correspondente ao `main` local), 1/1 estável.

### Correção feita nesta rodada

**Bug cosmético do tema em `/chamados` (registrado como pendência na Entrega 13),
corrigido e redeployado:** o script inline pré-pintura que restaura o tema salvo não estava
efetivando `data-tema` a tempo especificamente nessa rota, ao ser acessada por navegação
direta de URL (hard reload) — a página abria no tema padrão (escuro) mesmo com
`harvest_tema='claro'` salvo. Não causava texto ilegível em nenhum tema; só não respeitava a
escolha do usuário nessa rota específica. Corrigido com uma rede de segurança no componente
`Topo` (presente em toda página autenticada): reaplica o tema salvo assim que monta, só se
`data-tema` ainda estiver vazio — nunca sobrescreve um tema já certo. Testado (`tsc`, 5 testes,
build), commit `581cda9`, CI verde, imagem
`581cda9eb664545f91f58a9cac2515167548cc82` publicada e aplicada no Swarm, convergência 1/1
confirmada. Testado ao vivo em produção duas vezes (hard reload de `/chamados`): `data-tema`
correto nas duas.

### QA com perfil admin cliente

Confirmado por código (não por login real na conta de Stephanie, para não usar as credenciais
dela sem ela presente) que o modelo de permissões já implementado nas Fases 3B.1 esconde
corretamente do papel Administrador (o dela): os menus **Contas**, **Equipe** e **Sistema**
(gerência institucional da Figueira) e a seção de enriquecimento interno em Configurações —
todos ficam atrás de `ehSuperAdmin`/checks de papel equivalentes em `Topo.tsx` e
`Configuracoes.tsx`. O usuário real da conta Guinffer é **Stephanie**
(guinffercomercial@gmail.com), papel Administrador.

### Guia da Stephanie

Criado `00_ADMIN/GUIA_RAPIDO_HARVEST_GUINFFER.md` — guia não-técnico cobrindo: entrar no
sistema, buscar leads, selecionar leads, criar campanha, escolher número/canal, configurar
mensagem (fixa/rodízio/IA), configurar cadência, iniciar disparo, acompanhar métricas, ver
respostas/opt-outs, Saúde, Chamados. Inclui avisos explícitos: opt-out é automático e
definitivo por número (não por campanha), agendamento automático ainda não existe (a UI não
finge que existe), progresso de disparo não sobrevive a fechar a aba, nunca compartilhar
credenciais internas da Figueira.

### Checklist final de entrega

**Operação**

| Item | Resultado |
|---|---|
| Login | ✅ PASSOU |
| Busca | ✅ PASSOU |
| Enriquecimento | ✅ PASSOU |
| Campanha (criar, configurar, contagem) | ✅ PASSOU |
| Disparo | ✅ PASSOU |
| Inbound (mensagem real) | ✅ PASSOU |
| Opt-out (SAIR real, supressão, bloqueio de novo disparo) | ✅ PASSOU |
| Saúde | ✅ PASSOU |

**Segurança**

| Item | Resultado |
|---|---|
| Isolamento entre contas (tenant isolation) | ✅ PASSOU — RLS por `conta_id`, testado desde Fase 3A/3B |
| Permissões por papel (admin cliente não vê gestão institucional) | ✅ PASSOU — confirmado no código nesta rodada |
| Secrets ocultos (chaves nunca aparecem em texto puro na UI/logs) | ✅ PASSOU |
| Supressão (opt-out bloqueia disparo antes de sair) | ✅ PASSOU — testado com número real |

**UX**

| Item | Resultado |
|---|---|
| Tema claro | ✅ PASSOU |
| Tema escuro | ✅ PASSOU |
| Mobile/responsivo básico | ⚠️ RESSALVA — não testado nesta rodada (fora do escopo desta autorização; layout é responsivo por CSS padrão, mas sem QA dedicado em viewport mobile) |
| Mensagens de erro claras | ✅ PASSOU (ex.: bloqueio de disparo por supressão devolve frase explicativa, não código técnico) |

### Ressalvas reais (não bloqueiam a entrega)

1. Agendamento automático (executor server-side) não existe — a UI não apresenta como pronto.
2. Progresso de disparo não sobrevive a fechar a aba no meio do envio.
3. QA de responsividade mobile não foi feito nesta rodada (viewport desktop apenas).
4. 6 dos 8 eventos inbound antigos com LID seguem com telefone não recuperado (não é
   determinístico só com SQL — precisa chamada à API do WAHA por contato); os outros 2 são
   eventos de canal/newsletter, fora do escopo de opt-out.

### Veredito

**PRONTO PARA ENTREGAR.**

---

## Entrega 15 — Política DEV → STAGING → PRODUÇÃO + refinamentos de produto (rodada iniciada 2026-08-14)

**Escopo pedido:** 27 seções (arquitetura de staging; Humanizer na copy; Dia/Noite;
contraste; UX de Campanhas/Leads; scheduler server-side; progresso durável; continuidade
de conversa). Escopo real de um único ciclo de trabalho é maior que o que cabe numa rodada —
abaixo está o que foi **efetivamente implementado e testado** vs. **desenhado mas não
implementado** (roadmap real, não maquiado).

### Auditoria de infraestrutura real (antes de qualquer mudança)

- Domínio institucional confirmado: **`figueiramarketing.com.br`** (não
  `figueiramarket.com.br` — o texto da autorização tinha esse typo; todo serviço do Swarm já
  usa o domínio correto: `harvest.`, `chatwoot.`, `waha.`, `evo.`, `supabase.`,
  `vinecrm.`, etc. Staging deve seguir a mesma convenção:
  **`harvest-staging.figueiramarketing.com.br`**).
- Confirmado via `docker service ls` na VPS: além do Harvest, rodam no mesmo Swarm
  Chatwoot (app/redis/sidekiq — plataforma de conversas já viva), Supabase self-hosted
  completo (auth/db/kong/realtime/storage/studio/etc — não é Supabase Cloud), WAHA
  (instância única compartilhada, não por tenant), Evolution, n8n (fora de escopo),
  Twenty CRM, Baserow, MinIO, Portainer, Traefik.
- Rede overlay usada pelo Traefik: `figueira_net` (única rede overlay custom; as demais
  são padrão do Docker).
- Roteamento do Harvest hoje: `Host('harvest.figueiramarketing.com.br')`, entrypoint
  `websecure`, TLS via `letsencryptresolver`, porta interna `3000`.
- CI/CD atual (`.github/workflows/imagem.yml`): builda no GitHub Actions (não na VPS —
  RAM insuficiente), publica `ghcr.io/tuco-gui/harvest-ai:latest` **e**
  `ghcr.io/tuco-gui/harvest-ai:<sha completo>` a cada push em `main`. Ou seja, **o artefato
  imutável por SHA já existe hoje** — falta só o segundo estágio (staging → aprovação →
  promoção do mesmo SHA para produção).
- Skill **Humanizer**: NÃO existe como skill institucional no Brain — o próprio
  `brain/03-skills/REGISTRY.md` documenta isso explicitamente ("humanizer — NÃO ENCONTRADO
  em nenhuma superfície [...] Recomendada criação futura"). Não inventei caminho. Usei a
  skill genérica `humanizer` disponível neste ambiente (baseada no guia "Signs of AI
  writing" da Wikipedia — mesmo objetivo: remover linguagem robótica sem alterar fatos),
  deixando registrado que **não é** a skill institucional da Figueira (que ainda não existe).

### Implementado e testado nesta rodada (commit `ca29266`, em `main`, NÃO deployado em produção)

Por instrução explícita da Seção 11 ("NÃO alterar produção durante a criação do staging"),
tudo abaixo foi commitado e o CI já publicou a imagem por SHA (`ghcr.io/tuco-gui/harvest-ai:ca29266...`),
mas **não foi promovido para o serviço Swarm de produção** — fica pronto para passar pelo
pipeline staging → QA → promoção assim que o staging existir.

1. **Guarda fail-closed de ambiente** (`lib/ambienteEnvio.ts`, aplicado em `/api/disparo`):
   quando `WHATSAPP_MODE=test`, qualquer disparo para telefone fora da whitelist de QA
   (`WHATSAPP_QA_WHITELIST`) é bloqueado com 403, mesmo que os secrets de staging
   apontem por engano para o WAHA/Evolution de produção. Roda antes de qualquer outra
   checagem, inclusive da barreira de supressão.
2. **Faixa de ambiente** (`FaixaAmbiente.tsx`) + **`robots: noindex, nofollow`**
   (`layout.tsx`): ativos só quando `NEXT_PUBLIC_AMBIENTE=staging` está definida no build.
   Sem essa env (caso de produção hoje), nada muda.
3. **Dia/Noite**: rótulo do alternador de tema trocou de "claro e escuro" para "Dia e
   Noite" (ícone lua/sol já dava o contexto visual — não precisou de mais texto).
4. **Contraste do modo Dia** (bug confirmado): `--ink-3` (texto secundário, labels,
   métricas, placeholders) estava em `#8A8A8A` sobre fundo `#F5F5F5`/`#FFFFFF` — abaixo de
   3:1, ilegível pelo padrão WCAG AA. Corrigido para `#6B6B6B` (~4,6:1). Bordas (`--rule`,
   `--rule-2`) também escurecidas um pouco para dar mais definição a cards/tabelas/inputs.
   Modo Noite não foi tocado (já estava OK). Não foi para preto puro — mantém hierarquia.
5. **Copy do agendamento**: texto longo "Agendamento automático ainda não está
   disponível — não existe hoje um executor..." trocado por "Em breve" simples e direto,
   sem prometer o que ainda não funciona.

QA local: `tsc --noEmit` limpo, os 5 arquivos de teste (`tests/*.test.js`) passando,
`npm run build` sem erro. Nenhuma migration de banco nesta rodada.

### Desenhado nesta rodada, NÃO implementado (roadmap real — não maquiado)

Estes itens exigem mudança estrutural maior do que cabe numa única rodada com segurança —
ficam como próximo passo explícito, não como "pronto":

- **Staging real (DNS, banco isolado, deploy)**: arquitetura desenhada (ver seção
  "Staging" do relatório final), mas nenhum recurso externo foi criado — aguardando
  aprovação explícita conforme Seção 11.
- **Scheduler server-side durável**: não implementado. Requer um executor
  (cron/worker/fila) rodando fora do navegador, com idempotência e persistência —
  arquitetura de alto nível esboçada no relatório final, implementação fica para a
  próxima rodada (idealmente já testada em staging antes de ir para produção, seguindo a
  própria política que esta rodada está instituindo).
- **Progresso durável de disparo**: mesmo caso — precisa de uma tabela/estado
  server-side de execução de campanha, não implementado ainda.
- **Editar campanha em página completa** (hoje só edita nome): não implementado.
- **Edição de lead** (nome/telefone/empresa/categoria) com proteção anti-bypass de
  opt-out: não implementado.
- **Ícones de ação na listagem de campanhas** (ver/editar/excluir) e **modal
  institucional padronizado**: não implementados.
- **Humanizer aplicado a toda a interface**: não foi uma varredura completa (login,
  onboarding, todas as telas, todos os tooltips/modais/erros) — só os textos tocados
  diretamente nesta rodada (agendamento, tema) foram revisados sob a ótica do Humanizer.
  Uma varredura completa da interface é um trabalho à parte, de tamanho comparável a esta
  rodada inteira.
- **Continuidade de conversa / Chatwoot**: só auditado (Chatwoot já roda em produção no
  mesmo Swarm — `chatwoot_chatwoot_app/_redis/_sidekiq`), nenhuma integração nova criada.

---

## Entrega 16 — Mudança de decisão: staging no Vercel, não na VPS (2026-08-14)

**Decisão vigente (substitui a proposta de staging local/VPS da Entrega 15):** a VPS de
produção está próxima do limite de recursos, então o staging do Harvest passa a rodar no
**Vercel** (Preview/Staging Deployments), não como novo serviço no Docker Swarm. Produção
continua exclusivamente na VPS. Fluxo:

```
DESENVOLVIMENTO → GITHUB → VERCEL STAGING/PREVIEW → QA → PRODUÇÃO NA VPS
```

Um único repositório, um único app — sem cópia paralela do Harvest.

### Auditoria de compatibilidade com Vercel

- `next.config.mjs` usa `output: 'standalone'` (pensado para a imagem Docker) — não atrapalha
  a Vercel, que ignora essa flag e usa seu próprio empacotamento serverless.
- Nenhuma rota usa `fs` (leitura/escrita em disco), WebSocket, SSE ou `setInterval` de longa
  duração — toda persistência já passa pelo Supabase. Isso é o que torna o Vercel viável sem
  reescrever nada.
- Nenhuma rota declara `export const runtime = 'edge'` — tudo roda no runtime Node.js padrão
  da Vercel, compatível com `nodemailer` e `@supabase/supabase-js` (que quebrariam no Edge).
- `middleware.ts` (sessão/redirect) já usa `@supabase/ssr`, padrão nativo de Edge Middleware —
  compatível de fábrica.
- Rotas com chamada de rede mais longa (`/api/disparo`, `/api/busca`, `/api/testar`,
  `/api/validar`, `/api/cep`) usam timeout de até 30s — dentro do limite de função da Vercel
  em qualquer plano pago; requer configurar `maxDuration` por rota se o plano usado tiver
  limite menor.
- WAHA, Evolution e Supabase self-hosted são todos expostos por domínio público HTTPS via
  Traefik (`waha.`, `evo.`, `supabase.figueiramarketing.com.br`) — **não são só acessíveis
  de dentro da VPS**. Ou seja, a Vercel consegue alcançá-los normalmente; não há dependência
  de rede privada bloqueando o staging.
- Scheduler/worker/background job: ainda não existe no Harvest (confirmado na Entrega 15) —
  não há nada rodando hoje que dependa de processo persistente incompatível com serverless.

**Classificação:** COMPATÍVEL COM VERCEL. Nenhum item caiu em "não deve rodar no staging
Vercel" nesta auditoria.

### Git

Modelo escolhido: **feature branch → Preview Deployment automático da Vercel → QA → merge em
`main` → CI Docker (`imagem.yml`, já existente) → promoção manual para a VPS**. Não criar uma
branch `staging` permanente — cada Preview já ganha URL própria por commit/PR, o que dá menor
drift entre staging e main do que manter uma branch de vida longa sincronizada à mão. Se mais
adiante for necessária uma URL fixa de homologação, dá para fixar um alias
(`harvest-staging.vercel.app` ou, futuramente, o domínio próprio) apontado para a branch
`main` ou para uma branch `staging` dedicada — decisão que fica em aberto até isso ser
realmente necessário.

Push em `main` continua dependendo só do fluxo já aprovado (`imagem.yml` builda e publica no
GHCR; produção na VPS só é atualizada com `docker service update` manual, nunca automático) —
push em feature branch **não** aciona esse workflow, então não há risco de publicar/promover
produção a partir de staging.

### Vercel

- Auditado: **não existe** projeto Vercel chamado `harvest` ou `harvest-staging` na conta
  hoje (`gui's projects`, `team_lSqnrTVAppcb9LJ12cTmCskR`) — sem conflito de nome.
- Nome sugerido do projeto: `harvest-staging`.
- URL inicial: `*.vercel.app` (não é preciso configurar domínio próprio agora — dá pra usar
  `harvest-staging.figueiramarketing.com.br` mais adiante, quando fizer sentido).
- **Criar o projeto na Vercel é ação externa — não foi criado nesta rodada.** Ver "Ações
  externas necessárias" abaixo.

### Banco

Staging não pode usar o banco de produção (Supabase self-hosted da VPS). Opções levantadas:
Supabase Cloud (free/paidtier) dedicado a QA, ou outro Postgres/Supabase separado da VPS.
Recomendação: Supabase Cloud free para começar (menor custo/complexidade, aplica as mesmas
migrations de `sql/`), com conta fictícia `Figueira QA`, usuários de QA e leads controlados —
nunca copiar a base real da Guinffer. **Criação do projeto de banco é ação externa —
não provisionada nesta rodada.**

### Segurança

- `lib/ambienteEnvio.ts` (guarda fail-closed) preservado — em `WHATSAPP_MODE=test`, todo
  disparo fora de `WHATSAPP_QA_WHITELIST` é bloqueado (403) mesmo com secret errado.
- `.env.example` documentado com as três variáveis de staging: `NEXT_PUBLIC_AMBIENTE`,
  `WHATSAPP_MODE`, `WHATSAPP_QA_WHITELIST` — todas vazias por padrão (produção nunca as
  define).
- SMTP, WAHA/Evolution operacionais do cliente, Chatwoot de produção: nenhum deve ser
  alcançado a partir do staging — Environment Variables do Preview na Vercel devem apontar
  para credenciais de teste/mock, nunca para as de produção. Isso é configuração a fazer no
  painel da Vercel no momento da criação do projeto (ação externa).
- Webhooks inbound: nunca apontar WAHA/Evolution de produção para uma URL de Preview (que
  muda a cada deploy) — enquanto não houver um WAHA de staging dedicado, inbound real fica
  fora do escopo do staging (segue sendo testado como já é hoje, sob autorização, direto
  em produção com número real).

### Pipeline

```
DESENVOLVIMENTO → TESTES LOCAIS (tsc/testes/build) → PUSH → VERCEL PREVIEW/STAGING → QA
→ APROVAÇÃO → MERGE MAIN → CI DOCKER (imagem.yml) → GHCR → SWARM PRODUÇÃO → SMOKE TEST
```

Importante: produção roda a imagem Docker (`ghcr.io/tuco-gui/harvest-ai:<sha>`); staging na
Vercel **não executa esse mesmo artefato Docker** — o que é garantido idêntico entre os dois
é o commit SHA, o código, as migrations e a configuração funcional equivalente, não o
binário/imagem. Isso está registrado aqui para não afirmar (incorretamente) que staging e
produção rodam "a mesma imagem".

### Ações externas necessárias (pendentes de autorização explícita)

1. Criar projeto Vercel `harvest-staging`, conectado ao repo `tuco-gui/harvest-ai`.
2. Escolher/criar banco de staging (recomendação: Supabase Cloud free) e rodar as
   migrations de `sql/` até a versão atual + seed fictício (`Figueira QA`).
3. Configurar Environment Variables do Preview/Staging na Vercel: `NEXT_PUBLIC_AMBIENTE=staging`,
   `WHATSAPP_MODE=test`, `WHATSAPP_QA_WHITELIST=<telefones de QA>`, credenciais do banco de
   staging, e decidir se WAHA/Evolution/SerpAPI/IA/SMTP de staging serão reais-controlados ou
   mock.
4. Decidir e, se necessário, configurar alias fixo de homologação (opcional, pode ficar para
   depois).

**Nenhuma mudança foi feita na VPS nesta rodada.** Produção continua intocada.

---

## Entrega 17 — Provisionamento do staging (autorizado por Guilherme, 2026-08-14)

Executado após autorização explícita ("autorizo a seguir") das ações externas listadas na
Entrega 16.

- **Vercel:** projeto `harvest-staging` criado (id `prj_Eqo8e4wKY5eie3GpDuk2nYe3E4cf`),
  conectado a `tuco-gui/harvest-ai`, root directory `app`, branch de produção do projeto
  Vercel = `main` (branch de produção *do projeto Vercel*, não confundir com produção real
  do Harvest, que continua só na VPS). Nenhum deploy disparado ainda — a Vercel builda
  automaticamente no próximo push.
- **Supabase de staging:** projeto `harvest-staging` criado na organização "SZ4 Growth
  Marketing" (`djiljdpruqktibnsmrbj`), região `sa-east-1`, custo confirmado $0/mês.
  URL: `https://mryznmsvmqmohuwqgfam.supabase.co`.
- **Migrations:** as 20 migrations de `sql/001_schema.sql` a `sql/020_fase_pronta_operacional.sql`
  foram aplicadas em ordem no banco de staging — schema idêntico ao de produção.
  `get_advisors` (linter de segurança) devolveu só avisos pré-existentes no próprio design
  (funções `SECURITY DEFINER` chamáveis por `anon`/`authenticated` via RPC — mesmo padrão já
  usado em produção, não é uma regressão introduzida aqui).
- **Seed:** conta `Figueira QA` criada (`id c509b1fb-ef30-4dbd-9aeb-d322f6d08557`, slug
  `figueira-qa`). Usuários de QA ainda precisam ser criados via Auth Admin API (não é possível
  via SQL puro — GoTrue exige o endpoint de admin para hash de senha correto); ver "próximo
  passo" abaixo.

### Env vars a configurar no Vercel (Project Settings → Environment Variables, ambiente Preview + Production do próprio projeto Vercel — ambos usados só como staging)

```
NEXT_PUBLIC_SUPABASE_URL=https://mryznmsvmqmohuwqgfam.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<REDACTED — sanitizado para versionamento público; pegar no painel Supabase do projeto harvest-staging → Settings → API → anon/public>
SUPABASE_SERVICE_KEY=<pegar no painel Supabase do projeto harvest-staging → Settings → API → service_role — nunca exposta por ferramenta automatizada, de propósito>
NEXT_PUBLIC_AMBIENTE=staging
WHATSAPP_MODE=test
WHATSAPP_QA_WHITELIST=<telefones de QA, só dígitos com DDI 55, separados por vírgula>
WAHA_API_URL=<deixar vazio ou apontar para um WAHA de teste — nunca o de produção>
WAHA_API_KEY=<idem>
WAHA_WEBHOOK_HMAC_KEY=<gerar um valor novo só para staging>
EVOLUTION_WEBHOOK_TOKEN=<gerar um valor novo só para staging>
```

### Próximo passo (manual, fora desta rodada)

1. No painel Vercel, colar as env vars acima (pegando `SUPABASE_SERVICE_KEY` no painel
   Supabase do projeto `harvest-staging`).
2. Criar o primeiro usuário de QA (papel `admin`, `conta_id = c509b1fb-ef30-4dbd-9aeb-d322f6d08557`)
   pelo painel Supabase Auth do projeto de staging (Authentication → Add user), ou pela própria
   tela de "Usuários" do Harvest depois do primeiro deploy — o gatilho `handle_new_user` (mesmo
   das migrations) já cria o perfil automaticamente.
3. Fazer um push em `main` (ou qualquer branch, para gerar um Preview) para disparar o
   primeiro build/deploy no Vercel e confirmar a faixa "AMBIENTE DE TESTE" aparecendo.

**Nenhuma mudança foi feita na VPS.** Produção continua intocada e exclusivamente lá.

---

## Entrega 18 — Correção emergencial de segurança: React2Shell (CVE-2025-66478) + boletim 11/dez (STAGING + PRODUÇÃO)

**Data:** 2026-08-14
**Escopo:** INSTITUCIONAL — Figueira Marketing / Harvest AI
**Gatilho:** Ao acionar o primeiro deploy do staging Vercel (Entrega 17), a Vercel bloqueou o
build automaticamente com `errorCode: VULNERABLE_NEXTJS_VERSION`, apontando para
`https://vercel.link/CVE-2025-66478`.

### FATO VERIFICADO — Vulnerabilidades identificadas

1. **CVE-2025-66478 ("React2Shell")** — RCE crítico em React Server Components,
   Next.js 15.0.0–16.0.6 (e canaries 14.3.0-canary.76+). Exploração pública ativa desde
   04/dez/2025 1PM PT (boletim oficial Vercel/Next.js).
2. **CVE-2025-55184 / CVE-2025-55183 / CVE-2025-67779** — boletim de 11/dez/2025
   (`https://nextjs.org/blog/security-update-2025-12-11`): a correção inicial de
   CVE-2025-55184 (DoS) estava **incompleta** (fix completo em CVE-2025-67779); mais
   CVE-2025-55183 (exposição de código-fonte). Nenhuma delas é RCE, mas ambas exigiam
   subir além da versão inicialmente recomendada.
3. Versão rodando em produção e staging antes da correção: **`next@15.1.3`** — vulnerável
   às duas.
4. Versão corrigida da linha 15.1.x (confirmada nos dois boletins oficiais): **`next@15.1.11`**.

### CORREÇÃO LOCAL / DEPLOY

1. `app/package.json`: `next` `15.1.3` → `15.1.9` (corrige só o RCE) → **`15.1.11`**
   (corrige RCE + boletim de 11/dez). `npm install` executado a cada bump.
2. `npm audit fix` (sem `--force`): corrigiu `nanoid <3.3.18` (High).
3. **Restam 3 vulnerabilidades** (cluster `next`/`postcss`/`sharp`) só resolvíveis via
   `npm audit fix --force` → `next@15.5.23` — fora do range atual (`15.1.x`), mudança de
   versão maior. **Não aplicado agora** — fica como decisão separada, precisa de janela de
   QA dedicada.
4. QA local: `npx tsc --noEmit` ok · `npm run build` ok (35 páginas) · 5 suítes de teste ok.
5. Commit `1b73e53` ("fix(seguranca): atualiza next para 15.1.11 — corrige CVE-2025-66478
   ... e CVE-2025-55184/CVE-2025-55183/CVE-2025-67779") → push `main`.
6. **Staging Vercel**: novo deploy (`dpl_9YRNQByrZayzwcCS5dCnFHANwTm9`) → `READY`, gate
   `VULNERABLE_NEXTJS_VERSION` limpo.
7. **Produção (VPS)**: autorização explícita do responsável ("sim") obtida antes de tocar
   produção. CI (`imagem.yml`, run `31810249089`) publicou
   `ghcr.io/tuco-gui/harvest-ai:1b73e53dba47a0abe57f19d53489f1227822009a`
   (digest `sha256:9e9b8f90a0993616c44a231e3f08291e8d7f5e5b36b16be297c750a1ba717ceb`,
   SHA obtido via `gh run view ... --log | grep`, nunca adivinhado).
   `docker service update --image ... --with-registry-auth harvest_harvest` no Swarm →
   `Service harvest_harvest converged`. Confirmado via
   `docker service inspect ... ContainerSpec.Image` e `curl` (307, resposta normal).

### PENDENTE PRODUÇÃO

- **Rotação de secrets de produção**: recomendação da Vercel para apps que ficaram online
  sem patch durante a janela de exploit público (04/dez em diante — este era o caso, já que
  a stack rodava `15.1.3` desde o início do projeto). **Não executado** — é uma decisão
  maior e separada, precisa de confirmação explícita do responsável antes de agir (rotação
  de credenciais tem risco operacional próprio).
- **Cluster next/postcss/sharp** (3 vulnerabilidades restantes, `npm audit`): resolvível
  apenas via salto para `next@15.5.23`. Recomendação: tratar como item de roadmap com QA
  dedicado, não como patch de emergência.

### STATUS
Staging e produção corrigidos e verificados. React2Shell e o boletim de 11/dez não afetam
mais nenhum dos dois ambientes.

---

## Entrega 19 — Upgrade next 15.1.11 → 15.5.23 (zera vulnerabilidade crítica remanescente do npm audit)

**Data:** 2026-08-14
**Escopo:** INSTITUCIONAL — Figueira Marketing / Harvest AI
**Decisão do responsável:** rotação de secrets de produção → **não** autorizada agora;
upgrade next 15.5.23 → **autorizado**.

### CORREÇÃO / DEPLOY (SÓ STAGING NESTA ENTREGA)

1. `app/package.json`: `next` `15.1.11` → `15.5.23`. `npm install` ok.
2. `npm audit` após o bump: a entrada crítica direta em `next` (faixa
   `9.3.4-canary.0 - 16.3.0-preview.10`) **sumiu**. Restam apenas 3 vulnerabilidades High
   (`postcss`, `sharp`), vendorizadas dentro do próprio `next` — só resolvíveis pulando para
   **`next@16.3.1`**, major version com breaking changes explícitos no próprio `npm audit
   fix --force`. **Não aplicado** — fica como item de roadmap separado, precisa de decisão e
   janela de QA dedicadas (major bump de framework).
3. QA local: `npx tsc --noEmit` ok · `npm run build` ok (35 páginas) · 5 suítes de teste ok.
4. Commit `c597d7c` → push `main`.
5. **Staging Vercel**: novo deploy (`dpl_8M5MMzK7TuWsh6Z6AzmLQs1oqTi1`) → `READY`.

### PENDENTE

- **Produção (VPS)**: intencionalmente **não tocada** nesta entrega. Por convenção do
  projeto ("primeiro staging → depois produção"), esse bump vai para produção só depois de
  QA no staging e autorização explícita separada — este não era um patch de emergência de
  RCE (que já foi resolvido na Entrega 18), é um hardening adicional.
- Rotação de secrets de produção: recusada pelo responsável nesta rodada. Não reabrir sem
  pedido explícito.
- Upgrade major para `next@16.3.1` (zeraria as 3 vulnerabilidades High restantes): não
  avaliado, não agendado. Recomendação: tratar como item de roadmap próprio, com escopo,
  QA e janela dedicados — breaking changes de major version não devem ser bundlados em
  patch de segurança.

### STATUS
Staging com `next@15.5.23`, `READY`, QA local completo. Aguardando QA funcional no staging
e autorização explícita para promover à produção.

---

## Entrega 20 — QA funcional do staging + promoção de next@15.5.23 para PRODUÇÃO

**Data:** 2026-08-14
**Escopo:** INSTITUCIONAL — Figueira Marketing / Harvest AI
**Autorização:** explícita do responsável, em duas etapas — QA funcional do staging primeiro,
depois autorização formal de promoção para produção citando o commit exato homologado.

### QA FUNCIONAL NO STAGING (antes da promoção)

Executado roteiro completo no staging (`harvest-staging.vercel.app`, commit `c597d7c`):
ambiente isolado, auth, tenant, prospecção (erro tratado — sem chave SerpAPI por desenho),
campanhas, fail-closed do WhatsApp (testado via API: telefone fora da whitelist → **403**,
`bloqueadoPorAmbiente: true`, sem chamada real ao provider), Saúde, Chamados, Dia/Noite,
APIs, middleware, `npm audit`, testes/tsc/build locais.

**Bug real encontrado e corrigido nessa rodada:** migrations `008_conversas`,
`009_enriquecimento` e `010_linkedin_provedor` nunca haviam sido aplicadas no provisionamento
original do staging (Entrega 16/17) — causava `500` em `/api/conversas` ("Could not find the
table 'public.conversas'"). Aplicadas via `apply_migration` no Supabase staging, idempotentes,
sem qualquer alteração em produção. Corrigido usuário QA autenticável criado
(`qa@figueiramarketing.com.br`, papel `admin`, conta `Figueira QA`) para permitir o QA.

**Veredito do QA:** `PRONTO PARA PROMOVER PARA PRODUÇÃO` — commit `c597d7c`.

### PROMOÇÃO PARA PRODUÇÃO

1. **Estado anterior registrado (ponto de rollback):** produção rodava
   `ghcr.io/tuco-gui/harvest-ai:1b73e53dba47a0abe57f19d53489f1227822009a` (o patch emergencial
   de CVE-2025-66478/CVE-2025-55184 da Entrega 18), serviço `harvest_harvest`, 1 réplica,
   `Running`.
2. **CI:** commit homologado `c597d7ca36a48bb171606a629835717ca5e775c7` já havia sido
   publicado automaticamente pelo workflow `Publicar imagem` no push que gerou o staging
   (run `31811457896`, sucesso). Digest confirmado via `gh run view ... --log | grep`, nunca
   adivinhado: `sha256:719e675906ba243991d9d8d731a7bc37070bec52b2fe0c69aa36a2c461975146`.
3. **Nenhuma migration aplicada em produção** — as três migrations desta rodada eram
   exclusivamente uma lacuna do banco de staging; o schema de produção já as tinha.
4. **Deploy:** `docker service update --image ghcr.io/tuco-gui/harvest-ai:c597d7c...
   --with-registry-auth harvest_harvest` → `Service harvest_harvest converged`. Task nova
   `1o8525stsrqy`, `Running`, sem restart loop, log confirma `▲ Next.js 15.5.23` e
   `✓ Ready in 353ms`.

### SMOKE TEST EM PRODUÇÃO

- Público: `/` e `/entrar` respondendo (307/200), `/campanhas` sem sessão redireciona (307).
- Autenticado (sessão real do responsável, só leitura): Saúde (banco OK, WhatsApp canal
  "Principal" conectado via WAHA, inbound OK com 5 eventos recentes, IA/Busca OK — nada
  quebrado pela promoção), Campanhas (dados reais de campanhas carregando normalmente,
  incluindo `PRATA 925 SOROCABA`, `PRATA 925 ATIBAIA` etc.), Configurações (canal WhatsApp
  conectado, chave SerpAPI mascarada corretamente, nenhum secret exposto no client),
  Prospecção e Dia/Noite carregando sem erro de console.
- **Achado real, não bloqueante:** ao abrir `/chamados` (lista, com o chamado real "Erro ao
  conectar IA" e badge "SLA vencido"), o console acusa
  `Minified React error #418` (mismatch de hidratação). A UI se recupera sozinha (React
  descarta o render do cliente e re-renderiza; a página funciona normalmente depois — testado
  em aba nova, chamado abre e responde normalmente). **Avaliação: não é regressão causada por
  esta promoção** — o padrão (badge "SLA vencido" calculado por comparação de horário no
  servidor vs. no cliente) é um bug de conteúdo/hidratação pré-existente que só aparece
  quando existe um chamado real com esse estado, o que não existe na base limpa do staging.
  Registrado como item de correção futura, não bloqueou a promoção.

### SEGURANÇA

`npm audit` (mesmo commit, já verificado no staging): 0 críticas, 3 High
(`postcss`/`sharp`, vendorizadas dentro do próprio `next@15.5.23`) — só resolvíveis com
`next@16.3.1` (major, fora do escopo). `npm audit fix --force` não executado.

### PRODUÇÃO
✅ **ESTÁVEL** — 1/1, sem restart loop, sem exceção de servidor, todas as telas testadas
funcionando com dados reais.

### PENDENTE (fora do escopo desta autorização)

- Corrigir o mismatch de hidratação em `/chamados` (badge "SLA vencido") — bug de UI
  pré-existente, não bloqueante, achado durante este smoke test.
- Next 16 (zeraria as 3 vulnerabilidades High restantes) — hardening futuro separado, não
  iniciado.
- Retomar roadmap represado: UX Campanhas/Leads, Humanizer, scheduler, progresso durável,
  continuidade Chatwoot.

---

## Entrega 21 — Correção do hydration error #418 em `/chamados` + retomada de produto

**Escopo:** INSTITUCIONAL — Figueira Marketing / Harvest AI. Correção pontual, isolada,
autorizada condicionalmente (staging passando) na mesma mensagem que retomou o roadmap de
produto.

### CAUSA RAIZ

Dois padrões causavam mismatch de conteúdo entre SSR e hidratação do cliente em
`Chamados.tsx` e `ChamadoDetalhe.tsx`:

1. `new Date(...).toLocaleString('pt-BR')` sem `timeZone` explícito — usa o fuso padrão do
   runtime que está formatando, que é diferente entre o container do servidor (tipicamente
   UTC) e o navegador do usuário (`America/Sao_Paulo`). Servidor e cliente geravam textos de
   data diferentes para o mesmo valor.
2. `Date.now()` chamado diretamente dentro do render de um Client Component
   (`slaVencido`/`vencido`) para decidir o selo "SLA vencido" — por definição não-determinístico
   entre o momento do SSR e o momento da hidratação no cliente.

### CORREÇÃO

Sem `suppressHydrationWarning` e sem mover a página para client-only — solução determinística:

- Novo `app/src/lib/data.ts`: `formatarDataHora(iso)` com `timeZone: 'America/Sao_Paulo'`
  explícito. Mesmo texto, qualquer fuso do processo que formatar.
- Server Components (`chamados/page.tsx`, `chamados/[id]/page.tsx`) calculam
  `agoraMs = Date.now()` **uma única vez** e passam como prop.
- Client Components (`Chamados.tsx`, `ChamadoDetalhe.tsx`) usam esse `agoraMs` recebido no
  primeiro render — garantindo que a hidratação bate exatamente com o HTML do SSR — e depois
  do mount atualizam sozinhos via `useEffect` + `setInterval` (30s), para abas abertas por
  muito tempo continuarem refletindo o SLA corretamente, sem nunca arriscar um novo mismatch
  (atualizações pós-mount são sempre seguras).

### TESTES

Novo `tests/hidratacao-chamados.test.js` (convenção do repo: reimplementação em JS puro,
`node tests/hidratacao-chamados.test.js`, mesmo padrão de `envio.test.js`/`telefone.test.js`):
`formatarDataHora` determinístico e independente do `TZ` do processo (testado alternando
`process.env.TZ` entre `UTC` e `America/Sao_Paulo`); `slaVencido` nos casos dentro do prazo,
vencido, chamado respondido/fechado com prazo no passado (nunca "vencido"), e limites de 1ms
antes/depois do prazo.

QA manual em staging cobrindo os 6 cenários pedidos: chamado dentro do SLA, chamado vencido,
chamado sem SLA relevante (fechado com prazo no passado), troca de tema Dia/Noite, hard reload,
navegação interna — todos sem erro de hidratação, badge correto, página funcional, resposta
funcionando.

### QA LOCAL (branch `fix/hidratacao-chamados-sla`)

`tsc --noEmit` ok · 6/6 suites de teste ok (5 pré-existentes + a nova) · `npm run build` ok
(35 páginas). Diff isolado: 6 arquivos (`lib/data.ts` novo, `Chamados.tsx`,
`ChamadoDetalhe.tsx`, os dois `page.tsx` de `/chamados`, e o novo teste).

### STAGING

Push da branch → Vercel build automático → `dpl_CJrxQDbDWDurLFLicnt7VVvxTRfv` READY
(`harvest-staging-git-fix-hidrataca-9f2e53-...vercel.app`). QA autenticado com a conta QA
(`qa@figueiramarketing.com.br`, senha rotacionada nesta rodada só para restaurar acesso de
QA — ação restrita ao banco de staging, sem qualquer relação com secrets de produção).
Inseridos 3 chamados fictícios via SQL (staging, conta `Figueira QA`): dentro do prazo,
vencido, e fechado com prazo no passado. Todos os 6 cenários testados limpos, console sem
`Minified React error #418` em nenhum momento, resposta a chamado funcionando e persistindo
corretamente.

### PRODUÇÃO

Staging passou limpo → autorização condicional da Entrega 20 já cobria este deploy → merge
`fix/hidratacao-chamados-sla` → `main` (commit `a61b48d31eed796626d3551314bc56519f0fafc5`) →
push → CI (`Publicar imagem`, run `31822827135`, sucesso) → digest confirmado via
`gh run view ... --log | grep`, nunca adivinhado:
`sha256:969c80a5258e51a39a6dab89b1d6cda535cea9230cfc87c76667dbffb6e8723f`. Ponto de rollback
registrado antes do deploy: produção rodava `c597d7ca36a48bb171606a629835717ca5e775c7`
(1/1, `Running`). Nenhuma migration — esta correção não toca banco. Deploy via
`docker service update --image ...@sha256:969c80... harvest_harvest` →
`Service harvest_harvest converged`, task nova `Running`, log limpo
(`▲ Next.js 15.5.23 ✓ Ready in 170ms`).

**Smoke test em produção:** aberto exatamente o chamado real que originou o achado na
Entrega 20 (`Erro ao conectar IA`, `/chamados/1`, badge "SLA vencido", conta Guinffer
Pratas) — hard reload, console limpo, sem `Minified React error #418`, badge correto,
página funcional.

**Escopo respeitado:** nenhuma alteração em Next 16, banco/schema de produção, n8n, Redis,
Chatwoot, Twenty, scheduler ou qualquer outra feature — deploy isolado só desta correção.

### VEREDITO
✅ **CORREÇÃO CONCLUÍDA E ESTÁVEL EM PRODUÇÃO** — commit `a61b48d31eed796626d3551314bc56519f0fafc5`.

### RETOMADA DE PRODUTO (após esta correção)

Nenhum dos 5 fronts represados foi iniciado nesta rodada (prioridade era fechar a correção
de hidratação primeiro, como instruído). Status honesto:

- Prioridade 1 — Campanhas/Leads (ícones ver/editar/excluir, edição de campanha, edição de
  lead, semântica opt-out/bloqueado/erro, modal institucional): **PENDENTE**.
- Prioridade 2 — Copy/Humanizer (varredura de textos da UI): **PENDENTE**.
- Prioridade 3 — Scheduler server-side durável: **PENDENTE**.
- Prioridade 4 — Progresso durável de disparo: **PENDENTE**.
- Prioridade 5 — Conversas/Chatwoot (auditoria da integração existente antes de implementar):
  **PENDENTE**.

Próximo passo: iniciar pela Prioridade 1 (Campanhas/Leads) em staging, salvo redirecionamento.

---

## Entrega 22 — Campanhas/Leads: CRUD operacional (STAGING)

**Branch:** `feature/campanhas-leads-crud` (push feito, aponta pro Vercel staging).
**Commit:** `88375ab` (13 arquivos, +1183/-179).
**Produção:** NÃO tocada nesta entrega, por instrução explícita.

### O que foi construído
- **Listagem** (`Campanhas.tsx`): ações explícitas ver (👁, link)/editar (✎, link)/arquivar
  (🗄, modal de confirmação). Nenhum caminho de exclusão definitiva na UI.
- **Arquivar** (`DELETE /api/campanhas`): reescrito — não apaga mais a linha nem desvincula
  leads; agora seta `status='cancelada'` (reaproveita enum da migration 020). Histórico
  (`historico_contato`) e vínculos (`campanha_leads`) nunca são tocados. Campanha sai da
  listagem ativa e aparece em "Arquivadas" (colapsável). Sem autorização adicional, exclusão
  definitiva continua indisponível nesta rodada — decisão deliberada por instrução.
- **Visualizar campanha** (`CampanhaDetalhe.tsx` + `[id]/page.tsx`): funil com Elegíveis
  (telefone válido e não suprimido), Leads contatados, Enviadas, Responderam, Opt-outs,
  Bloqueados e Erros como cartões separados — opt-out, bloqueado e erro nunca somados juntos.
- **Editar campanha** (`/campanhas/[id]/editar`, `CampanhaEditar.tsx`): página dedicada (não
  modal) — nome, busca/adicionar/remover lead, canal (fixo/rodízio + seleção de canais),
  mensagem (padrão/fixa/rodízio/IA), cadência. Salva via `PATCH /api/campanhas` (endpoint já
  existia, reaproveitado). Reload preserva tudo porque o estado vem sempre do servidor.
- **Leads — API de vínculo** (`/api/campanhas/[id]/leads`): `GET` busca leads da conta ainda
  não vinculados (empresa/telefone, min. 2 chars); `POST` vincula; `DELETE` desvincula via
  `desvincularLeadDaCampanha` (nova função em `campanhaLeads.ts`), que também realinha
  `prospecta_leads.campanha_id` (FK legado) para não quebrar a consistência
  listagem=detalhe quando o lead pertence a mais de uma campanha.
- **Editar lead**: modal institucional em `CampanhaDetalhe.tsx`, chama
  `PATCH /api/leads/[id]` (novo). Campos: empresa (nome do lead), telefone, especialidades
  (rotulada "Categoria/ramo" — é o campo real usado pela UI e pela importação; a coluna
  `categoria` em si é código morto, confirmado por grep) e endereço.
- **Regra crítica de telefone** (`/api/leads/[id]`): normaliza → valida formato → checa
  duplicidade dentro da conta (409 se houver) → checa supressão do número novo (avisa, não
  bloqueia o salvamento — a barreira real de envio é em `/api/disparo`) → preserva supressão
  do número antigo (nunca remove automaticamente) → registra a alteração em
  `historico_contato` (`status='telefone_alterado'`, com quem alterou e de/para).
- **Modal institucional** (`Modal.tsx` + CSS em `globals.css`): único componente reutilizado
  em arquivar campanha e editar lead. Respeita Dia/Noite via variáveis CSS existentes, foco
  (trap + retorno ao fechar), Escape, `role="dialog"`/`aria-modal`.

### Testes
`tests/campanhas-leads.test.js` — 13 cenários pedidos, todos passando: visualizar campanha
(métricas disjuntas), elegíveis, editar nome, adicionar/remover lead, reload/contador
listagem=detalhe, editar lead, editar telefone (normalização/duplicidade/supressão/
preservação), telefone duplicado, telefone suprimido, tenant isolation, permissões
(operador não arquiva), arquivamento preservando histórico. `npx tsc --noEmit`: limpo.
`npm run build`: sucesso, todas as rotas novas presentes.

### Pendências desta entrega
- QA autenticado no staging (Figueira QA) ainda não executado nesta sessão — branch só
  acabou de ser enviada ao Vercel.
- Scheduler (Prioridade 3) não iniciado, por instrução explícita.
