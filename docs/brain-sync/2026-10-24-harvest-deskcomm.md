# Wiki / Brain — Harvest AI — decisão e estado do piloto Deskcomm
**Data:** 2026-10-24
**Escopo:** INSTITUCIONAL — Figueira Marketing / Harvest AI
**Classificação:** atualização de projeto, **não** substituir Manifesto, Constituição, ADR-007 ou decisões históricas.
**Fonte operacional versionada:** `https://github.com/tuco-gui/harvest-ai/tree/feature/harvest-deskcomm-pilot-20261024`
**ADR:** `docs/decisoes/ADR-010-harvest-deskcomm-piloto.md`

## Objetivo de produto
Harvest é CRM SaaS com marca proprietária Figueira: prospecção (Maps/SerpAPI), enriquecimento, campanhas, disparos seguros, gestão de funis e contatos, inbox WhatsApp e cadastro rápido de agentes IA replicáveis por cliente (atendimento, BDR, vendas, suporte, financeiro). O agente deve receber materiais (FAQ, PDF, texto), testar antes de publicar, operar no número autorizado e transferir para pessoa real. n8n opcional para integrações especiais, não obrigação de cada agente.

## Histórico preservado
- ADR-002: não reimplantar sem necessidade CRM/inbox/automação; histórico.
- ADR-007: Harvest UX + Twenty CRM + Chatwoot + WAHA/Evolution + Supabase + n8n opcional; **continua vigente em produção enquanto novo núcleo não é aprovado**.
- Documentação histórica Harvest e relatórios cumulativos importados da branch `docs/remote-agent-onboarding` para a branch de piloto; nenhuma entrega antiga foi apagada.
- Sistema em execução no Swarm institucional: Harvest, Twenty, Chatwoot, WAHA, Evolution, Supabase/Redis, entre outros. Nenhum serviço do legado alterado pela avaliação.

## Nova direção aprovada
O DeskcommCRM MIT (revisão `40db34708049e52304d159b7a6f1829bfde23358`) foi vinculado via submódulo ao `harvest-ai` em `vendor/deskcommcrm`. Está em avaliação como núcleo próprio do Harvest (inbox + CRM + IA/RAG + agentes + roteadores), preservando recursos exclusivos do Harvest. **Não foi instalado ou validado funcionalmente nesta etapa.**
Não incorporar código do Kommo Clone sem licença/autorizações claras. DG-Claw/OpenClaw poderão ser providers opcionais após MVP testado.

## Critérios de entrega
1. Base de teste isolada com conta Figueira QA, sem conexão a dados/números de clientes.
2. Agente de teste cadastrado com modelo, fontes, prompt, teste sandbox e publicação revisada.
3. WhatsApp QA recebe, responde e entrega histórico íntegro, opt-out e passagem para humano.
4. Atualização de contatos e funil; isolamento entre tenants e logs auditáveis.
5. Campanhas/disparos que já existem no Harvest preservados e portados somente após reconciliação.
6. Documentar cada resultado de teste, rollback, segurança, custos e aprovação antes da promoção.

## Política para novos agentes de código
Em toda alteração: auditar código/infra atuais → atualizar ADR/Plano Mestre/Relatório/este registro → preservar dados, commits, backups e segredos → testar em branch e staging isolado → QA → pedir aprovação para deploy em produção. Não copiar o Brain completo para GitHub. Não apagar arquivos antigos, apenas acrescentar registro datado.

## Situação da sincronização
Este arquivo foi versionado no repositório operacional e serve como conteúdo para a **Wiki do Obsidian**. O Brain canônico fica em `/Users/gui_t/Figueira_Marketing/brain` e não está montado nesta sessão; portanto **NÃO afirmar que a cópia do Mac foi atualizada**. `scripts/sync-brain-wiki-harvest.sh` prepara a cópia aditiva para o Vault local, sem sobrescrever arquivos antigos.
