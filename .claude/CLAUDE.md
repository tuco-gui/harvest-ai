# Harvest AI — Agent Instructions

## Architecture Guardrails

**NON-NEGOTIABLE:** Before implementing CRM, workflow, automation, inbox, messaging, or bot features, check Twenty and Chatwoot first. Harvest does NOT recreate existing engines.

| System | Responsibility |
|--------|---------------|
| **Twenty** | CRM, opportunities, pipeline, workflows, commercial automations |
| **Chatwoot** | Channels, inbox, conversations, agents, conversational automations |
| **WAHA/Evolution** | WhatsApp transport only |
| **Harvest** | UX, prospection, campaigns, orchestration, intelligence |

### Rules
1. `lib/automacoes.ts` = **LEGACY ONLY** — scheduled for removal. Do NOT add new triggers or actions.
2. `lib/eventos.ts` = canonical event dispatcher. Routes events to Twenty/Chatwoot adapters.
3. Before building any feature, check: Does Twenty have it? Does Chatwoot have it? Use native API.
4. Only build custom when the capability truly does NOT exist in native engines.

### Deduplication
- One physical message → one commercial event
- Chatwoot = source of truth for conversations
- WAHA = transport only
- Correlation: message_id + provider + conversation_id + inbox_id

### Tenant Safety
- `funil_estagios` has NO `conta_id` column
- Always scope by `funil_id` AFTER validating funil belongs to current account
- Never accept `funil_id` from request without ownership validation
