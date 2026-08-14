# Arquitetura atual do Harvest — visão de ecossistema

Este documento cobre a arquitetura **de ecossistema** (Harvest + os outros
sistemas da Figueira em volta dele) na data desta auditoria (2026-08-14). A
arquitetura **interna de código** (pastas, tabelas, papéis) já está bem
documentada em `README.md` (raiz) e não é duplicada aqui. Decisões técnicas
específicas do WAHA têm design próprio em `docs/superpowers/specs/` e
`docs/superpowers/plans/`.

## 1. Onde cada peça vive

| Peça | Papel | Fica em |
|---|---|---|
| **Harvest** | Prospecção, enriquecimento, campanhas, outbound, supressão, regras de negócio, UX unificada | Este repositório — Next.js 15 App Router |
| **WAHA** | Transporte WhatsApp (provider `waha`) — uma sessão por conta | Serviço próprio, ver `app/src/lib/waha.ts` |
| **Evolution** | Transporte WhatsApp (provider `evolution`) — suportado em paralelo ao WAHA, sem fallback silencioso entre os dois | Serviço próprio |
| **Chatwoot** | Fonte da verdade das conversas/inbox e handoff humano | Fora deste repo — integração ainda pendente (ver seção "Pendências" no Handoff) |
| **Twenty** | Fonte da verdade do CRM pós-qualificação | Fora deste repo |
| **n8n** | Automações e integrações não críticas. Prospecta IA continua como implementação/produto independente, preservado deliberadamente | Fora deste repo |
| **Supabase** | Banco de dados (Postgres) + Auth, multi-tenant via `conta_id` e RLS | Self-hosted em produção; Supabase Cloud separado em staging |

Harvest pode expor CRM e conversas na própria UX no futuro, mas a decisão
vigente é **não duplicar** os motores internos de Twenty/Chatwoot.

## 2. Produção × Staging — não confundir

**Produção real do Harvest não roda na Vercel.**

| | Produção | Staging |
|---|---|---|
| Onde | VPS da Figueira, Docker Swarm, Traefik, imagem via GHCR | Projeto Vercel `harvest-staging` (Preview/Staging apenas) |
| URL | `https://harvest.figueiramarketing.com.br` | `harvest-staging-*.vercel.app` (URL de preview muda por deploy) |
| Banco | Supabase self-hosted de produção | Supabase Cloud staging separado (`harvest-staging`), dados fictícios (conta `Figueira QA`) |
| WhatsApp | Números reais de cliente | Fail-closed por padrão (`WHATSAPP_MODE`, `WHATSAPP_QA_WHITELIST`) — nenhum disparo real sai de staging sem número explicitamente autorizado |
| Sinalização visual | nenhuma | badge fixo "AMBIENTE DE TESTE — dados fictícios, nenhum disparo real sai daqui" + `noindex,nofollow` |
| Deploy | `main` → GitHub Actions (`Publicar imagem`) → imagem GHCR por SHA → `docker service update` no Swarm | qualquer push de branch → build automático no Vercel |

Fluxo institucional completo: **feature/hotfix branch → testes locais → tsc
→ build → push → Vercel staging → QA (idealmente autenticado e visual) →
aprovação explícita → merge em `main` → GitHub Actions → imagem por SHA →
VPS produção → smoke test.**

Nenhuma etapa desse fluxo pula a anterior. Merge em `main` e deploy em
produção sempre exigem aprovação explícita de Guilherme — nunca automático
a partir de uma branch de feature ou hotfix.

## 3. Transporte WhatsApp — pontos que um agente precisa saber antes de mexer

- **Uma sessão WAHA por conta** (`conta_id`), não por canal. Múltiplas linhas
  de `whatsapp_canais` com `provider='waha'` na mesma conta apontam para a
  mesma sessão. `lib/waha.ts` → `wahaSessionName(contaId)`.
- Estados de sessão WAHA: `STARTING`, `SCAN_QR_CODE`, `WORKING`, `FAILED`,
  `STOPPED`, mais um `'ERRO'` sintético quando a própria criação da sessão
  falha.
- O navegador **nunca** fala direto com WAHA/Evolution — sempre via
  `/api/*` do Next.js, que deriva a conta da sessão verificada
  (`perfilAtual()`), nunca do corpo da requisição.
- Design original do provider WAHA (contexto de decisão): ver
  `docs/superpowers/plans/2026-08-11-waha-provider-plan.md` e
  `docs/superpowers/specs/2026-08-11-waha-provider-design.md`.
- Estado do fluxo de conexão por QR (histórico, regressão e hotfix): ver
  `docs/RELATORIO_ENTREGAS.md`, entregas de WAHA multicanal e "HOTFIX P0".

## 4. Multi-tenant e segurança — regra que atravessa o projeto inteiro

Postgres via Supabase, RLS em toda tabela de dado de cliente: cada conta só
enxerga as próprias linhas, exceto `super_admin`. Isso é a segunda camada —
a primeira é o servidor nunca aceitar `conta_id` vindo do navegador. Detalhe
completo de tabelas e papéis em `README.md` (raiz), seção "Banco de dados".

## 5. Onde aprofundar

- Estrutura de código, tabelas, rotas: `README.md` (raiz).
- Histórico fase a fase (Fase 0 até 9d): `docs/roadmap-saas.md`.
- Como publicar em produção: `docs/deploy.md`.
- Webhooks inbound (WAHA/Evolution → eventos normalizados): `docs/inbound-webhooks.md`.
- Enriquecimento de lead: `docs/enriquecimento.md`.
- Decisões e entregas cronológicas completas: `docs/RELATORIO_ENTREGAS.md`.
- Plano vigente e prioridades: `docs/PLANO_MESTRE_HARVEST.md`.
