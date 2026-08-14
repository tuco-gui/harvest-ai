# Plano Mestre — Harvest AI

**Escopo:** INSTITUCIONAL — Figueira Marketing
**Status:** Documento mestre. **Somente leitura após criação** — não alterar sem autorização explícita de Guilherme.
**Criado em:** 2026-08-12 (Fase 1 — Organização e migração)
**Revisado em:** 2026-08-13 (Fase 1.1 — correção de governança; ver `RELATORIO_ENTREGAS.md`, Entrega 02)
**Revisado em:** 2026-08-13 (fechamento Fase 3A — sincronização de roadmap/status pré-produção; ver `RELATORIO_ENTREGAS.md`, Entrega 04)
**Revisado em:** 2026-08-13 (Fase 3A concluída em produção — migration aplicada, deploy feito, QA passou; ver `RELATORIO_ENTREGAS.md`, Entrega 04)
**Revisado em:** 2026-08-14 (Fase 3C + prontidão operacional em produção — pesquisa≠campanha,
config de campanha, métricas, Saúde, correção LID, opt-out/supressão fechado ponta a ponta com
teste real de WhatsApp; ver `RELATORIO_ENTREGAS.md`, Entrega 13. Agendamento automático e
progresso durável de disparo **seguem não implementados**, deliberadamente, e a UI não os
apresenta como prontos.)
**Revisado em:** 2026-08-14 (entrega final ao cliente Guinffer Pratas — QA com perfil admin
cliente, bug de tema em `/chamados` corrigido, `GUIA_RAPIDO_HARVEST_GUINFFER.md` criado,
checklist de entrega PASSOU; ver `RELATORIO_ENTREGAS.md`, Entrega 14.)
**Revisado em:** 2026-08-14 (Entrega 15 — **nova política de processo, vigente a partir de
agora: DESENVOLVIMENTO → STAGING → PRODUÇÃO.** Produção deixa de ser o primeiro ambiente de
validação de qualquer mudança de código ou de migration. Guarda fail-closed de ambiente
(`WHATSAPP_MODE=test`), faixa visual de staging e `robots noindex` implementados e prontos
para o pipeline de staging (ainda não ativo); Dia/Noite e contraste do modo Dia corrigidos;
copy de agendamento simplificada. Arquitetura de staging desenhada mas **infraestrutura
externa (DNS, banco, deploy real) ainda não provisionada** — aguarda aprovação explícita.
Scheduler server-side, progresso durável de disparo, edição de campanha/lead e padronização
de modais permanecem roadmap, não implementados. Ver `RELATORIO_ENTREGAS.md`, Entrega 15.)
**Revisado em:** 2026-08-14 (Entrega 16 — **decisão alterada: staging passa a ser hospedado
no Vercel, não na VPS** (VPS de produção próxima do limite de recursos). Pipeline vigente:
DESENVOLVIMENTO → GITHUB → VERCEL STAGING/PREVIEW → QA → PRODUÇÃO NA VPS. Produção segue
exclusivamente em VPS/Docker Swarm — Vercel nunca é produção. Auditoria de compatibilidade:
Harvest é compatível com Vercel (sem `fs`, sem WebSocket/SSE, sem runtime edge forçado, WAHA/
Evolution/Supabase acessíveis por domínio público). Projeto Vercel e banco de staging ainda
NÃO foram provisionados — aguardam autorização explícita. Ver `RELATORIO_ENTREGAS.md`,
Entrega 16.)
**Revisado em:** 2026-08-14 (Entrega ao cliente fechada — bug cosmético de tema em `/chamados`
corrigido e redeployado, guia rápido criado para a Stephanie
(`00_ADMIN/GUIA_RAPIDO_HARVEST_GUINFFER.md`), checklist final de entrega registrado; ver
`RELATORIO_ENTREGAS.md`, Entrega 14. **Veredito: PRONTO PARA ENTREGAR.**)
**Caminho canônico do produto:** `/Users/gui_t/Figueira_Marketing/apps/Harvest_ai`
**Fontes usadas para compilar este documento:** `00_ADMIN/contexto-do-projeto.md`, `00_ADMIN/decisoes.md`, `00_ADMIN/lousa-orquestracao.md`, `01_AUDITORIAS/auditoria-v2/Harvest_AI_Auditoria_V2_BUILD_vs_REUSE.md`, `README.md`, histórico Git de `CODIGO/harvest-ai` (branch `main`, HEAD `5c418f3` em 2026-08-12), Brain (`brain/00-sistema/CONSTITUICAO.md`, `PRECEDENCIA.md`, `GOVERNANCA-AGENTES.md`, `POLITICA-DOCUMENTACAO-OFICIAL.md`).

