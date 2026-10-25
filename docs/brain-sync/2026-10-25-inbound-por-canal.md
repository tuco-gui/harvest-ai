# Harvest — entrada de mensagens por canal e destino de funil

## Decisão
- Manter o Harvest como Inbox principal. O WAHA/Evolution permanece transportador de mensagens e o Chatwoot é opcional, sem novas dependências.
- Um funil pode definir canal de WhatsApp próprio (migration 041). A recepção **não deve** presumir que um contato só tem uma conversa na workspace: o mesmo telefone pode conversar com dois números/canais.
- A sessão WAHA ou instância Evolution autenticada é o identificador do canal (whatsapp_canais.identificador_externo). Nunca confiar em conta_id enviado pelo provider ou inferir o canal pelo número do contato.
- Quando o canal estiver ligado a exatamente **um** funil ativo, gravar funil_id no evento inbound. Se estiver em zero ou múltiplos funis, **não** atribuir um funil automaticamente. O cadastro da oportunidade é ato explícito do atendente.
- Mensagens antigas mantêm canal_id e funil_id nulos. Não executar backfill usando telefone ou conjectura.

## Implementação PR #24
- `sql/042_inbound_canal_funil.sql`: colunas `canal_id`, `funil_id` e índices únicos segmentados por canal, com compatibilidade legada e trigger contra associação cross-workspace.
- `inboundDestino.ts`: resolução exata da sessão/instância contra os canais registrados, com rejeição de aliases ambíguos; fallback legado só para identificar conta, **sem funil**.
- `inbound.ts`: grava novo canal e funil com cada evento; preserva supressão opt-out, validação de ambiente e automações existentes, mas correlaciona campanha por canal e negócio por funil identificado.
- Inbox: nomes dos canais recebidos, aviso para telefone que apareceu em mais de um canal, visualização filtrada do histórico, bloqueio de resposta automática no canal errado, possibilidade de escolher manualmente o canal conectado.
- Ao clicar "Criar negócio a partir da conversa", o Harvest usa o funil que a origem permitiu identificar e busca a primeira etapa desse funil; quando a origem for ambígua exige escolher canal antes.
- Nenhum webhook é cadastrado ou alterado, nenhum número é reconectado, nenhuma mensagem é enviada por esta implantação.

## Restrição atual importante
- SLA, status e responsável do atendimento continuam indexados por `(conta_id,telefone)`; assim eles são compartilhados entre os canais do mesmo contato. O histórico **novo** pode ser filtrado por canal; o antigo (sem canal_id) permanece legado. Para gestão de atendimentos 100% independente por canal será necessária uma segunda migração planejada de `crm_atendimentos`, com dados históricos e permissões revisados.
- O roteamento automático de novos *negócios* não foi ligado: hoje o evento é identificado e o atendente decide criar o negócio no funil sugerido. Não prometer criação automática de oportunidades.
- Até autenticar o navegador na workspace e ver um webhook real de cada provider, homologação funcional segue pendente.

## Verificações obrigatórias
1. Tests + TS + build no GitHub Actions.
2. Aplicar `042` antes de publicar imagem. Conferir contagem de eventos sem perdas e índices / trigger.
3. Swarm imagem somente, preservar stack e rollback.
4. Smoke do login/rotas, confirmar nenhuma mensagem WhatsApp gerada.
5. Conferir visualmente dois números com mesmo telefone no QA autenticado quando houver exemplo real.
