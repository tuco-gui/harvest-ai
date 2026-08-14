# HANDOFF — HARVEST AI → AGENTES REMOTOS
Data: 2026-08-14
Escopo: INSTITUCIONAL — Figueira Marketing
Produto: Harvest AI

Este documento existe para que qualquer agente remoto (Manus, Gemini, ou
outro) entenda o estado real do Harvest **lendo apenas o GitHub**, sem
depender do filesystem local do Mac. É a versão generalizada de um handoff
que originalmente foi escrito só para o Manus — se você é o Manus, este
arquivo é o seu ponto de entrada; se é outro agente, vale igual.

Regra principal: não reconstruir contexto pela memória, não assumir estado,
não mexer em produção antes de auditar repositório, `docs/`, staging e
branches atuais.

Fluxo obrigatório: diagnóstico → decisão → plano → implementação em branch →
Vercel staging → QA → aprovação → produção VPS.

## 1. Governança — leia primeiro `docs/README_GOVERNANCA.md`

Esse arquivo explica as fontes canônicas, por que o Manifesto e as
instruções do GPT da Figueira **não** estão espelhados aqui, e a regra de
precedência. Não pule essa leitura.

## 2. Visão do produto

Harvest AI é o produto principal/unificado da Figueira para prospecção e
operação comercial.

- **Harvest**: prospecção, enriquecimento, campanhas, outbound, supressão,
  regras, inteligência de abordagem, experiência unificada.
- **WAHA + Evolution**: transporte WhatsApp; ambos suportados; sem fallback
  silencioso entre eles.
- **Chatwoot**: fonte da verdade das conversas/inbox/handoff humano
  (integração ainda pendente).
- **Twenty**: fonte da verdade do CRM pós-qualificação.
- **n8n**: automações e integrações não críticas; Prospecta IA preservado
  como implementação/produto independente, não removido.

Detalhe de arquitetura completo: `docs/ARQUITETURA_HARVEST.md`.

## 3. Produção

Produção **não** roda na Vercel.
- URL: `https://harvest.figueiramarketing.com.br`
- VPS Figueira, Docker Swarm, Traefik, GHCR, GitHub Actions (`Publicar imagem`)
- Supabase self-hosted de produção
- Fluxo: `main` → GitHub Actions → imagem GHCR por SHA → Docker Swarm → smoke test
- Framework atual: Next.js 15.5.23. Next 16 deliberadamente fora do escopo atual.
- Segurança: 0 Critical após hardening; 3 High restantes ligadas a
  postcss/sharp; não executar `npm audit fix --force`.

## 4. Staging

Staging separado para preservar recursos da VPS.
- Vercel: projeto `harvest-staging`, Preview/Staging apenas.
- Supabase Cloud staging separado, dados fictícios (conta `Figueira QA`).
- Nenhuma base real da Guinffer, webhook real, WhatsApp de produção ou
  Chatwoot de produção por padrão.
- Fail-closed de envio (`WHATSAPP_MODE`, `WHATSAPP_QA_WHITELIST`).
- `NEXT_PUBLIC_AMBIENTE=staging`, badge "AMBIENTE DE TESTE", `noindex,nofollow`.

Fluxo oficial: feature/hotfix branch → testes → Vercel Preview → QA →
aprovação → merge `main` → imagem Docker → VPS produção.

## 5. Fases já concluídas (produção)

- **3A** — outbound/proteção: `campanha_leads` N:N, `historico_contato`,
  `conta_supressao`, normalização de telefone, suppression gate,
  WAHA/Evolution, RLS/constraints/índices.
- **3B** — inbound multiprovedor: webhooks WAHA/Evolution,
  `inbound_eventos`, idempotência, resolução de conta, segurança de
  webhook, WAHA real configurado.
- **3B.1** — módulos por conta, `whatsapp_canais`, `canal_id` em histórico,
  canal padrão/fixo/round-robin, configuração de canais, permissões, IA
  BYOK, tela de Saúde.
- **3B.1.1** — consolidação UX WhatsApp, WAHA reconciliado com sessão real,
  configs internas ocultas do cliente, logs sanitizados, Saúde expandida.
- **Busca nativa** — Harvest não depende mais do n8n para SerpAPI. Prospecta
  IA/n8n continua preservado separadamente.
- **3C** — resposta normal, `respondeu_em`, opt-out explícito,
  `conta_supressao`, histórico, tentativa pós-opt-out bloqueada. Teste real
  concluído: mensagem → resposta → SAIR → supressão → nova tentativa
  bloqueada.
