# Realize / Alea — catálogo, imagens e imóveis alternativos (11/11/2026)

Escopo exclusivo: **CLIENTE REALIZE NEGÓCIOS IMOBILIÁRIOS**, workspace `realize`. Não misturar Livar, Ortega ou outros clientes.

## Produto cadastrado no PostgreSQL do Harvest

- Tabela `crm_produtos`, conta slug `realize`.
- `sku=CA0653_MMOL`; título `Alea Botucatu | Casas de 2 dormitórios`.
- Valor comercial desconhecido. `preco=0` significa **sob consulta** na interface, nunca preço de R$ 0 ou gratuidade.
- `ativo=true` permite localizar a ficha; **não comprova estoque nem oferta de unidade**.
- Características baseadas na landing page própria da Realize, repositório `tuco-gui/alea-botucatu`: casas de dois dormitórios, quintal, casas isoladas e vaga sujeitos à planta; wood frame; região do Bosque da Alvorada e UNESP como referência. Financiamento/FGTS dependem de análise.
- Fonte comercial: `https://www.casasaleaembotucatu.com.br/` (site independente da construtora).
- Imagens associadas: `assets/casapatio-fachada.jpg`, `casapatio-sala.jpg`, `casapatio-cozinha.jpg`, `casapatio-dormitorio.jpg`, `casapatio-quintal-sugestao.jpg`, todas de `tuco-gui/alea-botucatu`. **Todas marcadas `ilustrativa=true`**. Material de referência usado no próprio projeto, mas sem validação documental de direitos de divulgação, metragem/entrega/unidade. Não disparar automaticamente para leads.
- Galeria adicionada por `sql/059_crm_produtos_galeria.sql`, JSONB de até 12 URLs HTTPS com legenda e flag `ilustrativa`. A UI de Produtos foi adaptada.
- BDR busca exclusivamente `crm_produtos` da própria workspace por `sku=bdr_config.codigo_anuncio`, `ativo=true`. A ficha entra como informação contextual, preservando o prompt comercial e regras de segurança. Informações do catálogo não substituem validação humana de preço/estoque.
- Backup lógico pré-migration: `/var/lib/postgresql/data/figueira-backups/harvest-pre-produto-alea-20261111.dump`, 19 MB, verificado com `pg_restore --list`; mesma VPS, não off-site. Migration 059 aplicada com `ON_ERROR_STOP=1`, exit 0, COMMIT. Produto inserido idempotentemente e 5 imagens conferidas.
- PR: `https://github.com/tuco-gui/harvest-ai/pull/50`, merge `22007f8e25d7c4de0e3e9af12a1fa134f47571d1`. CI passou no head da branch.

## Imóveis alternativos do Superlógica — integração separada

- A conta Realize já possui API LEADS e integração ZAPIER para captura. **Esses tokens NÃO autorizam supor acesso à API IMÓVEIS**.
- Em 11/11/2026 não foi identificada credencial `API IMÓVEIS` entre as credenciais n8n acessíveis da Realize, nem workflow operacional de consulta de imóveis. Portanto **a busca externa não está habilitada nem homologada**.
- A Superlógica Imobiliárias/Arbo documenta um **token separado**: CRM → Preferências → Integrações → Integrações personalizadas → Novo registro → **API IMÓVEIS**. Documentação: `https://documenter.getpostman.com/view/17050484/UVBzpAZ8`.
- A integração futura deve fazer apenas leituras limitadas a imóveis comercializáveis da Realize, com filtros por finalidade, tipo, bairro/cidade, faixa de preço e quartos. Nunca sugerir anúncio desativado/sem fotos confirmadas, nunca expor dados do proprietário, token ou credenciais. Retorno ao agente deve ser resumido com links/fotos autorizados e indicar dados não confirmados.
- Enquanto não houver token/contrato homologado, interesse por outros imóveis deve ser direcionado ao corretor humano, **sem afirmar que o catálogo externo foi consultado**.
- BDR da Realize continua em simulação; nenhuma mudança nessa etapa autoriza resposta automática a clientes.

## API IMÓVEIS — integração preparada, não autenticada

- PR #51: `https://github.com/tuco-gui/harvest-ai/pull/51`, merge `dca2bd7fecb42e1d0a26bd9a8d4349caaaee661c`.
- Endpoint documentado pela Superlógica/Arbo: `GET https://app-integracao.arboimoveis.com/api/imoveis`, header `Authorization` com token exclusivo API IMÓVEIS.
- O código `app/src/lib/superlogicaImoveis.ts` usa apenas a chave server-side `REALIZE_IMOVEIS_API_TOKEN`, sem fallback para API LEADS ou ZAPIER.
- A chamada só ocorre quando o interessado pede alternativas, somente na workspace Realize (allowlist existente `REALIZE_SUPERLOGICA_WORKSPACES`), e filtra `ativo=true`, `publicado=true`, finalidade Venda e cidade Botucatu. Só retorna dados públicos resumidos, limite quatro resultados e fotos de domínio confiável.
- Enquanto `REALIZE_IMOVEIS_API_TOKEN` não estiver no cofre/servidor, **não há consulta real**. O BDR encaminha pedidos de alternativas ao corretor, sem inventar catálogo.
- Testes automatizados validam isolamento, URLs, filtros, ausência de token e exclusão de dados privados.
- A criação do token exige perfil autorizado no CRM Realize: Preferências → Integrações → Integrações personalizadas → Novo registro → API IMÓVEIS. Não copiar valores para GitHub, prompt ou logs.

## Verificações posteriores

Verificar no Harvest com sessão da workspace Realize: Produtos → ficha `CA0653_MMOL`, galeria e preço sob consulta; na Inbox/Agentes, confirmar que o contexto do produto não introduz preços/estoque inventados; verificar encaminhamento de alternativas ao humano enquanto API IMÓVEIS não existir.
