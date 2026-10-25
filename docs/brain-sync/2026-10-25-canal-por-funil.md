# Canal de WhatsApp por funil — 25/10/2026

## Alteração funcional
- Harvest mantém múltiplos canais existentes na mesma workspace, providos por WAHA ou Evolution; nada foi reconectado, recriado ou desconectado. O chat WhatsApp Cloud API fica pendente.
- Cada funil ganha `canal_padrao_id` opcional, configurado **na própria tela de edição do funil** (`Pipeline → ··· → Editar pipeline e canal`). O vínculo pertence à conta; trigger no PostgreSQL impede apontar para canal de outra workspace.
- Um canal pode estar associado a mais de um funil. A escolha é para **saída** (disparos e pré-seleção de resposta), e **não é equivalente ao roteamento automático de entradas** por número: os webhooks atuais agrupam por telefone, sem vínculo confiável de evento->canal. Não criar oportunidades duplicadas sem esquema de identidade por canal.
- A máquina de prospecção/campanha tem 3 opções: herdar do funil, canal fixo específico ou rodízio manual. Os parâmetros e histórico da campanha antiga permanecem intactos; herança se representa por `canal_ids=[]`.
- A tela de disparo permite mudar temporariamente para herança do funil sem regravar configuração da campanha, passando `herdarCanalFunil=true`.
- Precedência do envio: ID explícito > canais informados na rodada > canais da campanha > canal do funil > canal padrão da workspace.
- Se for selecionado um ID que não está conectado/ativo/pertence à workspace, o envio **falha, sem trocar silenciosamente para outro número**.
- A ficha do negócio e a Inbox avançada priorizam o canal ligado ao funil; continuam permitindo selecionar outro canal conectado manualmente e respeitam a política de opt-out vigente.
- A interface indica canal e situação na lista de funis e no pipeline, sem tela nova.
- Endpoints existentes mantêm autenticação e checagem de tenant; a mudança não promove privilégios de operadores.
- O envio ao WhatsApp segue manual: não foram criadas automações novas nem foi feita qualquer tentativa de disparar mensagens de teste.

## Migração
`sql/041_funis_canal_whatsapp.sql` adiciona FK nullable, índice e trigger. No instante da migração todas as associações ficam NULL, portanto não alteram campanhas/canais existentes. Aplicar ANTES do frontend.
As definições de canais permanecem em `whatsapp_canais`.

## Validação
- CI: testes unitários de precedência, rodízio, erros explícitos e TypeScript/Next build.
- QA autenticado pendente para conferir imagem e salvar associação de funil com sessão WAHA realmente conectada, sem envio externo.
- Teste de mensagem só mediante controle de destinatário e confirmação expressa, preservando anti-spam e opt-out.

## Roadmap não bloqueante
- Conector WhatsApp Cloud API, Instagram DM, Messenger e webchat seguem como integrações planejadas, dependentes de credenciais/permissões/webhooks reais.
- Roteamento de entrada por canal deve vir com chave `(workspace,provider,conexao_id,conversation_id)`, deduplicação de eventos e regra de desempate quando um mesmo número atende vários funis; evitar inferência por telefone apenas.
