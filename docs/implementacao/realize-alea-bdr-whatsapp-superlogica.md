# Implementação: BDR imobiliário Alea Botucatu no Harvest

**Escopo:** cliente Realize Negócios Imobiliários, imóvel Superlógica `CA0653_MMOL`. **Status:** especificação para implementação, **não habilita mensagens automáticas**. Data: 2026-11-06.

## Objetivo e sequência obrigatória

1. Todo lead legítimo oriundo de formulário da LP, minic chat, WhatsApp conectado e, futuramente, Meta, deve existir no Superlógica **independentemente da qualificação**. O cadastro não implica transferência ao corretor.
2. Harvest é a camada de atendimento e BDR consultivo. Superlógica é o CRM oficial. n8n integra ambos e mantém auditoria.
3. Leads iniciais devem ficar atribuídos ao usuário de pré-atendimento indicado pela Realize (Guilherme). **Não presumir que o endpoint de criação escolhe responsável**: validar regra por time/usuário diretamente no Superlógica, antes de ativar importação/reconciliação.
4. Transferir ao corretor depois de qualificação/solicitação expressa de humano/agendamento; não inventar agenda, preço, disponibilidade, financiamento ou aprovação.
5. Cada tenant/workspace é isolado; nunca utilizar credenciais/contatos da Henri Lustres, Ortega, Taborda ou outros clientes neste fluxo.

## Evidência de arquitetura existente

- `app/src/lib/waha.ts`: WAHA é transporte de WhatsApp, não motor de conversação. Sessão por tenant/canal; webhook HMAC.
- `app/src/app/api/webhook/waha/route.ts` e `app/src/lib/inbound.ts`: inbound assinado, registro e dedupe por `conta_id`, `provider`, `message_id_externo` e `canal_id`.
- `app/src/lib/agentes.ts`: papel `bdr` existe, mas a implementação atual é laboratório manual: **não há atendimento autônomo nem envio pela API dos agentes**.
- `app/src/lib/crmConversaOportunidade.ts`: não inferir vínculo de conversas por nome/telefone; usar vínculo explícito.
- `.claude/CLAUDE.md`: verificar Twenty/Chatwoot e usar `lib/eventos.ts` como dispatcher canônico, não adicionar automações ao `lib/automacoes.ts` legado.
- `docs/brain-sync/2026-10-25-kommo-canais-inbox-contatos.md`: uma única Inbox, políticas de opt-out e escopo; conectores sociais ainda carecem de confirmação operacional.

## N8N atual a preservar

- `CZ3gAStDKp75yJtm` — REALIZE — Alea Pré-Cadastro → Planilha e Protocolo.
- `pqVU7Tceb9Xv8dHs` — REALIZE — Alea Chat WhatsApp → Planilha.
- `njZxxrVJrrl6l96i` — REALIZE — Superlógica Alea | Registrar leads (rascunho), publicado e associado aos dois anteriores.
- Código do imóvel: `CA0653_MMOL`.
- Credencial no n8n: **Superlógica Realize - Zapier** (não incluir valores de tokens neste repositório).
- Endpoint de criação documentado: `POST https://sr3qgnognj.execute-api.sa-east-1.amazonaws.com/production/cliente`, com `Authorization` e `codigo_anuncio`, `cliente`, `telefone`, `email`, `midia`, `comentarioLead`.
- **Pendência obrigatória:** confirmar em registro real controlado que API aceitou o lead, que imóvel e time estão corretos, sem duplicar registro nem disparar abordagem por engano. O teste de n8n anterior foi **simulado**, não confirma entrega ao CRM.

## Escopo de implementação — prioridade P0

### A. Configuração da conta Realize
- Localizar ou criar workspace **Realize** isolada no Harvest, **sem usar a conta institucional para leads do cliente**.
- Permitir cadastrar um canal WhatsApp WAHA/Evolution em Configurações → Integrações, com status real de sessão, QR/pairing e webhook inbound. Validar sessão, fluxo de recebimento, envio manual, mídia, `fromMe` e HMAC.
- Escolher funil Alea/Pré-atendimento e vincular um canal por funil segundo as regras existentes. Não conectar números de outra empresa.
- Registrar origem imutável da primeira entrada: `source_channel`, `utm_source`, `utm_medium`, `utm_campaign`, `gclid`, `fbclid`, anúncio/referral quando disponíveis. Atribuição inferida não pode ser apresentada como evidência.

### B. Cadastro e reconciliação Superlógica
- Criar/vincular cadastro ao primeiro identificador confiável. Para form com telefone/e-mail, acionar Superlógica imediatamente. Para WhatsApp inbound, coletar nome/telefone e dados mínimos antes de API, sem atrasar acolhimento.
- Gerar chave idempotente por canal + ID externo/protocolo; persistir mapeamento `tenant_id`, `lead_id_harvest`, `id_superlogica` se API retornar, `codigo_anuncio`, `status_sincronizacao`, timestamps, erro técnico sanitizado e contador de tentativas.
- Implementar fila de falhas/retries com backoff e reconciliação, sem reencaminhar pessoas duplicadas. Não repetir automaticamente POST às cegas se resposta for ambígua; consultar API LEADS e reconciliar.
- API LEADS de consulta é separada da credencial ZAPIER de escrita; não trocar papéis.
- Não presumir disponibilidade de PUT/PATCH para atribuição, comentários ou estágio. Exigir verificação documental ou teste autorizado antes de prometer sincronismo bidirecional.
- Não migrar leads antigos até receber lista e decidir política de duplicidade; nunca reabordar os históricos automaticamente.

