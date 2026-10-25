# ADR-010 — Avaliação DeskcommCRM como novo núcleo do Harvest
**Data:** 2026-10-24
**Escopo:** INSTITUCIONAL — Harvest AI / Figueira Marketing
**Decisão autorizada:** preparar piloto técnico isolado, preservar todo o legado e obter evidência antes de migrar.
**Estado:** PILOTO EM PREPARAÇÃO — não promover arquitetura a produção automaticamente.

## Contexto e precedência
O Harvest deve ser **produto proprietário e interface própria da Figueira**: prospecção por mapas, enriquecimento, campanhas, disparos controlados, CRM, WhatsApp e agentes clonáveis por cliente (atendimento, BDR, vendas, suporte e financeiro). O administrador deve poder criar conta, selecionar um template de agente, anexar materiais, testar em sandbox, conectar número autorizado e publicar com segurança, sem reconstruir n8n a cada venda.

**ADR-002 (BUILD vs REUSE, histórico)** aconselhava não reimplementar motores existentes. **ADR-007 (vigente em produção)** definiu Harvest UX + Twenty (CRM) + Chatwoot (inbox) + WAHA/Evolution (transporte) + Supabase + n8n opcional. **ADR-010 não apaga nem substitui ADR-002/007**. Autoriza avaliar substituição gradual do conjunto de motores por Deskcomm, após prova isolada. Até aprovação pós-QA, ADR-007 segue em produção.

## Candidatos verificados
- **DeskcommCRM**: https://github.com/melgarafael/DeskcommCRM — MIT (Copyright © 2026 Rafael Melgaço). Revisão pinada: `40db34708049e52304d159b7a6f1829bfde23358`.
- Implementações localizadas: Next.js 16, TypeScript, Supabase (Postgres/Auth/Storage), WAHA, worker de turnos, RAG/indexação assíncrona (FAQ/PDF/MD/TXT), agentes versionados por organização, roteadores por intenção, sandbox, transferência humana, follow-ups e funil, controle de habilidades e modelos de IA, prospecção nativa. Implementação verificada por leitura dos arquivos, **não testada em execução pelo Harvest**.
- **Kommo Clone**: https://github.com/davidmaiky/kommo-clone-crm — pequeno React/Vite + Express/SQLite/Baileys; útil apenas como referência de UX. Nenhuma licença explícita foi localizada e não será copiado sem permissão; API sem middleware de autenticação identificado.

## Direção escolhida
Construir **Harvest próprio com núcleo Deskcomm** em ambiente isolado, mantendo a operação atual.
- Aproveitar primeiro autenticação, inbox, agentes, roteadores, RAG, handoff humano, funil e automações do Deskcomm.
- Portar ao novo núcleo apenas capacidades Harvest que forem únicas/superiores: campanhas e disparo com supressão, busca SerpAPI/Maps, enriquecimento, qualificação, controle de custo/roles, relatórios e experiência de agência.
- **Nunca apontar o mesmo número WhatsApp simultaneamente a dois controladores** ou duas rotas concorrentes de webhook; nos testes, usar número/sessão separados e whitelist.
- **Uma empresa por tenant**, com isolamento RLS e identidades próprias; credenciais por empresa em cofre, não Git, não logs, não prompts. Transferência de credenciais requer inventário e fluxo aprovado, sem rotação silenciosa.
- DG-Claw/OpenClaw/9Router **não são requisitos do MVP**; integrar como provider opcional somente depois do agente nativo passar no teste real e sem criar segundo controlador de WhatsApp.

## O que deve ser preservado integralmente
1. Repositório `tuco-gui/harvest-ai`, branch `main` e todas as branches/commits.
2. Produção `harvest_harvest`, Twenty, Chatwoot, Sidekiq, WAHA, Evolution, Supabase/Postgres, Redis, Traefik e volumes.
3. Staging `harvest-staging` (Vercel), staging banco de dados e conta Figueira QA, sem reaproveitar tabelas do novo núcleo.
4. Todos os registros de prospecção, campanhas, leads, disparos, opt-outs, atendimentos, funis, templates, relatórios e históricos. Nunca apagar nem migrar parcialmente sem contagem e reconciliação.
5. Segredos existentes em OpenBao/ambientes/cofres; **não ler, copiar, divulgar ou recriar credenciais** durante a fase documental.
6. Histórico de decisões e Entregas, Brain e Wiki Obsidian. O Brain continua canônico no Mac e NÃO é replicado integralmente em Git público.
7. Projetos externos, incluindo Prospecta IA/n8n e `crm-chat`, não devem ser apagados. A integração anterior no `crm-chat` é referência, não implantação do Harvest.

## Portões (nenhuma promoção automática)
1. **Pré-flight**: ambiente de piloto isolado, banco novo, volumes novos, subdomínio diferente de produção, recursos/memória aprovados.
2. **Stack**: Next, Supabase DB/Auth/Storage, Redis, WAHA, worker e scheduler iniciam e passam health check.
3. **Agente**: criar tenant, prompt/template BDR, FAQ/PDF, indexação pronta, teste em sandbox, publicar com aprovação.
4. **Canal real QA**: receber mensagem, responder, deduplicação, limite de envio, opt-out, handoff para humano, histórico completo.
5. **CRM**: contato/leads/etapas, tenant A sem acesso a tenant B, atualização de funil e auditoria.
6. **Harvest específico**: busca → campanha → disparo controlado → resposta → qualificação → negócio, sem perda de dados.
7. **Segurança e rollback**: backup e restauração comprovados, métricas, custos, LGPD, sem segredos no build, rollback sem exclusão.
8. **Aprovação final explícita do responsável** antes de publicar ou migrar cliente.

## Vínculo de código
O Deskcomm consta em `vendor/deskcommcrm` como **submódulo Git fixado**, não cópia total nem produto instalado. Ao fazer `git submodule update --init --recursive` obtém-se a versão de análise. O pacote de implantação está em `piloto/deskcomm`. Não alterar submódulo upstream diretamente em `main`.

## Riscos conhecidos
- Next.js 16 do Deskcomm vs Next.js 15 do Harvest atual: a unificação do runtime NÃO é troca direta de diretórios.
- Deskcomm possui esquema Supabase próprio: **jamais executar suas migrations no Supabase existente do Harvest**.
- Adapters Harvest atuais têm integrações parcials Twenty/Chatwoot e a QA do fluxo real precisa validação independente; preservar como rollback, não alegar funcionamento E2E sem provas.
- Documentação de skill do Deskcomm reconhece que onboarding de agentes por nicho tem várias telas após o wizard; atingir um único cadastro de agente é requisito UX da Figueira, não afirmar que já é um clique.
- Não misturar BAILEYS de terceiro com WAHA que opera os números atuais.

## Resultado desta rodada
Documentação e submódulo prontos em branch de piloto. **Não existe ainda instância nova operacional**: faltam ambiente isolado e testes. Nenhum deploy de produção nem dados/segredos alterados. 
