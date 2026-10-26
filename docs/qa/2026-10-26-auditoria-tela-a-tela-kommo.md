# Auditoria tela a tela Harvest × gravação Kommo

Referência de usuário: gravação `Recording 2026-10-25 at 21-15-58.mp4`, 6m03s. Objetivo: comportamento e hierarquia visual equivalentes, sem reproduzir identidade visual proprietária, sem criar menus duplicados.

| Área | Verificação da gravação | Situação no código após PR | Risco/remanescente |
|---|---|---|---|
| Pipeline/Kanban | seleção de funil e ações no cabeçalho, colunas, cartão abre ficha | mantido menu, seletor, Kanban e lista; edição agora é inline na própria rota /crm | QA visual autenticado ainda necessário |
| Filtros | vistas, propriedades e etiquetas no mesmo painel 3 colunas | confirmado; fix para ganhos e perdidos aparecerem | E2E com dados reais pendente |
| Etiquetas | gerenciar catálogo/cores no filtro, só atribuir na ficha | catálogo na área de filtro e atribuição na ficha via seletor próprio | testar criação/exclusão com autenticação |
| Editor do funil | configurações no contexto do pipeline, não uma página extra | botão abre FunilDetalhe embutido na rota /crm; retorno alerta sobre alterações não salvas | salvar estágios pode retornar sucesso parcial se APIs individuais falharem |
| Fontes de lead | lista à esquerda das etapas e grade de conexão | lista clicável com número e estado; modal conecta canais operacionais via config atual | Instagram/Messenger/Webchat/Meta ainda sem backend |
| Etapas | editar, duplicar, arrastar, não apagar negócios | endpoints agora isolam workspace inclusive super-admin; exclusão bloqueada se etapa possui negócios | validação de reordenação concorrente com muitos editores pendente |
| Ficha do negócio | tela inteira; dados e campos à esquerda, conversa/atividade à direita | feita na revisão anterior; CSS específico não deve esconder editor de funil | verificação em iOS e desktop autenticados pendente |
| Contatos | uma única entrada no menu; não duplicar cadastros | /crm/contatos principal; /crm/cadastros/contatos redireciona; admin visualiza cadastros+pendentes | operador ainda recebe visão derivada de oportunidades em vez de cadastro único (evolução de permissão pendente) |
| Comunicação/Inbox | um canal por conversa e status/responsável próprios | /crm/atendimentos redireciona a /inbox; lista por telefone + canal, chave React composta | webhook real e envio de resposta não testados, nenhum disparo feito |
| Configurações canais | WAHA/Evolution já disponíveis, sem reconectar | listas e seleção reaproveitam endpoints originais; sem segredos frontend novos | outros provedores não implementados |
| Segurança e deploy | não afetar outras workspaces | GET/POST/PATCH/DELETE de etapas validam workspace ativa; nada no banco modificado nesta revisão | E2E logado necessário |
| Celular | layouts sem conteúdo cortado | criação de funil com flex-wrap, grade de fontes adaptável; ficha responsiva | screenshot real em iOS pendente |

## Erros encontrados e corrigidos
1. Vista "Leads ganhos" não ligava o modo de encerrados, gerando falso resultado vazio.
2. Cartões Inbox com mesmo número em canais diferentes tinham React key duplicada, podendo se misturar.
3. Editor do funil redirecionava à página isolada em vez de abrir dentro do pipeline.
4. CSS `.crm-kommo>div:first-child` esconderia qualquer editor embutido; substituído por seletor específico `.crm-kommo>.crm-legado-topo`.
5. API de estágios permitia super_admin acessar IDs fora da workspace ativa em GET/POST; PATCH/DELETE nem validavam a workspace do funil.
6. Exclusão de etapa com negócio vinculado agora retorna 409 e não apaga registros.
7. Fontes na lateral eram meras linhas não clicáveis; agora são botões com seleção e confirmação explícita para salvar.
8. Formulário para criar funil no celular não quebrava linha.
9. Drag-and-drop usava índice da coleção antiga (`estagios[from]`) em vez da ordem renderizada, deslocando etapas erradas em alguns movimentos; corrigido com `ordemVisual`.
10. IDs locais de novos estágios eram derivados de `Date.now()`, sujeitos a colisão em múltiplas adições rápidas; agora usa contador negativo único.
11. Salvamento usava `Promise.all` para várias atualizações da mesma fila de estágios. Substituído por exclusões verificadas, criação com confirmação de IDs reais e PATCH em sequência.
12. Backend misturava pipeline e encerrados no reordenamento (sem filtro de grupo); corrigidos POST, PATCH e DELETE para ordenar cada grupo isoladamente.
13. Após salvar canal do funil, botão podia continuar como "não salvo" pelo valor antigo nas props; corrigido usando canal persistido.
14. Teste de regressão agora cobra a ordenação visual, IDs negativos únicos e persistência sequencial.