- **Prontidão operacional** — pesquisa ≠ campanha, criação explícita de
  campanha, mensagem fixa/rodízio/IA, cadência, canais, métricas, Saúde,
  light/dark, correção WAHA LID, correção de hidratação `/chamados`, Next
  15.5.23.
- **Campanhas/Leads CRUD** (branch `feature/campanhas-leads-crud`, commit
  `88375ab`, ainda não promovida) — ver seção 7.

Ressalvas conhecidas: scheduler automático server-side ainda não existe;
progresso durável completo (server-side) ainda não existe; integração
completa da continuidade via Chatwoot ainda pendente.

## 6. HOTFIX WAHA — estado na data deste documento

Durante onboarding real, o QR Code WAHA parou de aparecer.

**Causa raiz confirmada:** o refactor multicanal (commit `8858b6d`) trocou
o botão "Conectar número" para chamar só `criarCanal()` /
`POST /api/canais`, criando `whatsapp_canais` com status desconhecido sem
acionar WAHA. `conectarWaha()` e `wahaStatus` ficaram órfãos no componente
depois da remoção do JSX que os usava — código morto que parecia vivo. O
backend WAHA (`lib/waha.ts`, `getOrCreateSession`, `getQrCode`,
`/api/waha/session`) sempre esteve correto.

**Hotfix:** branch `hotfix/waha-qr-code`, commit `6bf2ceed4c125a3d0673f08da0c3bf1465787cf1`.
- botão Conectar por canal WAHA;
- painel de conexão automático com erro legível (sem falha silenciosa);
- máquina de estados: Não conectado / Gerando QR / Aguardando leitura /
  Conectando / Conectado / Erro;
- botão Atualizar QR;
- polling com teto de tentativas;
- `router.refresh()` após conexão confirmada.

Também corrige, no mesmo commit, o **P1**: `dispararSelecionados()` marcava
`disparo='sim'` para todo lead processado independente do retorno real da
API. Agora classifica `enviado`/`bloqueado`/`erro` pelo retorno real de
`/api/disparo` e chama `router.refresh()` ao final para sincronizar o funil.

**Status de QA (2026-08-14, sessão Claude Cowork):**
- Deploy staging confirmado READY no commit exato, branch correta, sem
  vazamento de config de produção. Build logs limpos (Vercel e local).
- Suite completa de testes (incluindo os 8 cenários novos de
  `tests/waha-qr.test.js`), `tsc --noEmit` e `npm run build` — todos limpos.
- Revisão de código confirma a correção do P1 e a copy de opt-out (bloqueio
  automático e definitivo, não recomendação manual).
- **Não executado**: QA visual autenticada (login como `Figueira QA` — um
  agente de código não deve digitar credenciais de autenticação, mesmo de
  conta fictícia de staging), os 6 estados WAHA ao vivo, escaneamento real
  de QR com telefone autorizado, integração canal×campanha ao vivo, disparo
  controlado real. Essas etapas dependem de uma pessoa executando
  manualmente no navegador com a conta QA e, no caso do escaneamento, um
  telefone físico autorizado.

**Veredito: NÃO PROMOVIDO para produção.** Falta a QA manual/visual acima —
não há suspeita técnica no código, apenas o gate de QA interativa ainda não
foi fechado por um humano ou por um agente com navegador+credenciais
autorizadas.

Próximo gate, em ordem:
1. login no staging como `Figueira QA`;
2. Configurações → WhatsApp;
3. criar canal WAHA de teste;
4. clicar Conectar;
5. QR aparecer;
6. escanear com telefone controlado/autorizado;
7. status vira Conectado;
8. reload mantém a conexão;
9. canal aparece corretamente na seleção de campanha;
10. teste controlado de envio (1-2 leads, nunca massa) e progresso.

Depois, se tudo passar, promover o commit do hotfix para produção — sempre
com aprovação explícita de Guilherme antes do merge em `main`.

## 7. Feature Campanhas/Leads CRUD

Branch preservada: `origin/feature/campanhas-leads-crud`, commit `88375ab`.

Estado reportado: visualizar campanha, editar campanha, arquivar (nunca
excluir por padrão — regra institucional), adicionar/remover leads, editar
lead, editar telefone com regra crítica de normalização/duplicidade/
supressão, proteção de opt-out, métricas disjuntas (enviadas ≠ contatados),
modal institucional padronizado. QA automatizado (testes/tsc/build) passou.
QA visual autenticado em staging ainda não fechado — mesma limitação
descrita na seção 6 (agente de código não digita credenciais).

