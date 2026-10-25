# Harvest AI — contrato para agentes

Antes de implementar, leia a governança, o Plano Mestre, o Relatório de Entregas e as ADRs em `docs/`.

- Brain institucional e Wiki: `/Users/gui_t/Figueira_Marketing/brain`. Não copiar o Brain inteiro para GitHub; a nota operacional de sincronização está em `docs/brain-sync/`.
- Código: `tuco-gui/harvest-ai`. Trabalhar em branch; preservar histórico, serviços e dados. Nunca sobrescrever credenciais ou bancos de clientes.
- Produção: Harvest + Twenty + Chatwoot + WAHA/Evolution permanecem até haver homologação isolada do piloto Deskcomm e autorização para migrar.
- Piloto: `docs/decisoes/ADR-010-harvest-deskcomm-piloto.md` e `piloto/deskcomm/README.md`. Não executar migrations no Supabase do Harvest.
- Cada alteração exige adendo no Plano Mestre, nova Entrega no histórico, ADR quando necessário, e nota datada para a Wiki/Brain. Jamais apagar registros anteriores.
- Segredos só em cofre/ambiente, nunca em repositório ou logs. QA com Figueira QA e número próprio, sem mensagem real a clientes.
- Uma feature só está pronta depois de TypeScript, testes, QA/E2E, revisão do rollback e aceite. Apenas código versionado não é produção.
