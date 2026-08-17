# STAGING_BOOTSTRAP — Harvest AI

> Documento executável/repetível para recriar o **staging** do Harvest sem
> perder configuração. **NÃO contém nenhum secret** — apenas nomes de variáveis,
> estrutura e ordem de bootstrap. Credenciais vivem em mecanismo seguro (Vercel
> Environment Variables para staging / Docker Secrets para produção) e **nunca**
> neste arquivo, no Git ou no frontend.

Escopo: INSTITUCIONAL — Figueira Marketing / Harvest AI.

---

## 1. Regra oficial de pipelines

```
feature/* (ou hotfix/*)
  → Preview URL própria (Vercel, por branch)
  → merge em integration/harvest-staging
  → alias estável harvest-staging.vercel.app  (ÚNICA fonte de staging)
  → QA operacional
  → aprovação
  → merge em main  →  produção (VPS Docker Swarm)
```

- **Nenhuma feature branch isolada** pode substituir o alias estável de staging.
- O alias `harvest-staging.vercel.app` aponta **somente** para `integration/harvest-staging`.
- Staging = **paridade funcional** com produção (módulos/telas/regras/flags), **não**
  compartilha secrets de produção nem opera sobre clientes reais.

## 2. Branch oficial de staging

- `integration/harvest-staging` — cumulativa, criada em 2026-08-16 a partir de
  `main` (a61b48d), mesclando (ordem):
  1. `integration/campanhas-leads-multiwhatsapp` (Campanhas/Leads CRUD + WAHA QR hotfix)
  2. `feature/crm-vine-port` (CRM P0 + adapter Twenty)
  3. `feat/smtp-institucional-brevo` (SMTP Brevo seguro/fail-closed + Auth recuperação OTP)

Auth (`feature/auth-recuperacao-senha`) **já está contido** em `feat/smtp`
(ancestor) — não foi mesclado separadamente para evitar duplicata.

## 3. Tenants QA necessários (staging)

| Tenant | Equivalente produção | Propósito |
|---|---|---|
| `Figueira QA` | Figueira (gestora institucional) | super admin, gestão institucional |
| `Guinffer QA` | Guinffer Pratas | cliente real (reproduzir cenário de WhatsApp/campanha) |

- Criar via seed/fluxo de contas QA (não copiar leads pessoais reais).
- NÃO copiar dados de produção desnecessariamente. NÃO enviar mensagens reais.
- Se for preciso copiar algum dado real para reproduzir bug: **parar e reportar**.

## 4. Módulos (paridade funcional)

- Prospecção / Busca Google Maps (SerpAPI, institucional)
- Campanhas + Leads CRUD (edição, add/remove lead)
- WhatsApp multi-canal (WAHA + Evolution) por tenant
- CRM P0 (pipeline Kanban + qualificação de lead, adapter Twenty) — ver §7
- Auth (recuperação / primeiro acesso por OTP)
- SMTP (Brevo, envio institucional seguro)
- Status / Saúde das integrações

## 5. Feature flags / variáveis de ambiente (nomes; valores em cofre)

