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