---

## 1. Visão do produto

**FATO VERIFICADO** (README.md / contexto-do-projeto.md):

Harvest AI é um **SaaS B2B multi-tenant para prospecção ativa via WhatsApp**:

> Busca no Google Maps → Enriquecimento → Campanhas → Disparo → CRM

Evolução do produto: estudo/prototipagem (Prospector, n8n + Apify + Kipflow) → Prospector AI (MVP HTML/JS + n8n) → **Harvest AI** (rewrite completo em Next.js 15 SaaS multi-tenant) → estratégia BUILD vs REUSE (integração com stack self-hosted em vez de reconstruir CRM/inbox/automação internamente).

**Decisão executiva de escopo de produto — histórico (ADR-002, Auditoria V2, 2026-08-07):** o Harvest **não deveria reconstruir CRM, help desk, inbox omnichannel ou motor de automação como produtos internos duplicados**. Ele é o sistema de descoberta, enriquecimento, score, campanhas, fila de outbound, supressão, regras de negócio, custos e inteligência de abordagem.

**Atualização da decisão (ADR-007, Aceito, 2026-08-13 — ver seção 5):** o Harvest passa a ser a **experiência principal/unificada** do produto. Twenty continua como **motor de CRM** e Chatwoot como **motor de conversas** — o dado e a lógica de CRM/mensageria continuam vivendo em Twenty/Chatwoot — mas o Harvest **pode expor CRM, pipeline, conversas e mensageria dentro da própria UX**, sem reconstruir desnecessariamente as capacidades internas desses produtos. Isso atualiza a leitura mais restritiva do ADR-002 quanto a não expor UI de CRM/conversas.

### 1.1 Visão modular de SaaS (planos comerciais)

**RECOMENDAÇÃO** (registrada na Fase 1.1, 2026-08-13 — sem billing implementado):

| Plano | Escopo |
|---|---|
| **CRM** | Apenas motor de CRM (Twenty) exposto na experiência Harvest |
| **CRM + Mensageria** | CRM (Twenty) + conversas/inbox (Chatwoot) exposto na experiência Harvest |
| **CRM + Prospecção** | CRM (Twenty) + módulo de prospecção/enriquecimento/campanhas do Harvest |
| **Completo** | CRM + Mensageria + Prospecção — experiência unificada completa |

**Fora de escopo agora:** billing/cobrança por plano. Esta é uma visão de modularidade de produto, não uma implementação.

### 1.2 Meta operacional (MVP) — até 17/08/2026

**DECISÃO** (registrada no fechamento da Fase 3A, 2026-08-13): fluxo mínimo funcional a valer até 17/08/2026 —

```
Campanha → envio → resposta → opt-out OU atendimento → Chatwoot
  → IA responde → handoff humano quando necessário
  → qualificado pode seguir para Twenty
```

Pipeline visual completo **não é bloqueador** deste MVP — ver ordem vigente em 4.1.

## 2. Arquitetura aprovada

**FATO VERIFICADO** (Auditoria V2 — leitura obrigatória: `01_AUDITORIAS/auditoria-v2/Harvest_AI_Auditoria_V2_BUILD_vs_REUSE.md`):

```text
                         HARVEST AI
       Prospecção + enriquecimento + campanhas + regras + IA
                              |
              +---------------+----------------+
              |               |                |
              v               v                v
        Evolution API      Chatwoot          Twenty
        transporte WA      conversas         CRM
              |               |                |
              +---------------+----------------+
                              |
                       integrações/eventos
                              |
                             n8n

Operação interna / desenvolvimento: Kaneo
Referências de IA: awesome-llm-apps
```

### Papel de cada produto

| Produto | Responsabilidade |
|---|---|
| **Harvest AI** | Descoberta, enriquecimento, score, campanhas, fila outbound, supressão, regras, custos, inteligência de abordagem |
| **Evolution API** | Somente gateway/transporte WhatsApp (instâncias, webhooks, status) |
| **WAHA** | Segundo provedor de transporte WhatsApp (alternativa/redundância à Evolution — ver seção 5) |
| **Chatwoot** | Fonte da verdade das conversas: inbox, atendimento humano, agentes, times, notas, handoff |
| **Twenty** | Fonte da verdade do CRM pós-qualificação: pessoas, empresas, oportunidades, pipeline, tarefas |
| **n8n** | Integração e automações não críticas entre sistemas |
| **Kaneo** | Backlog, issues, gestão interna dev/ops |