### C. BDR imobiliário (novo motor real, não laboratório)
- Conectar agente do tipo `bdr` ao dispatcher `lib/eventos.ts` e mecanismo de envio permitido para o canal. Registrar respostas na conversa canônica, com histórico resumido e estado durável por `conta_id/conversa_id`.
- Estados: `novo` → `contato_iniciado` → `em_qualificacao` → `qualificado` → `aguardando_corretor` → `transferido`; paralelos `sem_resposta`, `nutricao`, `desqualificado`, `opt_out`, `humano_assumiu`.
- Qualificação progressiva: interesse no Alea, momento/prazo de compra, intenção de financiamento, renda **em faixa e facultativa no chat**, possibilidade de FGTS/entrada, objeção principal, desejo de visita e disponibilidade. No máximo 1–2 perguntas por turno. Não exigir dados sensíveis desnecessários.
- Objeções: responder com base de conhecimento aprovada (ficha do imóvel, localização, materiais comerciais, regras e condições atualizadas), admitir dúvidas, escalar regras financeiras ao corretor. Não inventar condições, simulação de financiamento nem disponibilidade.
- Cadência sugerida a validar: primeiro contato apenas quando houver base legal/canal apto; uma retomada contextual no mesmo dia, outra D+1, outra D+3, encerramento da cadência inicial D+7; interromper na resposta, opt-out, handoff ou horário inadequado. Não fazer disparos a contatos sem consentimento.
- Handoff: humano solicitado, intenção explícita de agendamento, alto interesse, falta de confiança, situação crítica, conflito ou solicitação fora da base. Transferir conversa + resumo estruturado ao humano; desativar respostas da IA imediatamente após humano assumir; somente retomar com liberação registrada.
- Sem confirmação externa de calendário, **oferecer horários e solicitar preferência**, nunca afirmar agendamento concluído.

### D. Prompt operativo da persona — versão inicial
Você é o BDR imobiliário digital do empreendimento Alea Botucatu, operando pela Realize Negócios Imobiliários. Sua missão é ajudar pessoas que manifestaram interesse, entender o momento de compra e preparar a melhor conversa possível com um corretor humano. Seja breve, humano, persistente com respeito, consistente e consultivo; nunca agressivo. Em cada turno, aproveite respostas anteriores; não repita perguntas nem envie formulários longos. Faça no máximo uma pergunta principal por mensagem. Entenda interesse, objetivo de moradia, prazo, dúvidas de preço/condições, financiamento/FGTS e disponibilidade para conversar/visitar. Não use a faixa de renda isoladamente para desqualificar. Para objeções, esclareça com informações confirmadas; se não souber, diga que confirmará com corretor. Não alegue aprovação de crédito, preço, desconto, estoque, visita marcada ou benefício que não estejam documentados. Se o cliente pedir humano, transferir imediatamente. Se disser para parar ou não tiver consentimento, interromper contatos. Ao encaminhar, produzir resumo factual de origem, interesse, histórico, objeções, estágio e próxima ação. Informe que o atendimento é realizado por assistente virtual quando pertinente.

## Aceite obrigatório, antes de habilitar respostas reais

1. **Isolamento:** Realize não vê nem altera dados de outras workspaces.
2. **Sem duplicidade:** mesmo webhook repetido 2x produz 1 evento / 1 lead e uma única sequência BDR.
3. **Teste funcional:** lead do formulário chega à planilha e ao Superlógica; código do imóvel `CA0653_MMOL` válido; usuário de pré-atendimento confirmado.
4. **WhatsApp:** conexão QR em tenant correto; inbound chega à Inbox e negócio no funil; saída manual funciona; resposta IA só com feature flag aprovada.
5. **BDR:** 5 cenários de conversas (interessado, frio, objeção, pedido de humano, opt-out) testados sem envio externo.
6. **Cadência:** retries não duplicam mensagem; quiet hours; dedupe; stop on reply; opt-out persistente.
7. **Handoff:** humano assumiu → bot não responde; histórico e resumo visíveis.
8. **Auditoria:** falha de Superlógica sinalizada, sem perder lead; nenhuma credencial/PII em logs de erro.
9. **Observabilidade:** KPIs leads recebidos, cadastrados CRM, atendidos, respondidos, qualificados, encaminhados, visitas confirmadas por humano, falhas.
10. **Rollout:** homologar na workspace Figueira Marketing com contatos de teste controlados, sem staging, e liberar na workspace Realize apenas após aprovação operacional e confirmação dos resultados.

## Não fazer
- Não alterar instruções protegidas de `.claude/agents/`, configurações de MCPs institucionais ou valores de secrets.
- Não mover leads de outros clientes.
- Não ativar bot para campanhas reais sem validação de WhatsApp, consentimento, mensagens e handoff.
- Não publicar alteração no Harvest sem build/typecheck/testes e autorização aplicável.
