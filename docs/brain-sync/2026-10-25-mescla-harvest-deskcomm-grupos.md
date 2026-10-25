# Harvest CRM — unificação modular da experiência Deskcomm/Kommo

Data: 25/10/2026. Este documento é um **registro aditivo no GitHub**, não uma alegação de sincronização do Brain/Wiki do Mac.

## Decisão
- Harvest continua o **produto proprietário principal**, com banco e autenticação atuais.
- Reutilizar módulos funcionais e padrões permitidos do DeskcommCRM (MIT, licença mantida no projeto original) para concentrar CRM, mensageria e agente de IA numa única experiência.
- Kommo serve como referência funcional de interface; **não copiar código proprietário** nem UI Kit de licença restritiva.
- Chatwoot e Twenty permanecem intactos, porém não são pré-requisitos de navegação da nova ficha comercial. Não iniciar novas dependências de integração Chatwoot.
- Trabalho restrito ao módulo `crm_avancado`, hoje habilitado apenas na workspace Figueira Marketing. **Não usar staging independente**.

## Estado comprovado no repositório Harvest
- Já existem Inbox CRM, contatos derivados de oportunidades, cadastros independentes de contatos, empresas/produtos, tarefas, oportunidades, histórico e handoff opcional com Chatwoot.
- Etiquetas possuem catálogo com cores, múltipla seleção e exclusão administrativa, mas a ficha do negócio usava campo livre separado por vírgulas.
- Campos personalizados existem para contato, empresa e oportunidade, mas não ofereciam grupos para reproduzir abas comerciais.

## Implementação nesta branch
1. Ficha de oportunidade passa a reutilizar o catálogo de etiquetas coloridas e seleção múltipla, com limite de 20 etiquetas (mantém 8 na Inbox).
2. **Proteção de workspace**: clientes sem `crm_avancado` continuam usando o formulário legado e não acessam APIs novas.
3. Gerenciador passa a poder funcionar dentro de outros formulários, sem <form> aninhado.
4. Definições de campos ganham `grupo` configurável; campo antigo permanece no grupo `Principal`, sem regravar valores.
5. Exibição agrupada nos cadastros de contato/empresa e nos negócios; administração pode criar e mover campos de grupo.
6. Migração `040` aditiva: coluna `grupo` e exclusão de etiqueta do catálogo remove seu vínculo tanto de atendimentos quanto de oportunidades da **mesma conta**.
7. Testes unitários ampliados para grupo e validações de entrada.

## Dependência de implantação
- **Obrigatório:** aplicar `sql/040_crm_grupos_etiquetas_oportunidades.sql` ao banco de produção do Harvest **antes** de atualizar a imagem, pois as novas consultas selecionam `grupo`.
- Rodar TypeScript, testes unitários e build; inspecionar mudança antes do merge.
- Validar autenticação como superadmin, criar etiqueta/atribuir várias, trocar cor, mudar grupo, salvar oportunidade/contato e consultar histórico na Figueira Marketing.
- Confirmar que usuário de outra workspace não acessa `crm_avancado`.
- Conservar rollback da imagem e documentação. Sem envios WhatsApp/IA provocados por esta migração.

## Próxima evolução após homologação
- Ficha realmente unificada: contato cadastrado como entidade canônica, empresas e negócios N:N, histórico/atribuições/etiquetas compartilhados sem contatos duplicados.
- Agentes de IA por template e base de conhecimento usando componentes Deskcomm, com teste antes de publicar e handoff independente de Chatwoot.
- Migração gradual com métricas e validação de integração; nenhuma troca de motor ou apagamento em lote.

## Implantação realizada em produção — 25/10/2026
- CI do PR #20: [execução 40214437064](https://github.com/tuco-gui/harvest-ai/actions/runs/40214437064), todos os testes, TypeScript e build concluídos com sucesso.
- Migração `sql/040_crm_grupos_etiquetas_oportunidades.sql` aplicada em transação ao PostgreSQL self-hosted do Harvest usando papel proprietário autorizado `supabase_admin`. Verificação confirmou coluna `grupo` e atualização de `crm_excluir_etiqueta`. Primeira tentativa com papel `postgres` sem propriedade falhou e não persistiu nenhuma mudança; tentativa autorizada seguinte terminou com COMMIT, exit 0.
- Apenas Figueira Marketing usa `crm_avancado`. Auditoria de workspaces de clientes com esse módulo: **0**.
- PR #20 mesclado por squash em `48f5513cd6db98bc0eab58aefb33f029584d98b7`.
- Construção da imagem GitHub Actions: [execução 40214937612](https://github.com/tuco-gui/harvest-ai/actions/runs/40214937612), sucesso.
- Docker Swarm `harvest_harvest` atualizado **somente na imagem**, mantendo `Env`, `Secrets`, `Networks` e o resto da especificação atual. Imagem: `ghcr.io/tuco-gui/harvest-ai:48f5513cd6db98bc0eab58aefb33f029584d98b7@sha256:22ee15555157ab56828f33a3e0ffc37500e85af1e99bb2a3ed9f4b8269cc9965`.
- Imagem anterior para rollback: `ghcr.io/tuco-gui/harvest-ai:latest@sha256:ca49165a50bf8cae6a9fec25a3f6121220c29a58ec4ef94aa951fbd2275a2a65`.
- O Portainer StackUpdate inicialmente devolveu conflito de nome de serviço existente; **não** modificou o serviço. Foi utilizado um contêiner temporário do Docker CLI para fazer `docker service update --image`, preservando as configurações do serviço. Contêiner de manutenção removido após a atualização.
- Swarm confirmou `UpdateStatus.State=completed`, tarefa nova `running`, nenhum erro e nenhum reinício.
- Smoke interno: `/entrar=200`; sem sessão, `/crm=307`, `/crm/campos-personalizados=307`, `/api/crm/etiquetas=307` para a página de login.
- **Ainda pendente:** QA funcional autenticado com a Figueira Marketing (criar etiqueta, associar ao negócio, mover campo de grupo e validar dados na ficha). Não afirmar que houve esse teste.
- Brain e Wiki locais do Mac **não** foram sincronizados diretamente; este arquivo registra a decisão e o resultado para a futura sincronização aditiva.