**Stack técnica do Harvest AI** (`CODIGO/harvest-ai/app`): Next.js 15, React 19, TypeScript, Tailwind; Supabase Auth + Postgres (RLS multi-tenant); busca via SerpAPI → Google Maps; enriquecimento via Serper, Tavily, Perplexity, Snov.io; IA via Ollama Cloud, Groq, Gemini, OpenAI, Anthropic.

**Atualização (ADR-007, 2026-08-13):** Twenty e Chatwoot continuam como motores de dado/lógica de CRM e conversas, respectivamente; o Harvest pode expor essas capacidades (CRM, pipeline, conversa, mensageria) dentro da própria UX unificada, sem duplicar a lógica interna desses produtos. Ver seção 1.1 e seção 5.

## 3. Módulos (produto)

**FATO VERIFICADO** (contexto-do-projeto.md / código atual): Prospecção (busca Maps + planilha + entrada manual), Enriquecimento, Campanhas, Disparo WhatsApp (multi-provedor: Evolution + WAHA), Configurações, Usuários/Equipe, Contas (multi-tenant), Chamados, Status/Sistema.

**Nomenclatura — Conversas ≠ Chamados (registrado no fechamento da Fase 3A):** `Chamados` é suporte/tickets internos do Harvest (já implementado — tabelas `conversas`/`conversa_mensagens` no banco, apesar do nome da tabela, são a base de dados de `Chamados`, não do módulo comercial). `Conversas` (a partir da Fase 3D) é o atendimento comercial via Chatwoot — módulo diferente, ainda não implementado. Evitar colisão de nomenclatura no código novo e na UX: qualquer tabela/rota nova para o módulo comercial de conversas deve ter nome explícito (ex.: `chatwoot_*`), nunca reaproveitar `conversas`/`conversa_mensagens`.

**Estrutura de artefatos do workspace** (`/Users/gui_t/Figueira_Marketing/apps/Harvest_ai`):

| Categoria | Caminho |
|---|---|
| Código oficial | `CODIGO/harvest-ai/` (clone de `github.com/tuco-gui/harvest-ai`, branch `main`) |
| Auditorias | `01_AUDITORIAS/` |
| Arquitetura | `02_ARQUITETURA/` |
| Pesquisas | `03_PESQUISAS/` |
| Workflows n8n | `04_WORKFLOWS/n8n/` |
| Transcrições | `05_TRANSCRICOES/` |
| Referências | `06_REFERENCIAS/` |
| Implementações | `07_IMPLEMENTACOES/` (HAI-001A, HAI-001B, HAI-002, HAI-003) |
| Planos | `08_PLANOS/` |
| Testes/Evidências | `09_TESTES/` |
| Legado | `10_LEGADO/` |
| Admin | `00_ADMIN/` (este documento, relatório de entregas, contexto, decisões, lousa) |

---

## 4. Roadmap técnico / ordem das fases

**RECOMENDAÇÃO** (consolidado de `lousa-orquestracao.md` + `contexto-do-projeto.md`, na ordem em que devem ser tratadas):

1. **HAI-001A — Isolamento multi-tenant `(conta_id, place_id)`** → **CONCLUÍDO** (merge `e9d8d8f`, 2026-08-07). Ver seção 5.
2. **ROT-001 — Rotacionar segredos expostos** (Supabase service role, Baserow token) → status a confirmar nesta fase (ver `RELATORIO_ENTREGAS.md`, pendências).
3. **HAI-001B — Criptografar credenciais no banco** (pgcrypto ou application-level) → depende de HAI-001A (concluído); ainda não iniciado.
4. **RLS-001 — Auditoria completa de policies RLS Supabase** → depende de HAI-001A; ainda não iniciado.
5. **Integração WAHA como segundo provedor WhatsApp** → **CONCLUÍDO** (commits `9d32862`…`5c418f3`, 2026-08-08 a 2026-08-12). Ver seção 5.
6. **HAI-002 — Integrações core:** Evolution webhooks, Chatwoot sync, Twenty sync → depende de HAI-001B; ainda não iniciado.
7. **HAI-003 — Inteligência:** scoring de leads, IA para abordagem, supressão inteligente (DNC/opt-out) → ainda não iniciado.
8. **TEST-001 — Testes automatizados** (auth, isolamento de tenant, webhooks) → ainda não iniciado.
9. **CI-001 — Pipeline CI/CD** (build de imagem/container + deploy na VPS Figueira via Docker Swarm/Traefik + migrações Supabase) → depende de TEST-001; ainda não iniciado.

