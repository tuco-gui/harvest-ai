# Serviços e permissões por workspace

## Escopo e estado de entrega

Implementação local da gestão em **Super Admin → Clientes → Serviços e Permissões**.
A migration `sql/055_servicos_workspace.sql` é um artefato de implantação; sua validação
automatizada usa PostgreSQL WASM (PGlite), sem aplicação no banco de produção.

O catálogo cobre Prospecção, CRM, Inbox/canais, agentes, Analytics, integrações e
administração. A concessão de um serviço não altera credenciais, pareamento, fonte,
aprovação operacional ou estado dos agentes. Presets preparam mudanças no formulário;
só o salvamento explícito persiste o contrato.

## Fontes de verdade

| Camada | Fonte |
| --- | --- |
| Catálogo, dependências e política de efeitos | `app/src/lib/recursos.ts` |
| Política de páginas/APIs | `app/src/lib/recursosRotas.ts` |
| Workspace e papel efetivos | `app/src/lib/workspaceContexto.ts` |
| Contrato da conta | `contas.modulos_habilitados` + `conta_recursos` |
| Contexto delegado | `workspace_delegacoes` |
| Registro administrativo | `servicos_auditoria` |
| Configuração/conexão/ativação | Tabelas operacionais existentes, somente leitura no painel de serviços |

Twenty continua responsável pelo CRM/workflows e Chatwoot pelas conversas. A mudança
acrescenta autorização ao dispatcher `lib/eventos.ts` e aos adapters existentes;
não acrescenta gatilhos ao motor legado `lib/automacoes.ts`.

## Resolução e autorização

1. A sessão é verificada no servidor. O papel global vem de `perfis`.
2. `resolverWorkspace` valida o cookie de seleção contra a conta ativa e os vínculos
   em `conta_usuarios`. O cookie não concede membership nem papel de Super Admin.
3. `carregarRecursos` resolve overrides sobre os módulos legados. Ausência reconhecida
   da migration permite leitura em compatibilidade; outros erros falham fechados.
4. O middleware aplica a política de recursos e efeito (`ler`, `configurar`, `simular`,
   `enviar`, `ativar`). APIs sem política são negadas. Payloads tipados são inspecionados
   com limite de 64 KiB; fontes são resolvidas dentro da workspace antes de autorizar o canal.
5. Os handlers mantêm as verificações de papel/ownership existentes. Workers, webhooks
   e transportes revalidam os recursos após autenticar a chamada e resolver seu tenant.

As rotas públicas preservam sua autenticação própria. Os callbacks Meta revalidam o
recurso do canal antes de trocar código, decifrar opções ou alterar a fonte, inclusive
na finalização por formulário. Automações são filtradas por conta/funil; estágios são
consultados por `funil_id`, pois `funil_estagios` não possui `conta_id`.

As pontes de compatibilidade com os módulos antigos são sintetizadas apenas para
concessões explícitas vigentes. Permissões herdadas não habilitam novos módulos por
efeito colateral. Analytics exige liberação e papel administrativo; seus indicadores
referem-se somente aos registros locais do tenant, sem confirmar estados externos.

## Persistência e concorrência

- `conta_recursos` tem chave `(conta_id, recurso, escopo)`. `permanente` mantém a
  concessão/bloqueio contratado e não tem prazo. `homologacao` é uma camada separada.
- Um trial vigente prevalece sobre o override permanente. Após expirar, o override
  permanente anterior volta a valer; na ausência dele, aplica-se o legado.
- Trials são restritos ao slug `figueira-marketing`, por até 24 horas. Não autorizam
  envios/ativações, inclusive quando a dependência de um recurso é temporária.
- Uma mudança permanente remove o trial daquele recurso. Revogar um pai exige
  revisar os filhos explicitamente liberados; a UI prepara essa cascata na prévia.
- `servicos_salvar` bloqueia a linha da conta, confere `recursos_versao`, grava as
  mudanças e a auditoria na mesma transação. Conflitos retornam HTTP 409.
- O servidor valida catálogo/dependências; as RPCs são executáveis somente pelo
  `service_role` e validam que o ator persistido é Super Admin.
