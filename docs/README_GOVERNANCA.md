# Governança — como um agente remoto deve ler este repositório

Este arquivo existe para que um agente remoto (Manus, Gemini, ou qualquer
outro) consiga operar no Harvest **sem acessar o filesystem local do Mac**,
sem confundir este repositório com a fonte institucional da Figueira, e sem
tratar histórico como estado atual.

## 1. Este repositório não é a fonte institucional da Figueira

A fonte institucional única e vigente é o **Brain**, que vive fora deste
repositório:

```
/Users/gui_t/Figueira_Marketing/brain/
```

Este repositório (`tuco-gui/harvest-ai`) é **público de propósito** (ver
`README.md` da raiz) e contém apenas o que é necessário para operar o
**produto Harvest**: código, schema, docs operacionais e histórico de
entregas do próprio Harvest. Ele não substitui, não compete com, e não tenta
sincronizar o Brain inteiro.

Não foram copiados para cá, e não devem ser:
- o Brain completo;
- memórias gerais da Figueira;
- arquivos pessoais;
- secrets, `.env`, credenciais;
- documentos de outros clientes;
- arquivos históricos irrelevantes ao Harvest.

## 2. Fontes canônicas institucionais — apenas referenciadas, não espelhadas

Dois documentos institucionais foram avaliados para possível cópia neste
repo: as instruções do projeto GPT da Figueira e o Manifesto vigente.

**Decisão: não espelhar. Apenas referência documentada.**

Motivo: `AGENTS.md` (raiz de `/Users/gui_t/Figueira_Marketing`) já instrui
explicitamente *"nunca trate este arquivo como substituto do Brain nem copie
o Manifesto para adapters"*. Este repositório é, na prática, mais um adapter
de leitura — e é público. Copiar filosofia institucional interna para um
repo público criaria uma fonte concorrente exatamente do tipo que a
governança da Figueira proíbe, além de expor conteúdo institucional sem
necessidade. Se essa decisão precisar ser revista, é uma decisão de
Guilherme, não algo para um agente decidir sozinho.

Caminhos reais (acessíveis apenas por quem tem o filesystem local ou o
Brain via outro canal — um agente remoto **não** vai encontrar isso aqui):

| Documento | Caminho real |
|---|---|
| Constituição operacional | `brain/00-sistema/CONSTITUICAO.md` |
| Regra de precedência | `brain/00-sistema/PRECEDENCIA.md` |
| Manifesto vigente | `brain/00-sistema/MANIFESTO.md` |
| Governança de agentes | `brain/00-sistema/GOVERNANCA-AGENTES.md` |
| Instruções do projeto GPT | `brain/07-adapters/chatgpt/INSTRUCOES_PROJETO_GPT_FIGUEIRA.md` |

> **Nota de divergência encontrada nesta auditoria:** a instrução que gerou
> este documento citava o arquivo `MANIFESTO_Figueira_Revisado_2026-08-09.md`.
> Esse nome literal não existe no Brain atual — o Manifesto vigente é
> `brain/00-sistema/MANIFESTO.md`. Tratando como o mesmo documento em versão
> atual; se houver um arquivo com aquele nome exato em outro lugar, vale
> confirmar com Guilherme antes de considerar este README desatualizado.

Um agente remoto que só tem acesso ao GitHub **não consegue ler esses
arquivos** — e não deveria tentar adivinhar o conteúdo. Se uma decisão
depender de filosofia/valores institucionais da Figueira além do que está
documentado nos arquivos operacionais do Harvest (abaixo), a resposta correta
é perguntar a Guilherme, não inferir do código.

## 3. Regra de precedência (resumo operacional, válido também para o Harvest)

Em caso de conflito:

1. ordem atual e explícita de Guilherme;
2. decisão aprovada e registrada para o escopo;
3. contrato, SOW, SLA e critérios de aceite;
4. constituição operacional / instruções vigentes do Projeto Figueira;
5. arquivos atuais do escopo (para o Harvest: os documentos da seção 4);
6. Manifesto vigente da Figueira;
7. Brand Board (`#C4191F`, preto/branco/cinzas, verde só em CTA, Montserrat
   em títulos, Inter no corpo, grid 12 colunas);
8. materiais antigos, apenas como referência histórica.

Documentos marcados como arquivado/histórico/legado nunca prevalecem sobre
os vigentes.

## 4. O que É fonte de verdade dentro deste repositório

Para o estado atual do produto Harvest, nesta ordem:

1. **Estado real do Git** (`git log`, `git branch -a`, `git status`) —
   sempre confira antes de confiar em qualquer documento.
2. `docs/PLANO_MESTRE_HARVEST.md` — plano vigente, fases e decisões.
3. `docs/RELATORIO_ENTREGAS.md` — histórico cumulativo de entregas, entrega
   por entrega, nunca resumido ou apagado.
4. `docs/HANDOFF_HARVEST_PARA_AGENTES.md` — snapshot de handoff para um
   agente novo, com data explícita: pode ficar desatualizado rápido, use
   sempre com os dois documentos acima.
5. `docs/ARQUITETURA_HARVEST.md` — arquitetura atual do ecossistema
   (Harvest + WAHA/Evolution + Chatwoot + Twenty + n8n + staging/produção).
6. `README.md` (raiz) — visão de código e estrutura de pastas. **Atenção:**
   na data desta auditoria (2026-08-14), a seção "O que falta" do README
   está desatualizada — ainda lista "conectar WhatsApp pela tela (QR Code)"
   como pendente, mas isso já foi implementado (WAHA multicanal) e está em
   processo de hotfix/QA. Confie em `PLANO_MESTRE_HARVEST.md` e
   `RELATORIO_ENTREGAS.md` para o estado real; trate o README como guia de
   código, não como status de produto.
7. `docs/deploy.md`, `docs/roadmap-saas.md`, `docs/enriquecimento.md`,
   `docs/inbound-webhooks.md`, `docs/superpowers/` — documentação
   operacional específica, já existente e não duplicada aqui.

## 5. Datas e versão

Este documento foi criado em **2026-08-14**, na branch
`docs/remote-agent-onboarding`, a partir do estado real auditado do
repositório e do Brain nessa data. Não é atualizado automaticamente — um
agente remoto deve sempre cruzar com `git log` e com
`docs/RELATORIO_ENTREGAS.md` para saber se algo mudou desde então.