**Regra de ordem:** não iniciar a etapa N+1 antes de concluir e documentar a etapa N, salvo decisão explícita registrada em `00_ADMIN/decisoes.md`.

**Nota:** este roadmap técnico não é alterado quanto às pendências de segurança — HAI-001B, RLS-001 e ROT-001 seguem registrados como pendências técnicas importantes (ver seção 8).

### 4.1 Roadmap comercial (produto) — ordem vigente

**DECISÃO** (registrada em 2026-08-13, atualizada no fechamento da Fase 3A; complementa, não substitui, o roadmap técnico acima — HAI-001B, RLS-001 e ROT-001 continuam de pé, ver seção 8):

| Fase | Conteúdo | Status |
|---|---|---|
| **3A** | Base outbound e proteção — `campanha_leads`, histórico de contato, `conta_supressao`, barreira pré-envio | **CONCLUÍDA EM PRODUÇÃO** (migration `016_base_outbound_protecao.sql` aplicada e validada; merge em `main` — commit `1afb3cc`; deploy na VPS via imagem `ghcr.io/tuco-gui/harvest-ai:1afb3cc...`; QA pós-deploy sem incidentes; ver `RELATORIO_ENTREGAS.md`, Entrega 04) |
| **3B** | Inbound — WAHA + Evolution, normalização de eventos | **PARCIALMENTE EM PRODUÇÃO** — migration `017_inbound_eventos.sql` aplicada e validada; merge em `main` (commits `11c2bac`, `e277e8e` — corrige bug crítico de middleware que bloqueava todo webhook); deploy na VPS via imagem `...e277e8e3c10e16b9fd19e78ab1abc4b6da011c89`; webhook WAHA configurado e ativo (conta Guinffer Pratas); **webhook Evolution bloqueado** (nenhuma conta em produção tem instância Evolution real conectada); **teste com mensagem real ainda pendente** (só payload sintético assinado foi validado) — ver `RELATORIO_ENTREGAS.md`, Entrega 06 |
| **3B.1** | UX operacional e WhatsApp multicanal (permissões/módulos por conta, `whatsapp_canais`, disparo fixo/rodízio, rastreabilidade por canal, Campanhas/Status) | **CONCLUÍDA EM PRODUÇÃO** (reconciliado em 2026-08-13 — ver Entrega 09). Migration `018_fase_3b1_ux_operacional.sql` confirmada aplicada em produção (tabela `whatsapp_canais`, `historico_contato.canal_id`, `contas.modulos_habilitados` existem no banco real). `main` em `cbcd092`, enviada a `origin/main`; imagem `ghcr.io/tuco-gui/harvest-ai:latest` rodando na VPS (`/api/canais` responde protegido). As Entregas 07/08 registraram isso como "só local" — **corrigido nesta revisão**: o trabalho avançou para produção depois daquelas entregas, sem atualização documental correspondente. |
| **3B.1.1** | Correção de QA operacional pós-3B.1 (WhatsApp 1 seção, canal padrão, reconciliação WAHA, permissões admin cliente, ponte de busca centralizada, log operacional) | **CONCLUÍDA EM PRODUÇÃO** (mesmo commit `cbcd092`/deploy acima) |
| **3C** | Opt-out e status de resposta | **IMPLEMENTADA LOCALMENTE, NÃO DEPLOYADA** — migration `sql/019_fase_3c_optout_resposta.sql` e código (`lib/optoutResposta.ts`, alterações em `lib/inbound.ts`/Campanhas) presentes no working tree de `main`, **não commitados, não aplicados em produção** (confirmado: `inbound_eventos.tipo_evento` não existe no banco real). Preservados intactos durante a reconciliação de 2026-08-13. |
| **3D** | Chatwoot + IA atendente | Não iniciado |
| **3E** | Twenty mínimo | Não iniciado |
| **3F** | UX operacional mínima no Harvest | Não iniciado |