- RLS impede acesso direto dos usuários às três tabelas novas. O papel de serviço
  tem SELECT/INSERT na auditoria, sem UPDATE/DELETE. A migration também impede
  elevação de `perfis.papel` a Super Admin por um administrador de cliente via REST.

## Acesso delegado

Somente Super Admin inicia o contexto, com motivo de 10–500 caracteres, modo e prazo
de 5–120 minutos. Homologação delegada também é restrita à Figueira Marketing.
O cookie HttpOnly/Secure referencia o registro vinculado a ator/workspace; prazo e
encerramento são conferidos no banco em cada requisição protegida.

O contexto permite suporte/configuração de recurso não contratado, sob a identidade
do próprio administrador. Envios e ativações são negados. POST/PATCH/PUT de automações
são tratados como ativação, pois editar regra ativa também produz efeitos operacionais.
Contexto expirado/inválido é recusado até encerramento explícito; não se converte
silenciosamente em sessão normal com permissão de envio.

O topo mostra workspace, finalidade, motivo e prazo. Início, encerramento, uso do
contexto e negativas são auditados. O motivo nunca deve conter credenciais.

## Implantação

1. Validar em ambiente isolado com schema até 054 e backup das tabelas afetadas.
2. Aplicar a migration 055 como administrador do banco. Ela não semeia concessões nem
   atualiza configurações operacionais; as contas iniciam herdando os módulos atuais.
3. Publicar a aplicação com a configuração de servidor existente, inclusive a chave
   de serviço disponível ao middleware. Conferir que as tabelas/RPCs aparecem no PostgREST.
4. Homologar com dois tenants: leitura de legado, liberação/revogação granular,
   dependências, conflito de versão, trial/expiração, delegação/encerramento e auditoria.
5. Conferir o painel como Super Admin, admin de cliente e operador, incluindo navegação
   direta a API bloqueada e OAuth iniciado antes de uma revogação.

Na Realize, manter os vínculos e configurações operacionais já existentes: conceder
serviço não é autorização para produção, conexão ou respostas do BDR.

## Reversão

Prefira corrigir/reverter concessões pela gestão auditada mantendo a aplicação que
aplica os bloqueios. Revogue delegações antes de uma reversão de versão.

Reverter para o código anterior faz os overrides granulares deixarem de ser aplicados;
os módulos legados voltam a determinar o acesso. Portanto, antes dessa reversão,
verifique os tenants com bloqueios granulares e preserve suas restrições nos mecanismos
legados/operacionais. Não trate rollback da aplicação como manutenção de enforcement.

As tabelas aditivas podem permanecer no banco durante rollback. Preserve a auditoria
e o trigger de proteção do papel global. Não apague os registros como procedimento
de reversão; exporte-os antes de qualquer remoção futura deliberada do schema.

## Verificação local

Executar sequencialmente, com `NODE_OPTIONS=--max-old-space-size=1024` e
`UV_THREADPOOL_SIZE=1`:

```sh
# Na raiz
node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/*.test.ts tests/unit/*.test.mjs tests/sql/*.test.mjs
node --test --test-concurrency=1 tests/*.test.js

# Em app/
npm run test:servicos
npm run test:bdr
node --experimental-strip-types --test --test-concurrency=1 tests/unit/fluxoAgente.test.ts
npx tsc --noEmit
HARVEST_BUILD_CPUS=1 npm run build
```

As fixtures usam dados locais e transportes simulados. A suíte SQL carrega o DDL
anterior real e verifica isolamento, atomicidade, RLS, trial em camada separada e
preservação do BDR. A verificação visual e o fluxo completo autenticado em browser
precisam ser homologados em ambiente de aplicação com contas de teste.

Resultado local em 2026-11-07: suíte unitária/SQL com **104 testes aprovados**,
suíte JS legada com **12 aprovados**, script BDR com **32 aprovados** e editor de
fluxos com **4 aprovados**. TypeScript e build de produção concluídos com sucesso.
Os números do BDR se sobrepõem à suíte unitária/SQL; não são testes adicionais únicos.