| Nome | Ambiente | Onde | Notas |
|---|---|---|---|
| `NEXT_PUBLIC_AMBIENTE` | staging | Vercel | valor `staging` (badge + noindex) |
| `WHATSAPP_MODE` | staging | Vercel | valor `test` (fail-closed: só whitelist) |
| `WHATSAPP_QA_WHITELIST` | staging | Vercel | telefones QA, dígitos c/ DDI 55, vírgula |
| `WAHA_API_URL` | server (staging) | Vercel | WAHA de **teste**, nunca o de produção |
| `WAHA_API_KEY` | server (staging) | Vercel | idem |
| `SERPAPI_KEY` | server (staging) | Vercel | **credencial institucional** da Figueira (busca) |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`/`SMTP_REPLY_TO` | server (staging) | Vercel | Brevo (fail-closed) |
| `EVOLUTION_*` | por conta | `conta_credenciais` | instância/url/key por tenant |
| `ia_key`/`ia_provedor`/`ia_modelo` | por conta (BYOK) | `conta_credenciais` | IA opcional BYOK |
| `supabase` (URL + service role) | server | Vercel | banco de staging (`harvest-staging`) |

> Produção usa os mesmos nomes, mas SMTP vem de Docker Secrets (`/run/secrets/harvest_smtp_*`)
> e WAHA/Evolution/SerpAPI são as credenciais reais da Figueira (isoladas).

## 6. Integrações

| Integração | Modelo | Resolução no código | Status staging |
|---|---|---|---|
| **SerpAPI / Google Maps** | Institucional (Figueira) | `lib/serpapi.ts` → `SERPAPI_KEY` runtime; BYOK por tenant como fallback | código pronto; **secret pendente** (item de bloqueio) |
| **WAHA** | Institucional (servidor) | `lib/waha.ts` → `WAHA_API_URL`/`WAHA_API_KEY` env; sessão por `conta_id + canal_id` | depende de secret de staging |
| **Evolution** | Por tenant | `conta_credenciais.evolution_*`; isolamento por `conta_id` | depende de credencial por tenant |
| **Twenty (CRM)** | Fonte pós-qualificação | `lib/twenty.ts` (adapter GraphQL); CRM P0 em `integration/harvest-staging` | código integrado; sync futuro (HAI-002) |
| **Chatwoot** | Conversas (futuro) | — | fora de escopo P0 |
| **IA** | BYOK por tenant | `conta_credenciais.ia_key` | opcional |
| **SMTP (Brevo)** | Institucional (servidor) | `lib/smtpCredenciais.ts` → Vercel env / Docker Secrets; fail-closed | código pronto; **secret pendente** |
| **Supabase** | Banco prospecção/outbound | multi-tenant RLS | ok |

## 7. Divergência arquitetural registrada (NÃO silenciar)

Aprovação vigente (ADR-007 / Plano Mestre):

- **Harvest** = prospecção / campanhas / outbound / UX unificada.
- **Twenty** = fonte da verdade do CRM **pós-qualificação**.
- **Chatwoot** = fonte da verdade das conversas.
- **WAHA + Evolution** = transporte WhatsApp.

O CRM P0 atual em `integration/harvest-staging` usa o banco do Harvest
(`sql/021_crm_oportunidades.sql`, `lib/twenty.ts` como adapter). **Não** deve
virar CRM definitivo silenciosamente: o plano é sincronizar qualified leads para
o Twenty (HAI-002). Esta divergência está registrada aqui e no roadmap.

## 8. Contas QA / canais QA (estrutura, sem dados reais)

- Conta `Figueira QA`: papel super admin; vê gestão institucional.
- Conta `Guinffer QA`: papel admin cliente; canais próprios.
- Canal QA WhatsApp: criado por `+ Conectar número` → sessão WAHA própria do
  `conta_id + canal_id` (QR → WORKING → persistência em `whatsapp_canais`). Cada tenant vê
  **apenas** seus canais (isolamento por `conta_id` em `carregarCanais`).

## 9. Health esperado (aceite)

Após bootstrap, Guilherme deve conseguir:

1. ver os tenants QA necessários;
2. pesquisar Google Maps **sem** cadastrar chave pessoal (usa `SERPAPI_KEY`);
3. criar/conectar canal WhatsApp QA e ver QR;
4. editar campanha completa;
5. editar / add / remover lead;
6. usar CRM (pipeline Kanban);
7. ver status real das integrações.

O que não puder funcionar aparece claramente como **NÃO CONFIGURADO** (ou
"Busca temporariamente indisponível." / "indisponivel: true"), **nunca** como
"já disponível".

## 10. Ordem de bootstrap (reexecutável)

1. Criar projeto Vercel `harvest-staging` (id `prj_Eqo8e4wKY5eie3GpDuk2nYe3E4cf`),
   conectar repo, apontar branch `integration/harvest-staging` para o alias.
2. Banco de staging (Supabase `harvest-staging`): auditar e aplicar somente as
   migrations realmente pendentes até `021_crm_oportunidades.sql`.
   **Não aplicar `018_smtp_reply_to.sql` em staging/produção**: `SMTP_REPLY_TO`
   é resolvido pelo runtime protegido e a migration só atende o fallback local legado.
3. Seed de tenants QA (`Figueira QA`, `Guinffer QA`) + papéis.
4. Configurar Environment Variables de staging (nomes em §5) — **via cofre Vercel**.
5. Deploy da `integration/harvest-staging`.
6. Health check (§9). Se faltar credencial → estado "NÃO CONFIGURADO", não quebra o build.

## 11. Diferenças permitidas produção × staging

- Staging: `NEXT_PUBLIC_AMBIENTE=staging`, `WHATSAPP_MODE=test`, banco `harvest-staging`.
- Staging: WAHA/Evolution/SerpAPI/SMTP apontam para instâncias de **teste/QA**,
  não para as reais de produção.
- Staging: whitelist de envio bloqueia qualquer número fora de QA (fail-closed).
- Produção: Docker Secrets para SMTP; imagem via Docker Swarm/Traefik.
- Proibido em staging: enviar mensagem real, operar cliente real, compartilhar
  secret de produção.