Depois de 3F: Pipeline/UX Vine → fila/idempotência → IA avançada → enriquecimento → cadências → atribuição → planos SaaS (ver 1.1).

Meta operacional do conjunto 3A→3E: fluxo mínimo funcional até 17/08/2026 (ver 1.2).

## 5. Decisões — Harvest / Twenty / Chatwoot / WAHA-Evolution / Vine

**FATO VERIFICADO** (ADRs em `00_ADMIN/decisoes.md` + histórico Git + Auditoria V2):

- **ADR-001 (Aceito, 2026-08-07):** Isolamento multi-tenant por `(conta_id, place_id)` — unique constraint composta na tabela `leads`. **Implementado e mesclado** (`ddd22d6` → merge `e9d8d8f`).
- **ADR-002 (Aceito, 2026-08-07 — atualizado por ADR-007 em 2026-08-13):** Harvest não deveria reconstruir CRM/help desk/inbox como produtos internos duplicados. Integra com Evolution API, Chatwoot, Twenty, n8n.
- **ADR-003 (Proposto, 2026-08-07):** Credenciais criptografadas no banco (pgcrypto ou application-level). **Ainda não implementado.**
- **ADR-004 (Aceito, 2026-08-07):** RLS Supabase como camada primária de segurança em todas as tabelas multi-tenant.
- **ADR-005 (Aceito, 2026-08-07):** n8n apenas para automações não críticas; lógica de negócio core fica no Next.js.
- **ADR-006 (Aceito, 2026-08-07):** Evolution API self-hosted como gateway WhatsApp.
- **ADR-007 (Aceito, 2026-08-13):** Harvest é a **experiência principal/unificada** do produto. Twenty é o **motor de CRM**; Chatwoot é o **motor de conversas**. O Harvest não deve reconstruir desnecessariamente as capacidades internas desses produtos, mas **pode expor CRM, pipeline, conversas e mensageria dentro da própria UX** do Harvest. Atualiza a leitura restritiva do ADR-002. Ver visão modular em 1.1 e roadmap comercial em 4.1.
- **ADR-008 (Aceito, 2026-08-13; correção de interpretação registrada em 2026-08-13):** n8n sai do caminho crítico do **Harvest** — não do ecossistema Figueira. A busca no Google Maps *dentro do Harvest* (`/api/busca`, `/api/testar`) passou a chamar a SerpAPI diretamente do backend Next.js (`lib/serpapi.ts`), sem o salto pelo webhook n8n (`N8N_WEBHOOK_BUSCA`) — essa ponte existia só por causa do CORS do painel HTML antigo (pré-Next.js), que não se aplica ao backend atual do Harvest. **Isto não significa remover, desativar, ou depreciar o n8n, o workflow `Prospecta IA`, ou qualquer webhook/fluxo legado** — nada disso foi tocado. Formulação correta: **n8n não deve ser dependência desnecessária do core do Harvest; permanece como plataforma de automação, integração e execução de produtos/workflows independentes** (Prospecta IA, automações periféricas do Harvest, integrações customizadas, workflows específicos de clientes — ver ADR-005). O **Prospecta IA** (busca + CSV + geração de mensagem + disparo + waits + integrações via n8n) segue existindo como implementação independente e é registrado aqui como **hipótese/decisão comercial** de arquitetura — potencial oferta de entrada/versão econômica da Figueira, separada do Harvest — sem pricing/billing implementado. Busca nativa do Harvest implementada localmente na branch `feat/busca-nativa-sem-n8n` (commit `0e724c1`), **não mesclada/enviada/deployada** — aguarda autorização. Ver `RELATORIO_ENTREGAS.md`, Entregas 09 e 10.
- **Decisão adicional observada no código (2026-08-08 a 2026-08-12, ainda sem ADR formal em `decisoes.md`):** adoção de **WAHA** como segundo provedor de transporte WhatsApp, com seletor de provedor em Configurações, conexão por QR Code, rotas de disparo/validação suportando ambos os provedores, e regra de "fonte única de verdade sem fallback silencioso" entre Evolution e WAHA (commit `5c418f3`). **Pendência registrada:** formalizar este ADR em `00_ADMIN/decisoes.md` (fora do escopo desta Fase 1, que não altera implementação).
- **Harvest / Supabase:** responsável por prospecção, listas, campanhas, enriquecimento, histórico outbound, supressão, regras, eventos e custos. É o banco de dados de origem de tudo isso — Twenty e Chatwoot não duplicam essa camada.
- **Twenty (CRM):** fonte da verdade de pessoas/empresas/oportunidades/pipeline pós-qualificação. Harvest não duplica CRM.
- **Chatwoot:** fonte da verdade das conversas/inbox/handoff humano. Harvest não duplica inbox.
- **VineCRM (formalizado na Fase 1.1):** **não é um terceiro produto.** Tratado como: (1) implementação anterior do mesmo esforço; (2) referência de UX; (3) possível fonte de componentes/código a reaproveitar. Descontinuado como produto separado (Auditoria V2). **Alerta de segurança herdado:** o ZIP do VineCRM continha credenciais reais em `.env.local`/`docker-compose.yml` — essas chaves nunca devem ser reutilizadas; devem ser tratadas como comprometidas.
- **Evo CRM Community:** referência arquitetural/UX apenas, não é núcleo do Harvest (é single-tenant).

