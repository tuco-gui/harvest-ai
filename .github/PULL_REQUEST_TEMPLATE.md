## Descrição e escopo
<!-- Estado antes → depois; branch, commit, serviço, tenant afetado -->

## Preservação
- [ ] Nada foi excluído/substituído; diffs e banco conferidos.
- [ ] Sem segredos, .env, chaves privadas, tokens, dados pessoais nos commits/logs.
- [ ] Sem alterações em produção, domínio real ou número de cliente (salvo aprovação específica).
- [ ] Backup/snapshot verificado para toda alteração persistente.

## Documentação obrigatória
- [ ] `docs/PLANO_MESTRE_HARVEST.md` adendo revisado, sem apagar histórico.
- [ ] `docs/RELATORIO_ENTREGAS.md` novo registro append-only.
- [ ] ADR vigente atualizado/novo (se houver decisão).
- [ ] `docs/HANDOFF_HARVEST_PARA_AGENTES.md` e `docs/ARQUITETURA_HARVEST.md` atualizados quando necessário.
- [ ] Nota em `docs/brain-sync/` para sincronização posterior com Brain/Wiki do Mac; não alegar atualização do Vault sem execução.

## Evidências
- [ ] Build/TypeScript e testes unitários.
- [ ] Banco/isolamento tenants (dados fictícios).
- [ ] E2E do fluxo alterado, com logs sanitizados.
- [ ] Staging/QA (ou justificativa de bloqueio).
- [ ] Plano rollback e aceitação explícita antes de produção.
