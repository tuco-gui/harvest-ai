# Criação opcional de negócios na primeira mensagem recebida

Objetivo: aproximar Harvest da automação por funil do Kommo, sem enviar mensagens nem criar negócios automaticamente para clientes sem configuração.

## Comportamento
- Novo atributo `funis.auto_criar_negocio_inbound` inicia **false para todos os funis**, incluindo Figueira Marketing.
- Admin da workspace com CRM avançado encontra **Ativar criação automática** dentro da edição do próprio funil; precisa de canal exclusivo/conectado e confirmação.
- A API não permite ativar em canal compartilhado com outro funil ativo, canal desconectado ou workspace sem `crm_avancado`.
- Só eventos **novos**, autenticados, com identidade de canal conhecida, funil único e classificação `resposta` em mensagem de texto, passam pelo código.
- PostgreSQL reforça flag, módulo, canal e exclusividade do funil; a RPC com `SECURITY DEFINER` não permite execução pelo navegador e usa lock transacional por `workspace+canal+telefone`.
- Se já há vínculo retorna oportunidade existente; se já há oportunidade com mesmo telefone/funil não cria outra e pede revisão humana; se houve mensagem anterior na conversa, também não cria. Não há backfill.
- Cria com primeiro estágio real do funil e sem responsável automático. Não envia mensagem, não altera consentimento, não desconecta WAHA, não move fases de outros negócios.
- Opt-out, resposta negativa, mídia e mensagens enviadas pelo próprio Harvest nunca acionam criação automática.

## Arquivos
- `sql/044_negocio_inbound_optin.sql`
- `app/src/lib/crmNegocioAutomatico.ts`
- `app/src/lib/inbound.ts`
- `app/src/componentes/FunilDetalhe.tsx`
- `app/src/app/api/funis/[id]/route.ts`
- `tests/unit/crm-inbound-autocriacao.test.ts`

## Critérios de publicação
1. CI TypeScript e build validado.
2. Migração 044 aplicada e flag falsa em 100% dos funis (zero negócios novos, zero alterações de canais).
3. Nova imagem apenas `harvest_harvest`, com rollback preservado e smoke HTTP anônimo.
4. A função exige homologação autenticada e webhook real para habilitar numa workspace.
5. Não inferir conclusão de ativação: sem ação de administrador na interface, permanece desligado.

## Publicação em produção — 25/10/2026
- PR [#26](https://github.com/tuco-gui/harvest-ai/pull/26) incorporado em `main`, SHA `fe83f4b4c12eb377341c3475980e184a8ca263d3`.
- CI da branch validou testes opt-in, tipagem TypeScript, Next build. Build da imagem na main (workflow 40245007229) **success**.
- Primeira tentativa de SQL 044 rejeitada por delimitador de função; transação desfeita sem alterações. Delimitador corrigido e execução final **COMMIT, exit 0**.
- Verificações após a migração: `funis=7`, `auto_criar_negocio_inbound=true:0`, `crm_vinculos_inbound_negocio=0`, `oportunidades=10`, `inbound_eventos=6072`; trigger tenant, RLS e ambas as rotinas criadas.
- Docker Swarm service `harvest_harvest` atualizada só a imagem, `update completed`, tarefa `running` sem erros, contêiner com `RestartCount=0`.
- Imagem implantada: `ghcr.io/tuco-gui/harvest-ai:fe83f4b4c12eb377341c3475980e184a8ca263d3@sha256:46add181c3627fabd332ae0f4a1dd298c887a1967732e3286bb992bff7226c89`.
- Rollback preservado: `ghcr.io/tuco-gui/harvest-ai:7c51117e95a49203795edb57b0145f1ca8a93db1@sha256:94742b5966691a74bbd4e1b8e81ac15fff8838fbbaf416139f504cf43b536f14`.
- Smoke interno: `/entrar 200`; `/inbox,/crm,/funis,/api/funis,/api/crm/atendimentos -> 307 /entrar`. Helper Docker CLI removido após deploy.
- Releitura do banco **após deploy**: todos os sete funis ainda com auto-off, zero vínculos criados, 6072 inbound e zero atendimentos por canal (só passarão a surgir com tráfego novo).
- Aba autenticada do usuário exibiu `/funis` com opções de WhatsApp. A workspace Figueira Marketing mostra somente o canal `Teste` (WAHA) `desconectado` naquele registro; a ativação da nova automação requer canal conectado e exclusivo.
- Pendência de QA: não há teste autenticado da nova chave liga/desliga nem webhook real de canal conectado na workspace. Sem criar mensagens nem ativar fluxos por conta própria.