---

## 6. Regras de governança (herdadas do Brain — `brain/00-sistema/`)

- **Precedência de fontes** (`PRECEDENCIA.md`): 1) ordem explícita de Guilherme; 2) decisão aprovada e registrada para o escopo; 3) contrato/SOW/SLA; 4) constituição operacional/instruções do projeto; 5) arquivos atuais do cliente/prospect; 6) Manifesto Figueira; 7) Brand Board; 8) materiais antigos como referência apenas.
- **Governança de agentes** (`GOVERNANCA-AGENTES.md`): agente = quem pensa; skill = como fazer; tool/MCP = com o que executar. Todo trabalho começa por exatamente um escopo (`INSTITUCIONAL`, `CLIENTE: nome`, `PROSPECT: nome`) — Harvest AI é escopo **INSTITUCIONAL: Figueira Marketing**. Estados de verdade válidos: `VERIFICADO`, `NÃO VERIFICADO`, `SEM DADO`, `HIPÓTESE`, `RECOMENDAÇÃO`. **Aprovação humana obrigatória para qualquer ação externa ou destrutiva.**
- **Política de documentação oficial** (`POLITICA-DOCUMENTACAO-OFICIAL.md`): antes de implementar/alterar API/MCP, localizar documentação oficial, conferir versão/changelog, registrar fonte, aplicar mudança mínima, testar, registrar comportamento observado. Nenhum endpoint/parâmetro/permissão/métrica/versão deve ser alterado só com base em memória de IA.
- **Segurança de credenciais:** nunca revelar, copiar, registrar ou expor senhas, tokens, API keys, cookies, chaves privadas, `.env` ou credenciais em documentação, relatórios ou chat. Segredos identificados como expostos (ROT-001) devem ser rotacionados, não documentados em texto claro.
- **Escopo desta Fase 1:** apenas organização e migração de caminho. Nenhuma feature nova, nenhum deploy, nenhuma alteração em produção, nenhuma implementação de CRM/Chatwoot/Twenty, nenhuma alteração no Vine CRM.

## 7. Estado real do código e infraestrutura

**FATO VERIFICADO** (Git, `CODIGO/harvest-ai/`, checado em 2026-08-12):

- Repositório: `github.com/tuco-gui/harvest-ai`
- Branch: `main` (up to date com `origin/main`, working tree limpo)
- HEAD: `5c418f3d0cf8a0118e04d20ca0582e255d167fbb` — "fix: provider WhatsApp como fonte única de verdade, sem fallback silencioso"
- Total de commits: 49

**Atualização (2026-08-13, deploy da Fase 3A):** HEAD de `main` avançou para `1afb3cca825ff64bf0c480270e1b7db1e186484b` ("fix(3A): verificador de 016 roda em transação com rollback", em cima de `710767f` "feat(3A): base outbound e proteção"). Imagem correspondente já rodando em produção (`ghcr.io/tuco-gui/harvest-ai:1afb3cca825ff64bf0c480270e1b7db1e186484b`, serviço `harvest_harvest` no Swarm, convergido e saudável). Ver `RELATORIO_ENTREGAS.md`, Entrega 04, "Execução em produção".

**Correção (Fase 1.1, 2026-08-13):** a produção do Harvest **não roda na Vercel**. Infraestrutura real:

