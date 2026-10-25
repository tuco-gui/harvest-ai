# Piloto Harvest + DeskcommCRM (isolado e reversível)

O objetivo desta pasta é preparar a **nova base Harvest** sem afetar o `harvest-ai` atual. **Status: pré-flight/documentação; NÃO instalado ou validado.**

## Fonte e licença
`vendor/deskcommcrm` aponta à revisão `40db3470...` do DeskcommCRM, copyright 2026 Rafael Melgaço, licença MIT. Preservar `vendor/deskcommcrm/LICENSE` nos produtos derivados. O código licenciado é backend/base, mas a marca e a operação comercial serão Harvest/Figueira.

## Preparação (sem despliegue)
```bash
git clone --recurse-submodules https://github.com/tuco-gui/harvest-ai.git
cd harvest-ai
git checkout feature/harvest-deskcomm-pilot-20261024
git submodule update --init --recursive
bash piloto/deskcomm/preparar.sh
bash piloto/deskcomm/preflight.sh
```
`preparar.sh` **não instala pacotes, não configura servidor, não baixa segredos, não inicia contêineres e não modifica serviços**. Ele cria, se necessário, o `.env` não versionado dentro do submódulo com placeholders e marca Harvest. O `preflight.sh` recusa atestar prontidão se faltam banco e canal próprios de QA.

## Obrigatório antes da primeira inicialização
- [ ] VPS ou ambiente de teste medido com memória/disk suficientes; não adicionar novas cargas na VPS de produção sobrecarregada sem aprovação.
- [ ] Banco/Storage/Auth Supabase próprios do Deskcomm piloto (nunca o schema do Harvest atual).
- [ ] WAHA/Meta de QA próprios ou simulação; número de cliente real proibido antes da homologação.
- [ ] Chaves provisionadas pelo cofre institucional, somente runtime; nenhum arquivo .env com segredo no Git.
- [ ] Redis, workers e scheduler isolados conforme upstream.
- [ ] Endpoints/domínios próprios em HTTPS, nunca `harvest.figueiramarketing.com.br`.
- [ ] Testes: RLS, upload FAQ/PDF, indexação, sandbox IA, publicação, inbox real QA, handoff, funil.
- [ ] Snapshot do legado, contagem de registros e plano de rollback.
- [ ] Aprovação para tráfego e publicação.

## Documentos vinculados
- `docs/decisoes/ADR-010-harvest-deskcomm-piloto.md` — arquitetura/portões.
- `docs/brain-sync/2026-10-24-harvest-deskcomm.md` — registro para Brain/Wiki Obsidian.
- `docs/PLANO_MESTRE_HARVEST.md` e `docs/RELATORIO_ENTREGAS.md` — preservar integralmente.

## Arquitetura alvo
```
             HARVEST (UX/marca Figueira)
                        |
          DeskcommCRM: inbox + CRM + IA/RAG
                /                 \
      WAHA de QA isolado     Supabase piloto isolado
                 + workers/scheduler
```
O Harvest atual, Twenty/Chatwoot, n8n, WAHA/Evolution e bancos de produção continuam funcionando sem alteração.

## Limites do preparo
O submódulo, os arquivos e os scripts constituem **fonte versionada e checklist**, não instalação funcional nem prova de teste; não anunciar piloto pronto antes de executar E2E.

## Ponte mínima implementada no Harvest

A branch também contém uma consulta REST **somente leitura** ao Deskcomm, em `GET /api/piloto/deskcomm/saude`. A rota está fechada por padrão; só atende superadmin da conta QA em staging, com um token de leitura de um tenant QA separado. Configuração em `harvest-adapter.env.example`. Não substituir por um token de produção nem informar dados de clientes reais. A chamada de sucesso retorna contagem de agentes; não dispara nenhum WhatsApp.

**Essa ponte não significa instalação do Deskcomm.** Primeiro é obrigatório disponibilizar a nova aplicação isolada com banco/worker e configurar as credenciais no cofre de staging.
