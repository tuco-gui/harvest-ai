# PR #46 — LEADS paginado e cadastro real controlado

Data: 2026-11-06. Esta evidência atualiza a revisão anterior: o schema bruto foi implementado, a consulta real completa passou e um cadastro controlado foi confirmado. **O cutover para o Harvest ainda está bloqueado pelos pré-requisitos de produção abaixo.**

## Contrato e paginação

Endpoint existente: `GET https://8cjlgzfyye.execute-api.sa-east-1.amazonaws.com/production/leads`. A credencial `REALIZE - Superlogica LEADS - Authorization` (`C0adNbEFeHge9Tjp`) foi reutilizada sem mudar seu valor ou pedir outro token.

Retorno bruto: `data`, `total`, `page`, `perPage`, `lastPage`; registros com `id`, `telefone`, `email`, `imoveis[].codigo`. A leitura real mostrou `page`/`perPage` como strings decimais e registros legados com `imoveis` ausente/nulo. O adapter aceita números inteiros ou strings decimais estritas, sem coerções como `1e0`/`1x`. Identidade encontrada sem imóvel associado exige reconciliação, nunca confirmação ou novo POST automático.

`app/src/lib/superlogicaLeads.mjs`:

- começa na página 1; padrão de 100 registros/página, até 50 páginas/5.000 registros; limites configuráveis no adapter, com teto absoluto de 100 páginas/10.000 registros;
- verifica quantidade esperada por página, página solicitada/recebida, estabilidade de `total`/`perPage`/`lastPage`, IDs únicos e quantidade final igual a `total`;
- para diante de timeout/HTTP inválido, schema ambíguo, página parcial/repetida, metadados alterados ou limite excedido;
- erro em qualquer página invalida a consulta inteira, inclusive candidatos encontrados anteriormente;
- percorre toda a listagem, mas devolve apenas os candidatos à identidade consultada, não a base de outros contatos;
- mapeia `id` para `id_superlogica` e procura `CA0653_MMOL` em todos os imóveis do registro;
- só libera `completa=true` depois de verificar todas as páginas.

`analisarConsultaLeads` e o bridge continuam exigindo identidade, imóvel, ID e correlação de tenant/chave; HTTP 200 isolado nunca confirma presença. Duplicados com IDs diferentes, identidade conflitante ou imóvel divergente ficam em reconciliação.

## Integração n8n existente

Workflow atualizado **no mesmo ID**: `tDi9BFIJgcfudUkh`.

- versão anterior: `bdaf62f8-b800-4645-bbb9-67e47a374729`;
- versão publicada: `6d7e3b62-e03b-4686-9df5-7be9f1370413`;
- credencial e os três nós do ramo manual de diagnóstico preservados;
- HTTP nativo do n8n executa apenas GET, com timeout de 20s, resposta completa e sem retry cego;
- Code nodes gerados a partir do contrato testado; loop nativo controla a próxima página;
- recebe tanto a consulta de reconciliação quanto o preflight `acao=cadastrar` do bridge; internamente ambos se tornam somente leitura;
- alterações efetuadas pelo CLI suportado do n8n, com backup e verificação de versão/publicação, sem SQL direto nas definições e sem reinstalar/reiniciar serviços.

Arquivo versionado inativo: `n8n/realize-leads-paginacao.json`. Ele mostra o ramo de integração; não deve ser importado diretamente sobre o workflow completo de produção. A transformação `prepararLeadsPaginacao` preserva o workflow completo existente, incluindo seu diagnóstico. O bridge utiliza esse workflow no binding `REALIZE_SUPERLOGICA_LEADS_WORKFLOW_ID=tDi9BFIJgcfudUkh` quando for autorizado a entrar em operação.

Ferramentas versionadas:

- `scripts/realize-leads-artifact.mjs`: geração/verificação do export;
- `scripts/realize-leads-instalar.mjs`: dry-run por padrão, atualização somente com `--apply`, validação otimista da versão e restauração em falha;
- `scripts/realize-leads-homologacao.mjs`: leitura completa real com sumário sanitizado;
- `scripts/realize-cadastro-controlado.mjs`: teste explícito de cadastro com checkpoint antes de POST e consulta antes/depois;
- `scripts/realize-cutover-readiness.mjs`: verificação somente leitura de infraestrutura mínima, sem autorizar cutover por si só.

