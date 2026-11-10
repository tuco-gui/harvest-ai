# Realize — autenticação, cutover e estado operacional

Data: 2026-11-06. Base publicada pelo operador: `main` / `3ef0968` (PR #46 integrado).

## Checklist atual

- [x] Endpoint BDR publicado e protegido; migration 054 e workspace Realize conferidas.
- [x] Autenticação Harvest ↔ n8n configurada e testada, com escopo exclusivo da workspace Realize.
- [x] Bridge Superlógica vinculado à consulta LEADS paginada existente.
- [x] Cutover dos dois workflows de origem e do child concluído, com escritor único verificado nas versões publicadas.
- [x] Nós de formulário, planilha, validação e resposta de protocolo preservados.
- [x] Captura/reconciliação ponta a ponta e reentrega LP/minichat verificadas sem duplicidade.
- [x] Reconciliação agendada, em execução com sucesso, sem habilitar IA.
- [x] BDR configurado em simulação, agente inativo e sem aprovação de respostas reais.
- [x] Responsabilidades cadastral, pré-atendimento e comercial registradas separadamente.
- [x] Incidente GitGuardian 39757224 confirmado e classificado tecnicamente como identificador não secreto.
- [ ] Pareamento físico do WhatsApp da Realize e homologação de recebimento/envio manual/mídia.
- [ ] Conexão de IA própria da Realize para testes manuais com LLM, quando autorizada.
- [ ] Identificação e homologação dos responsáveis comerciais no Superlógica antes de qualquer transferência automática.

Os antigos bloqueios **404 / migration ausente / workspace ausente estão resolvidos**. Não houve repetição de migration, criação de workspace ou implantação de nova imagem nesta operação.

## Infraestrutura e autenticação

Workspace: `realize`, UUID `ce15f29b-ce0f-409c-9785-25f363dc74d5`.

A inspeção inicial encontrou os bindings BDR vazios no runtime. O operador autorizou explicitamente aplicar a configuração e recarregar o serviço **com a mesma imagem**, sem novo build/migration/workspace ou ativação da IA.

Imagem preservada antes/depois:

```text
ghcr.io/tuco-gui/harvest-ai@sha256:b6817d0ffc92e2a42530a8c052347cd211d6504bccdb4cbbcbe0debdf0846051
```

Foram configuradas credenciais de header dedicadas ao BDR e reutilizada a chave institucional n8n `Harvest_AI` já existente. LEADS, ZAPIER e demais credenciais protegidas não foram alteradas. Não foi criado outro MCP, outro transporte WhatsApp ou outro serviço.

Os segredos de autenticação estão no Docker Swarm e no armazenamento cifrado do n8n. Um preload de configuração lê os dois segredos no início do processo, sem expor os valores no ServiceSpec. O estado auxiliar da operação foi higienizado para conter somente metadados; nenhum token aparece neste documento, no Git ou nos resultados de teste.

Testes reais:

| Chamada | Resultado |
|---|---|
| Harvest sem token | **401** |
| Harvest com token válido e ação inválida de diagnóstico | **400**, após autenticar |
| Token válido com workspace divergente | **401** |
| Bridge n8n sem token | **403** |
| Bridge com token válido, consulta controlada após cutover | **200**, resultado de reconciliação, sem POST indevido |

Os bindings do n8n foram fixados no endpoint público e UUID Realize, sem recarregar os serviços n8n para adicionar variáveis globais. O verificador normaliza essa representação somente depois de conferir URL exata, UUID e referência de credencial; os demais controles de escritor único permanecem ativos.

## Workflows publicados

| Papel | Workflow | Versão verificada |
|---|---|---|
| LP → planilha/protocolo → captura Harvest | `CZ3gAStDKp75yJtm` | `9136d1a6-213a-4f64-8420-ca8b2de29ff6` |
| Minichat → planilha/protocolo → captura Harvest | `pqVU7Tceb9Xv8dHs` | `4a043138-8cc8-4c5b-9a80-2c671458d89e` |
| Child de escrita existente, sem retry cego | `njZxxrVJrrl6l96i` | `2a5bbc50-60ca-4ba6-9291-de93b0efd80a` |
| Bridge autenticado com verificador e LEADS | `K244zbnfXyopCXGS` | `9fa06661-1626-4c54-a7e7-f267d7366bd6` |
| Consulta LEADS paginada existente | `tDi9BFIJgcfudUkh` | `6d7e3b62-e03b-4686-9df5-7be9f1370413` |
| Reconciliação agendada (IA desativada) | `bLzcrhTPk1LQR7am` | `e86264e3-04ab-4155-9e73-802b94d3e986` |

### Procedimento de cutover executado

1. Backup dos três workflows existentes antes de qualquer alteração, com acesso restrito.
2. Pausa controlada das duas origens e consulta de execuções `new/running/waiting` das origens e child.
3. **Zero execuções antigas pendentes** antes da troca.
4. Substituição do nó de chamada direta ao child por captura autenticada no Harvest, mantendo seu ID/nome e as conexões existentes.
5. Desativação de retries automáticos no POST do child; resposta HTTP completa mantida para o tratamento de resultado incerto.
6. Publicação e comparação dos workflows: todos os nós de formulário, planilha, validação e resposta permaneceram equivalentes aos originais; conexões preservadas.
7. Validação do escritor único nas versões publicadas e auditoria das referências ativas no n8n.
8. Teste nativo, correção de sintaxe de um binding de configuração e repetição da reconciliação com sucesso. Durante a correção, as capturas ficaram preservadas na fila e não houve fallback para POST cego.

Auditoria das versões ativas encontrou **um único nó HTTP para `/production/cliente`**, no child existente, e **uma única chamada ativa desse child**, no bridge. As duas origens não chamam mais o child diretamente.

Backup de configuração n8n: `/tmp/harvest-realize-cutover-bkEHGn/originais.json`, no container editor, com permissões restritas. É uma cópia de configuração/referências, não uma exportação de valores de credenciais. Os backups PostgreSQL/migration/publicação anteriores informados pelo operador não foram repetidos.

## Evidência ponta a ponta e deduplicação

Captura controlada autenticada no Harvest, seguida pelo bridge n8n e consulta LEADS completa:

| Campo | Resultado |
|---|---|
| Protocolo de homologação | `HARVEST-QA-E2E-20261106` |
| Registro Harvest | `b4f65892-03b1-4dc2-bfb8-6b73c85da36d` |
| ID oficial Superlógica | `16829081` |
| Imóvel | `CA0653_MMOL` |
| Status Harvest | **`cadastrado`** |
| Erro técnico final | **null** |
| Tentativas | 2: bloqueio inicial do bridge + reconciliação bem-sucedida |
| Reentrega LP | HTTP 200, mesmo registro |
| Entrada minichat com a mesma identidade | HTTP 200, mesmo registro |
| Aliases preservados | **2**, LP e minichat |
| Primeira origem | **lp**, não sobrescrita |

O cadastro CRM controlado já existente foi reconciliado, não recriado. O protocolo permanece no ledger de entradas, na planilha e na resposta dos formulários; o UUID do registro é a chave técnica idempotente usada pelo bridge. Não foi submetido um formulário público adicional para gerar notificações WhatsApp durante esta operação.

O worker autenticado retornou HTTP 200/`ok=true`. A confirmação não foi inferida desse HTTP: foi verificado o registro persistido como `cadastrado`, o ID oficial e ausência de erro. A consulta de estatísticas mostrou o agendador com **5 execuções produtivas bem-sucedidas** no momento da conferência, sem registro de erro do agendador. As falhas iniciais de homologação do bridge foram preservadas nas estatísticas, seguidas de chamadas bem-sucedidas após a correção.

## BDR e responsáveis

Estado final conferido:

- Canal Realize **24**, provider WAHA, ainda desconectado no Harvest e sem número associado. Sessão exclusiva `harvest_ce15f29bce0f409c978525f363dc74d5_c24` criada e iniciada; WAHA retornou **`SCAN_QR_CODE`**, com webhook/HMAC conferidos.
- Funil **13**, `Alea / Pré-atendimento`, ligado somente ao canal Realize.
- `bdr_config.modo=simulacao`.
- `agentes_workspace.ativo=false` para o BDR.
- Sem `aprovado_em`; **zero execuções BDR com status `enviado`**.
- Cadastro/reconciliação CRM habilitados, separados da IA.

Responsabilidades expressamente confirmadas pelo operador:

| Responsabilidade | Regra vigente |
|---|---|
| Responsável pelo cadastro no Superlógica | Padrão atual da API, temporariamente preservado: Marcelo Martins de Oliveira Galdi. Não equivale à homologação do responsável comercial. |
| Responsável pelo pré-atendimento | **Guilherme**. Requisito registrado nas instruções operativas; membro da workspace conferido. |
| Responsável comercial após qualificação | Corretor designado, ainda sujeito à identificação e homologação no Superlógica. **Sem transferência automática.** |

`responsavel_crm_confirmado=true` registra a autorização técnica para preservar o padrão cadastral existente, e não uma autorização de transferência comercial. Não foi usado PUT/PATCH para trocar atribuições no CRM, não foi simulado agendamento e não foram habilitadas respostas ou handoffs comerciais automáticos.

## O que depende de intervenção humana

1. Em Configurações → Integrações da workspace Realize, gerar QR/pairing do canal 24 e parear **o aparelho/número correto da Realize**. Não reutilizar sessões ou números de outros clientes.
2. Após parear, homologar sessão/número, inbound na Inbox, HMAC real, mídia, `fromMe` e envio **manual** com contato controlado.
3. Para simulações manuais com LLM, cadastrar/selecionar a conexão IA própria autorizada para a Realize. A inspeção encontrou provider padrão `openai`, mas nenhuma chave configurada; não foram copiadas chaves de outras contas. Isso não bloqueia cadastro/reconciliação CRM.
4. Identificar e homologar usuários/times comerciais no Superlógica antes de qualquer transferência automática ou liberação do BDR real.

A infraestrutura WAHA respondeu **HTTP 200** e as configurações de URL/API key/HMAC estavam presentes; valores não foram expostos. A criação e o início da sessão específica retornaram HTTP 201, o status retornou `SCAN_QR_CODE` e `numero_pareado=false`, e o webhook próprio foi confirmado. Não foram reutilizados `default`, sessões ou números de outro cliente. Portanto, o pareamento do telefone continua uma etapa física real, não um erro de endpoint Harvest ou ausência de infraestrutura. O QR deve ser obtido/atualizado pela UI quando o responsável estiver com o aparelho; seu conteúdo não foi incluído nos logs ou no documento.

## GitGuardian 39757224

Classificação técnica: **falso positivo — identificador de referência n8n não secreto**.

Foi conferido, em memória no n8n, que a string sinalizada é o `id` da credencial `httpHeaderAuth`, e que é diferente tanto do valor de autenticação quanto do token contido nele. A cópia literal redundante do teste já havia sido retirada, mantendo a asserção de preservação da credencial.

Não há motivo para revogar a credencial LEADS por esse achado; ela não foi alterada. Não foram adicionadas exclusões amplas nem reescrito histórico. Esta classificação e sua evidência são registradas no PR #46; não se afirma que o status administrativo do incidente no painel GitGuardian foi alterado sem acesso próprio a esse painel.

## Escopo multicliente

Meta e Inbox permanecem capacidades multicliente do Harvest. Nenhum código de módulo, permissão global, integração Meta/Chatwoot ou workspace de outro cliente foi alterado. A allowlist desta autenticação BDR e os workflows desta operação são exclusivos da Realize por isolamento de dados, não por exclusividade das capacidades da aplicação.
