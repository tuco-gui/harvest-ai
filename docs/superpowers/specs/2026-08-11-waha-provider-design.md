# WAHA como segundo provedor de WhatsApp

**Data:** 2026-08-11
**Status:** Aprovado, aguardando plano de implementação

## Motivação

O Evolution API (engine Baileys) apresenta desconexões recorrentes (`401`,
`stream:error`, `conflict`, `device_removed`). Um POC isolado validou o WAHA
(engine NOWEB) rodando na mesma VPS, com pareamento estável — ver
`03_PESQUISAS/whatsapp/POC_WAHA_WEBJS.md`. Este spec cobre a integração desse
WAHA validado ao Harvest AI como uma segunda opção de provedor, sem remover o
Evolution.

## Diferença de modelo entre os dois provedores

- **Evolution — continua BYO** (bring your own instance): a conta cola
  manualmente `evolution_url` / `evolution_instancia` / `evolution_key` de
  uma instância já criada em outro lugar. Sem fluxo de QR dentro do Harvest.
  Isso não muda neste projeto.
- **WAHA — infraestrutura nossa, compartilhada**: uma única instância WAHA
  na VPS (`waha.figueiramarketing.com.br`), com `WAHA_API_URL`/`WAHA_API_KEY`
  como variáveis de ambiente do **servidor Harvest** (nunca expostas ao
  cliente). Cada conta ganha uma sessão nomeada dentro dessa instância
  única, derivada deterministicamente do `conta_id` — não precisa ser
  gravada em lugar nenhum.

## Arquitetura

- `conta_credenciais` ganha uma coluna `whatsapp_provider` (`'evolution'` |
  `'waha'`, default `'evolution'`) — é o único estado novo persistido no
  Supabase para essa feature.
- **Sem tabela de status de sessão**: o status/QR do WAHA é sempre
  consultado ao vivo na API do WAHA, nunca duplicado no Supabase. Isso evita
  o tipo de drift que já causamos manualmente via Portainer durante o POC —
  o WAHA é a única fonte da verdade sobre conexão.
- Rotas que hoje falam só com Evolution (`disparo`, `testar` caso
  `'whatsapp'`, `validar`, `busca`) passam a ramificar em
  `cred.whatsapp_provider`: mantêm o código Evolution existente no ramo
  `'evolution'`, e chamam o novo client WAHA no ramo `'waha'`.

## Componentes

### `lib/waha.ts` (novo)

Client server-side, funções puras equivalentes ao que hoje está inline nas
rotas do Evolution:

- `wahaSessionName(contaId: string): string` — deriva o nome da sessão
  (ex: `conta_` + uuid sem hífens).
- `getOrCreateSession(sessionName): Promise<{status, qr?}>` — tenta iniciar
  a sessão (`POST /api/sessions/{name}/start`); se não existir (404), cria
  primeiro com engine `NOWEB` e inicia.
- `getSessionStatus(sessionName): Promise<string>` — status bruto do WAHA
  (`STOPPED`, `STARTING`, `SCAN_QR_CODE`, `WORKING`, etc).
- `getQrCode(sessionName): Promise<string | null>` — QR em base64, quando o
  status é `SCAN_QR_CODE`.
- `logoutSession(sessionName): Promise<void>` — desconecta e limpa a sessão.
- `sendText(sessionName, numero, texto): Promise<boolean>` — equivalente ao
  `sendText` do Evolution.
- `checkNumbers(sessionName, numeros: string[]): Promise<Record<string, boolean>>`
  — equivalente ao `chat/whatsappNumbers` do Evolution.

Todas as funções leem `WAHA_API_URL`/`WAHA_API_KEY` de `process.env`, com
`AbortSignal.timeout` nas chamadas, seguindo o padrão das funções Evolution
já existentes (nenhuma classe, nenhum wrapper genérico — funções soltas, uma
por operação, como o resto do código faz com `lib/enriquecimento.ts`).

### `app/api/waha/session/route.ts` (novo)

- `GET` — resolve `conta_id` do usuário logado (mesmo padrão de
  `perfilAtual()` usado em todas as outras rotas), chama
  `getOrCreateSession` + `getSessionStatus`/`getQrCode`, retorna
  `{ status, qr }`.
- `DELETE` — chama `logoutSession`.