Os valores das credenciais são utilizados em memória dentro do container n8n e não retornam ao processo local nem são persistidos pelo harness em arquivo/log. Não foi configurado outro MCP ou outra integração.

## Homologação real realizada

A consulta completa inicial percorreu **11 páginas / 1.014 registros**. O alvo foi o destinatário já configurado no workflow inativo `TESTE CONTROLADO - REALIZE - WhatsApp`, não um telefone escolhido ao acaso ou um lead de outra workspace. O número não é incluído no documento ou nos logs do harness.

O teste utilizou o preparador real do child `njZxxrVJrrl6l96i`, seu contrato e a credencial de escrita Realize existente. Executou **um único POST** na API oficial, identificado como `TESTE CONTROLADO HARVEST ALEA - NAO ABORDAR`; não acionou o workflow WhatsApp, não inseriu linha na planilha das campanhas e não enviou mensagem.

Checkpoint criado antes do POST impede nova escrita automática se o resultado for ambíguo. A confirmação foi feita exclusivamente pela consulta LEADS completa posterior e pelo vínculo de imóvel/identidade.

| Evidência | Resultado |
|---|---|
| ID oficial Superlógica | **`16829081`** |
| Imóvel confirmado | **`CA0653_MMOL`** |
| Protocolo controlado | `HARVEST-QA-6aa32def-bd53-44b9-bf9c-8503c2e414cd` |
| HTTP da escrita | 200 — não usado sozinho como confirmação |
| Consulta posterior | Completa, 11 páginas, **1.015 registros**, identidade/imóvel correspondentes |
| Reexecução com mesmo alvo/protocolo | Mesmo ID; **zero POSTs novos**; total permaneceu **1.015** |
| WhatsApp/planilha | Nenhum envio/alteração pelo teste |

Isso homologa o cadastro e a reconciliação da API usando o contrato do child. **Não é uma alegação de homologação ponta a ponta LP → Harvest → bridge**, pois a API Harvest ainda não está publicada. O contexto UUID usado pelo harness é apenas diagnóstico, não cria workspace nem vínculo de lead no Harvest.

## Cutover: bloqueio verificado, não executado

Resultado real do preflight:

```json
{
  "endpoint_status": 404,
  "schema_bdr_instalado": false,
  "workspace_realize_existente": false,
  "cutover_permitido": false
}
```

`/api/webhook/bdr` ainda não existe na aplicação de produção. Também faltam a aplicação autorizada da migration BDR e a workspace Realize isolada. Redirecionar os formulários agora quebraria a captura; por isso **os workflows `CZ3gAStDKp75yJtm`, `pqVU7Tceb9Xv8dHs` e `njZxxrVJrrl6l96i` não foram alterados nesta rodada**.

A restrição anterior de não fazer merge/deploy do Harvest continua respeitada. Para concluir o cutover é necessária autorização para publicar a aplicação, aplicar a migration e provisionar a workspace/configuração Realize. Depois: validar autenticação ponta a ponta, confirmação do pré-atendimento, preservação de protocolos, pausar/drenar execuções antigas, publicar os patches e validar escritor único nas versões realmente publicadas. Apenas passar no preflight de infraestrutura não substitui essas verificações.

As respostas automáticas BDR para leads reais permanecem desativadas. O workflow de leitura publicado não envia mensagens e não cria cadastros.

## Verificações desta rodada

- **85/85 testes gerais aprovados**.
- **30/30 testes BDR/SQL/contratos aprovados**, incluindo 8 cenários novos de paginação realista, duplicidade, ausência de imóvel, resposta incompleta/ambígua e credencial preservada.
- TypeScript e build de produção aprovados, com um worker e heap limitado; 77 páginas estáticas geradas.
- Exports LEADS/bridge conferidos contra os geradores testados.
- Duas execuções de cadastro controlado: uma escrita confirmada e uma reexecução sem duplicar.
- A migration não mudou nesta rodada; testes PostgreSQL locais continuam aprovados e a evidência anterior de dry-run/ROLLBACK no schema operacional permanece válida.
