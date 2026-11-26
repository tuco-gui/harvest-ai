# Realize — recepção geral + BDR Alea
Escopo exclusivo CLIENTE REALIZE. Decisão do responsável em 26/11/2026: o número atende toda a imobiliária; BDR comercial aprofundado somente para Alea e futuros empreendimentos explicitamente autorizados. Nesta rodada, ONE Terramaris não é automaticamente autorizado.

## Política implementada nesta branch
- WAHA/Evolution: preserva o canal/funil e motor BDR existentes, sem novo serviço.
- Alea por menção explícita (Alea/Aleia) ou evidência recente de LP/minichat com campanha Alea persistida; intenção explícita de outra demanda prevalece. Sem origem verificável, recepção. Não inferir campanha a partir de uma saudação.
- Recepção: nome, telefone do canal, intenção comprar/alugar/vender imóvel próprio/disponibilizar para locação/outro e breve identificação do imóvel; resumo em sessão, estado aguardando_corretor, sem follow-up e sem base comercial Alea. Pedido explícito de humano, pausa e opt-out mantêm os guards anteriores.
- Não cadastrar conversa geral como CA0653_MMOL: captura WAHA e Meta por nome exige interesse explícito. Formulários Alea continuam no bridge existente. O cadastro genérico Arbo fica bloqueado: contrato atual da RPC, índice e bridge exige CA0653_MMOL e regra de distribuição homologada. Não inventar código ou campo de API.
- Pré-triagem Alea: intenção de financiamento, faixa opcional da renda bruta familiar, FGTS/entrada, sem CPF/documentos ou renda exata. Classificação apenas orientativa nas faixas do subworkflow n8n kfQjmjKQKmNX5nal (Portaria MCID 333/2026); sem calcular parcela, subsídio, entrada ou aprovar financiamento. Simulação oficial CAIXA e avaliação humana. O subworkflow n8n permanece inativo e não foi chamado; mesma regra de faixa implementada no runtime, sem segundo serviço.

## Limites e gates
- Branch de desenvolvimento, sem merge/deploy, mudança em banco, n8n, canais, autorização ou envio. Não executar GitHub Actions manualmente.
- Cinco testes unitários da nova política executados localmente em cópia com hashes Git iguais aos arquivos da branch (5/5). Regressões Meta atualizadas, mas suite completa, TypeScript/build e teste autenticado não executados nesta rodada.
- A origem direta de anúncio click-to-WhatsApp (referral/ad ID) não foi homologada: texto explícito e a origem persistida de LP/minichat são os únicos sinais implementados nesta rodada.
- Futuros empreendimentos exigem ficha aprovada, identificação de campanha e código do anúncio; a lista/configuração multiempreendimento e o bridge correspondente ainda precisam ser implementados. Não usar o SKU Alea como substituto.
- Estado aguardando_corretor é fila interna, não evidência de corretor específico notificado/atribuído. Confirmar atribuição e notificação reais em teste controlado. Cadastro geral Arbo só após contrato oficial e teste idempotente com responsável.
- Antes de conectar o número: revisar o diff, rodar suite e build no ambiente autorizado, homologar simulações na workspace Figueira Marketing, conferir QR e impedir respostas a carteiras/conversas assumidas por humanos. Não autorizar atendimento geral automático antes de aprovação da homologação do piloto. Manter Realize em simulação e o escritor existente.
