# Correção visual — gravação Kommo 25/10/2026 às 21:15

Referência: vídeo do usuário `Recording 2026-10-25 at 21-15-58.mp4` (6m03s, 1914×954).

## O que o vídeo efetivamente mostra
- ~0–35 s: Kanban Kommo; funil selecionado no canto superior esquerdo, `Pesquisar e filtrar` abre painel sobreposto com vistas/salvos à esquerda, **propriedades do lead** ao centro, e **etiquetas coloridas com quantidades/gerenciar** à direita.
- ~40–60 s: contraste com Harvest anterior: cabeçalho alto, cinco grandes indicadores, linhas de filtros distintas e modal convencional. Hierarquia visual diferente.
- ~140–250 s: edição das etapas dentro do contexto de funil, painel esquerdo `Fontes de lead`, lista de canais conectados e botão `Adicionar fonte`. Grade flutuante dos canais WhatsApp, Instagram, Facebook, webchat, Telegram, etc. dentro desse fluxo.
- ~260–334 s: clique no lead exibe **ficha em tela cheia**, dados à esquerda, histórico de mensagens/atividades à direita, abas dos campos da ficha na coluna esquerda; itens como usuário responsável, etapa, valor, contato, empresa e adição de notas/atividades próximos da conversa.
- ~340s: área de chats e automações.

## Mudanças deste PR
1. CRM avançado: remove cabeçalho alto/indicadores que competem com Kanban, compacta controles e prioriza seleção de funil, busca/filtros e novo lead; workspaces legadas não mudam.
2. Filtros: mantém o gatilho `Buscar e filtrar` e organiza vistas de leads + propriedades + catálogo/contagens de etiquetas em três colunas como no vídeo.
3. Ficha de oportunidade: passa a ocupar a área de trabalho toda (não modal pequeno); esquerda com abas `Principal` / `Campos e produtos`, direita com `Conversa` / `Atividades` / `Histórico completo`. O formulário dinâmico que estava nas abas de conversação foi movido à coluna de dados.
4. Editor do funil: seção `Fontes de lead` fica **na lateral esquerda da configuração das etapas**, com status reais das conexões existentes e seletor de canal padrão. `Adicionar fonte` mostra grade similar à gravação. Só WAHA/Evolution têm ação concreta (`Configurações`); os demais aparecem como ainda não conectáveis, sem falsa integração.
5. Não mexe em SQL, credenciais, webhooks, mensagens, funis existentes, etiquetas, automações ou dados. Nenhuma mensagem externa é enviada.

## Limites
- Não é uma cópia pixel-perfect; a referência é a hierarquia de interação e a colocação dos controles demonstrada no vídeo. Brandbook Harvest/Figueira permanece, sem copiar identidade visual proprietária Kommo.
- Nomes dos grupos configuráveis `Tipo Produto`, `Ambiente`, etc. dependem de dados dos campos personalizados por workspace; ficam acessíveis em `Campos e produtos`, não serão inventados.
- Ações Instagram/Messenger/webchat continuam pendentes de conectores reais. Criação automática de negócios permanece desativada até autorização na interface.
- QA autenticado visual/manual do layout precisa ser conferido após deploy, inclusive em mobile e com um lead real.

## Implantação verificada — 25/10/2026
- PR [#27](https://github.com/tuco-gui/harvest-ai/pull/27) integrado via squash `56dc16465a4a947f7f6bac7eb7b34718201ca801`; CI TypeScript/testes/Next build aprovado na branch.
- Workflow de imagem `40252836611`: construção e publicação GHCR `success`.
- Serviço `harvest_harvest` atualizado APENAS na imagem: `update completed` e tarefa `running`, sem erros.
- Imagem nova: `ghcr.io/tuco-gui/harvest-ai:56dc16465a4a947f7f6bac7eb7b34718201ca801@sha256:409a5ab276997d589f0643eebe83e50c0699cf2f63f66736312ca92e608dd1b1`.
- Rollback: `ghcr.io/tuco-gui/harvest-ai:fe83f4b4c12eb377341c3475980e184a8ca263d3@sha256:46add181c3627fabd332ae0f4a1dd298c887a1967732e3286bb992bff7226c89`.
- HTTP smoke dentro do contêiner: `/entrar=200`; `/crm,/funis,/inbox,/api/funis=307 → /entrar` sem sessão; ExitCode 0; contêiner `running`, RestartCount 0.
- Contêiner temporário do update removido. Não houve mudanças de banco, tokens, volumes ou serviços WAHA/Chatwoot.
- **Atenção: QA visual autenticado comparando lado a lado com o vídeo ainda pendente.** CI e smoke provam build/serviço, não fidelidade visual ou que todos os cliques foram homologados no navegador.