**Não perder essa branch. Não reimplementar do zero sem comparar com o que
já existe nela.**

## 8. UX / copy pendentes e prioridades vigentes

1. fechar hotfix WAHA (QA manual/visual);
2. concluir/revisar Campanhas/Leads;
3. humanizar copy onde ainda estiver artificial;
4. scheduler server-side;
5. progresso durável (server-side);
6. continuidade via Chatwoot.

Copy: PT-BR natural, humano, direto, profissional, sem excesso de
travessões, sem jargão de IA. Tema: `Dia`/`Noite` (não "claro/escuro").
Identidade: vermelho `#C4191F`, preto, branco, cinzas, verde só quando
adequado, evitar azul, Montserrat em títulos, Inter no corpo.

## 9. Scheduler e progresso durável (pendências arquiteturais)

**Scheduler:** precisa ser server-side/durável — timezone, persistência,
idempotência, recuperação após restart, sem dupla execução, respeitando
supressão/canal/cadência/logs, com estados
rascunho/agendada/em execução/pausada/concluída/cancelada. Não usar
React/localStorage/browser scheduler nem n8n como atalho para lógica core.

**Progresso durável:** persistir server-side total, elegíveis, processados,
enviados, respondidos, opt-outs, bloqueados, erros, timestamps e estado.
Fechar/reabrir a aba não pode perder a verdade operacional.

## 10. Continuidade de conversas (pendente)

Arquitetura alvo: campanha → inbound → Chatwoot → IA quando permitido →
operador humano → Twenty quando qualificado. Chatwoot continua fonte da
verdade — não criar inbox paralelo dentro do Harvest.

## 11. n8n / Prospecta IA

Decisão vigente: **não remover**. Harvest é o core nativo; Prospecta IA/n8n
é implementação independente e possível oferta de entrada separada. n8n
continua para automações, integrações e workflows específicos de cliente.

## 12. Regras de Git para um agente novo

Antes de editar qualquer coisa:
```
git status
git branch --show-current
git log --oneline --decorate -30
git branch -a
```

Mapeie pelo menos `main`, `hotfix/waha-qr-code`,
`feature/campanhas-leads-crud`, `docs/remote-agent-onboarding`.

- Não usar `git reset --hard` nem `git clean` destrutivo.
- Não sobrescrever branches existentes.
- Se for implementar algo, criar branch própria a partir do ponto correto
  (normalmente `main`, a não ser que a tarefa dependa explicitamente de uma
  branch em andamento — nesse caso, confirmar com Guilherme antes).
- Nunca editar a mesma branch simultaneamente com outro agente
  (Claude/Gemini/Manus). Se não tiver certeza de quem está com uma branch,
  pergunte antes de commitar nela.

## 13. Primeira tarefa recomendada para um agente novo

**Não implementar nada ainda.** Primeiro:
1. ler `docs/README_GOVERNANCA.md`;
2. ler `docs/PLANO_MESTRE_HARVEST.md`;
3. ler `docs/RELATORIO_ENTREGAS.md` (pelo menos as entregas mais recentes);
4. auditar Git (comandos da seção 12);
5. auditar branches, especialmente `hotfix/waha-qr-code` e
   `feature/campanhas-leads-crud`;
6. verificar o estado do deploy de staging via Vercel (se tiver acesso);
7. comparar este handoff com o código real — se algo divergir, o código e o
   Git real vencem, este documento é um snapshot;
8. entregar um relatório de entendimento antes de tocar em qualquer coisa.

Formato sugerido: `STATUS ONBOARDING — HARVEST`, com seções Estado
produção / Estado staging / Branches / Hotfix WAHA / Campanhas-Leads /
Arquitetura / Pendências / Divergências encontradas / Riscos / Próxima
tarefa recomendada.

Não alterar código nessa primeira execução. Não fazer deploy. Não mudar
banco. Não mudar Vercel. Não mudar VPS. Não mudar n8n. Não expor secrets.

## 14. Princípio operacional entre agentes

O objetivo não é ter vários agentes mudando o mesmo sistema ao mesmo tempo.

Modelo de referência:
- GPT: orquestra/decide;
- Claude Cowork: executor principal atual;
- Manus: auditor/QA ou executor em tarefa/branch isolada;
- Gemini: auditoria/backup quando necessário.

Nunca dois agentes escrevendo simultaneamente nos mesmos arquivos/branch.