- **Host:** VPS Figueira
- **Orquestração:** Docker Swarm
- **Proxy/roteamento:** Traefik
- **Deploy:** por imagem/container, conforme processo atual de infraestrutura (não é pipeline CI/CD via Vercel)
- **Banco:** Supabase (`https://supabase.figueiramarketing.com.br`)
- **URL de produção:** https://harvest.figueiramarketing.com.br/

---

## 8. Alertas críticos vigentes

- **NÃO VERIFICADO nesta fase:** se os segredos expostos (Supabase service role, Baserow token, `.claude/settings.local.json`) já foram rotacionados. Confirmar em `RELATORIO_ENTREGAS.md`/próxima fase antes de qualquer deploy.
- **Credenciais em texto puro no banco** (ADR-003, proposto, não implementado) — HAI-001B ainda pendente.
- **ADR do WAHA** ainda não formalizado em `00_ADMIN/decisoes.md` apesar de já implementado no código.

---

## 9. Roadmap — navegação/sidebar (nota registrada, não implementado)

**RECOMENDAÇÃO** (Entrega 12, 2026-08-13): o menu principal (`Topo.tsx`) já tem 8+ itens de
primeiro nível (Prospecção, Campanhas, Configurações, Usuários, Chamados, Saúde, e mais para
super_admin: Contas, Equipe, Sistema). Isso ainda cabe numa barra horizontal, mas está perto do
limite — à medida que o produto cresce (ex.: mais páginas dentro de Campanhas, uma futura seção
de relatórios), vale avaliar uma navegação lateral com agrupamento por seção em vez de continuar
adicionando itens de topo. Não é urgente e não foi implementado nesta entrega — registrado aqui
só para não se perder.

## 10. Estado local pós-Entrega 12 (não deployado)

**FATO VERIFICADO** — branch local `fase-prontidao-operacional` (a partir de `main`, HEAD
`acbf563`, o mesmo commit em produção), 3 commits, sem push:
pesquisa≠campanha, configuração de campanha (mensagem/cadência/agendamento), métricas duráveis
via `historico_contato`, Saúde reestruturada (timeline única, status por canal), correções LID/
Saúde da Entrega 11 e Fase 3C completa. Migrations 019 e 020 são locais, idempotentes,
verificadas por dry-run transacional — nenhuma aplicada em produção. Ver `RELATORIO_ENTREGAS.md`,
Entrega 12, para o detalhamento item a item (o que ficou parcial: executor de agendamento e
progresso de disparo durável exigem infraestrutura de fila/cron ainda não decidida).

---

## 11. Estado pós-Entrega 21 (produção)

**FATO VERIFICADO** — produção rodando commit `a61b48d31eed796626d3551314bc56519f0fafc5`
(Next.js 15.5.23 + correção do hydration error #418 em `/chamados`), serviço `harvest_harvest`
1/1 estável. `npm audit`: 0 críticas, 3 High (`postcss`/`sharp`, vendorizadas no próprio
`next@15.5.23`, só resolvíveis com Next 16 major — não iniciado). Staging (Vercel +
Supabase Cloud `harvest-staging`) segue disponível para QA de próximas mudanças antes de
produção. Ver `RELATORIO_ENTREGAS.md`, Entrega 21, para o detalhamento da correção.

Roadmap de produto represado (nenhum item iniciado ainda, todos PENDENTE): UX
Campanhas/Leads (ver/editar/excluir, edição de lead, semântica opt-out/bloqueado/erro, modal
institucional), Copy/Humanizer, Scheduler server-side durável, Progresso durável de disparo,
Conversas/Chatwoot (auditar integração existente antes de implementar UX própria). Próximo
passo combinado: iniciar por Campanhas/Leads.

---

*Este documento é a fonte institucional única de visão/arquitetura/roadmap/decisões do Harvest AI a partir de 2026-08-12. Documentos em `00_ADMIN/contexto-do-projeto.md`, `decisoes.md` e `lousa-orquestracao.md` continuam existindo como histórico operacional detalhado, mas em caso de conflito este Plano Mestre prevalece (Precedência item 2 — decisão registrada para o escopo).*

*Alterações a este documento exigem autorização explícita de Guilherme.*

## Entrega 22 — Campanhas/Leads CRUD (staging)
Branch `feature/campanhas-leads-crud`, commit `88375ab`, push feito (Vercel staging).
Ver detalhamento completo em RELATORIO_ENTREGAS.md. Produção não alterada.
Pendente: QA autenticado em staging; depois disso, promoção fica sujeita a autorização
explícita (não incluída nesta instrução).