Rota pensada para ser chamada via polling pelo front (a cada ~2s enquanto a
tela de conexão está aberta), e uma vez ao carregar a página de
Configurações pra mostrar o status atual sem polling constante.

### `Configuracoes.tsx` (editado)

- Novo seletor "Provedor de WhatsApp" (Evolution / WAHA), grava em
  `whatsapp_provider` via a rota de configurações existente.
- Quando `waha` está selecionado: esconde os três campos do Evolution,
  mostra um bloco de conexão:
  - Botão "Conectar WhatsApp" → começa polling em `GET /api/waha/session`.
  - Enquanto `status === 'SCAN_QR_CODE'`: mostra o QR (`<img
    src="data:image/png;base64,...">`).
  - Quando `status === 'WORKING'`: mostra "Conectado" (WAHA retorna o
    número pareado em `me`, exibir se disponível) e um botão
    "Desconectar" (chama o `DELETE`).
  - Outros status (`STARTING`, `FAILED`): mensagem de espera/erro simples.

### Rotas de disparo/validação (editadas)

`disparo/route.ts`, `testar/route.ts` (caso `qual === 'whatsapp'`),
`validar/route.ts`, `busca/route.ts` (`validarWhatsApp`): cada uma ganha um
branch no início —

```ts
if (cred.whatsapp_provider === 'waha') {
  // usa lib/waha.ts com wahaSessionName(perfil.conta_id)
} else {
  // código Evolution existente, inalterado
}
```

A validação de "está configurado" também muda por provedor: Evolution
continua exigindo os três campos preenchidos; WAHA exige apenas que a
sessão esteja com `status === 'WORKING'` (checado ao vivo).

## Fluxo de dados (conectar sessão WAHA)

1. Usuário abre Configurações → Conexões, escolhe "WAHA", clica "Conectar
   WhatsApp".
2. Front chama `GET /api/waha/session`. Rota resolve `sessionName`, chama
   WAHA (cria sessão se não existir, senão só consulta), devolve status+QR.
3. Front mostra o QR e faz polling a cada ~2s.
4. Usuário escaneia no celular. WAHA (engine NOWEB) processa o pareamento
   sem depender de navegador/Puppeteer — sem o bug de `detached Frame` que
   afetava o WEBJS.
5. Próximo poll retorna `status: 'WORKING'`. Front para o polling, mostra
   "Conectado".
6. Dali em diante, `disparo`/`busca`/`validar`/`testar` no ramo `waha`
   simplesmente chamam `lib/waha.ts` passando a mesma `sessionName`
   derivada do `conta_id` — nenhum estado adicional necessário.

## Erros e limites

- Timeout/erro de rede no WAHA: mesma postura do Evolution hoje — falha
  suave, mensagem de erro amigável, nunca derruba a rota inteira.
- WAHA fora do ar / instância não responde: `GET /api/waha/session` retorna
  erro claro ("Não consegui falar com o WAHA"), sem tentar criar sessão em
  loop.
- Múltiplas contas conectadas simultaneamente: engine NOWEB não usa
  Chromium (diferente do WEBJS testado no POC), então o custo por sessão é
  bem menor — não é um problema esperado no limite atual de 1 CPU/1024M da
  VPS, mas vale observar `docker stats` se muitas contas migrarem pro WAHA
  de uma vez.

## Testes

- Self-check mínimo (ponytail): `lib/waha.ts` ganha um bloco `demo()` /
  script standalone que chama `wahaSessionName` com um UUID fixo e confere
  o formato do nome gerado (sem hífens, prefixo correto) — não depende de
  rede, só valida a função pura.
- Verificação manual ponta a ponta (não automatizável sem credenciais
  reais): criar conta de teste, trocar provedor pra WAHA, conectar via QR,
  disparar uma mensagem de teste — fica registrado em
  `09_TESTES/evidencias` como já é praxe no projeto.

## Fora de escopo

- Fluxo de criação de instância + QR para o Evolution (adiado, ver decisão
  na sessão de brainstorming).
- Qualquer webhook de eventos assíncronos do WAHA (mensagens recebidas,
  etc.) — este spec cobre só conectar a sessão e usá-la nas rotas
  existentes (pull-based, igual ao Evolution hoje).
- Migração de contas já configuradas no Evolution — o default
  `whatsapp_provider = 'evolution'` preserva o comportamento atual sem
  nenhuma ação manual.