## Evidências e limitações
- Teste de regressão `tests/unit/crm-ux-integridade.test.ts` garante posicionamento e isolamento.
- CI inclui testes anteriores de canais e funis, TypeScript e Next build. Nenhuma mensagem externa nem alteração SQL neste PR.
- Browser connector retornou erro de `originating browser context` na tentativa de ler aba do usuário, TinyFish não possui perfil autenticado salvo no domínio do Harvest; não afirmar que navegação/prints autenticados foram executados.
- Não se deve habilitar automações ou apagar dados de clientes para fins de teste.

## Homologação técnica e publicação — 26/10/2026 UTC
- PR [#28](https://github.com/tuco-gui/harvest-ai/pull/28) incorporado via squash `50f3ef552c7c3a5a2504ce44cbae4f9c4f4f5110`.
- GitHub Actions validação de tipos, testes, regressão de UX e Next.js build na branch: **success** (run `40255381773`). Build e publicação da imagem na main: **success** (run `40255537332`).
- Swarm `harvest_harvest` alterado **somente na imagem**; `UpdateStatus=completed`, task `running` sem erro; sem interferir no WAHA, Chatwoot, Supabase ou containers de clientes.
- Imagem implantada: `ghcr.io/tuco-gui/harvest-ai:50f3ef552c7c3a5a2504ce44cbae4f9c4f4f5110@sha256:f7113a136ac2beab417866f7e04246027598aa1b5f6dd01bc94841fd46554564`.
- Rollback de imagem: `ghcr.io/tuco-gui/harvest-ai:56dc16465a4a947f7f6bac7eb7b34718201ca801@sha256:409a5ab276997d589f0643eebe83e50c0699cf2f63f66736312ca92e608dd1b1`.
- Smoke HTTP no contêiner atualizado: `/entrar=200`; `/crm`, `/crm/contatos`, `/crm/atendimentos`, `/crm/campos-personalizados`, `/crm/cadastros/empresas`, `/crm/cadastros/produtos`, `/crm/tarefas`, `/funis`, `/funis/1`, `/inbox`, `/api/funis/1`, `/api/funis/1/estagios`, `/api/crm/atendimentos` retornaram `307 /entrar` sem sessão, conforme restrição de acesso. ExitCode 0.
- Contêiner de app `running`, RestartCount `0`. Contêiner helper Docker temporário removido.
- **Limitação documentada e não resolvida:** sem sessão autenticada no navegador integrado, não foi possível clicar e produzir screenshots reais de cada tela logada. Connector Browser exige `originating browser context`; perfil TinyFish conectado não tem login salvo em Harvest. O teste HTTP sem sessão verifica rota/proteção, não certifica layout pixel a pixel, responsividade nem operações de criação/edição.
- **Pontos ainda não certificados:** edição visual com sessão, contatos admin vs operador com dados reais, filtros/tags alterando registros reais, respostas WAHA/Evolution de verdade, conectores Meta Instagram/Messenger/Webchat/Google e compatibilidade real iOS. Não ativar automações nem mandar mensagens para fazer QA sem canal e destinatário controlados.
