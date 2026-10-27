# Continuidade da paridade DeskcommCRM — estado verificável

## Base de referência

- Código local: `~/projects/DeskcommCRM`, commit `f13d26f6b00d65730f101e92fac50e3205b97211`.
- Inventário canônico atualizado: `docs/deskcomm-paridade-harvest.md`.
- Licença: `THIRD_PARTY_NOTICES.md` e cópia empacotada em `app/THIRD_PARTY_NOTICES.md`.

## Entregas integradas nesta rodada

| PR | Commit em main | Entrega | Deploy |
|---|---|---|---|
| #41 | `48888fd` | Catálogo com busca servidor, paginação e filtro de estado | `40592089743` aprovado |
| #42 | `226cf62` | Atendimento social + negócio + contato + timeline; Instagram sem telefone | `40594297761` aprovado |
| #43 | `9471c63` | Tarefas pela Inbox e agenda de atividades; código de fuso Deskcomm adaptado | `40596128587` aprovado |

Imagem final: `ghcr.io/tuco-gui/harvest-ai@sha256:41d4159084e24b1e2211b301557b117cd81fbe787867f117b1cfff4fdc2049ce`.

## Prioridade #26 verificada

- Conversa social já tinha vínculo explícito; o defeito era a ficha ler apenas WhatsApp.
- Históricos da ficha e Inbox agora usam a mesma conversa e as mesmas regras de envio.
- Negócio #26 e atendimento compartilham contato #11, sem cadastro de empresa vinculado.
- Três conversas sociais históricas receberam contatos por identidade; nomes e mensagens foram preservados.
- SQL 051 aplicada após backup e regressão transacional com ROLLBACK. Backup, hash e reversão detalhados no inventário.
- Playwright autenticado passou em local e produção. Envio Instagram interceptado: a confirmação de entrega real do provedor não foi exercitada.
- QA criou e removeu sua própria tarefa na jornada Inbox→agenda. Consulta final confirmou zero registros QA restantes.

## Escopo efetivamente validado

41 arquivos unitários, TypeScript, build, gates GitHub e smoke `/entrar` 200. A regressão PostgreSQL cobriu ausência de inbound, contato sem telefone/empresa, idempotência, configuração de criação e isolamento. A jornada de navegador cobriu histórico, composer, navegação, vínculo de tarefa, grade e fuso.

## A missão ainda não está concluída

O inventário registra as lacunas de paridade por código-fonte: mídia/reações/citações e demandas na Inbox, capacidades avançadas de funis, agenda de reservas/serviços/Google/Meet, motor completo de agentes e automações, relatórios/custos, propostas/financeiro, LGPD, extensões e integrações adicionais. Não confundir as entregas acima com clonagem funcional integral concluída.

Prospecção, campanhas, workspaces, clientes, banco e integrações existentes foram mantidos. O `opencode.json` encontrado inicialmente continua não rastreado e fora dos commits.
