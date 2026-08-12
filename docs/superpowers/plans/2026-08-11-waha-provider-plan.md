# WAHA como segundo provedor de WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o WAHA (rodando em `waha.figueiramarketing.com.br`, engine NOWEB) disponível como segunda opção de provedor de WhatsApp no Harvest AI, escolhida por conta, com criação de sessão e pareamento por QR Code direto na tela de Configurações — sem remover ou alterar o fluxo Evolution existente.

**Architecture:** Uma coluna nova (`whatsapp_provider`) em `conta_credenciais` é o único estado persistido. Um client server-side (`lib/waha.ts`) fala com a API REST do WAHA (`WAHA_API_URL`/`WAHA_API_KEY`, env do servidor Harvest, nunca por conta). Uma rota nova (`app/api/waha/session`) expõe GET (status+QR, cria a sessão se preciso) e DELETE (logout) para o front consultar via polling. As quatro rotas que hoje só falam com a Evolution (`disparo`, `testar`, `validar`, `busca`) ganham um branch `if (cred.whatsapp_provider === 'waha')` no topo, mantendo o caminho Evolution intocado no `else`.

**Tech Stack:** Next.js 15 App Router (route handlers), TypeScript, Supabase (`supabaseAdmin()`), `fetch` nativo com `AbortSignal.timeout`. Sem dependências novas.

## Global Constraints

- Nunca remover, renomear ou alterar comportamento do fluxo Evolution existente — ele continua BYO, sem QR, sem mudanças de schema além da coluna nova.
- `WAHA_API_URL`/`WAHA_API_KEY` são variáveis de ambiente do servidor Harvest (`process.env`), nunca lidas do Supabase, nunca expostas a client components.
- Nome de sessão WAHA é sempre derivado deterministicamente de `conta_id` via `wahaSessionName()` — nunca gravado em nenhuma tabela.
- Status/QR do WAHA são sempre consultados ao vivo na API do WAHA — nenhuma tabela de status/sessão no Supabase.
- Falha de rede/timeout com o WAHA segue a mesma postura da Evolution hoje: falha suave, mensagem amigável em português, nunca derruba a rota inteira nem lança exceção não tratada.
- Sem framework de testes no projeto (`app/package.json` só tem `typescript` em devDependencies) — o self-check de `lib/waha.ts` roda como script standalone via `node --experimental-strip-types`, sem instalar nada novo (Node 22.12 confirmado no ambiente).
- Migração SQL segue exatamente o padrão de `sql/010_linkedin_provedor.sql`: idempotente (`add column if not exists`), termina com `notify pgrst, 'reload schema';`.
- Todas as chamadas HTTP ao WAHA usam `AbortSignal.timeout(...)`, seguindo os mesmos valores já usados nas chamadas Evolution equivalentes (20–25s para consulta/validação, 30s para envio).

---

### Task 1: Migração SQL — coluna `whatsapp_provider`

**Files:**
- Create: `sql/015_whatsapp_provider.sql`

**Interfaces:**
- Produces: coluna `public.conta_credenciais.whatsapp_provider text not null default 'evolution'`, consumida por todas as tasks seguintes como `cred.whatsapp_provider`.

- [ ] **Step 1: Escrever a migração**

```sql
-- Segundo provedor de WhatsApp (WAHA, engine NOWEB) além da Evolution.
-- 'evolution' continua sendo o default — contas existentes não mudam de
-- comportamento. Idempotente.

alter table public.conta_credenciais add column if not exists whatsapp_provider text not null default 'evolution';

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar no Supabase**

Rodar o conteúdo do arquivo no SQL editor do projeto Supabase (mesmo processo usado para as migrações anteriores da pasta `sql/`).

- [ ] **Step 3: Verificar**

Consultar `select conta_id, whatsapp_provider from conta_credenciais limit 5;` e confirmar que toda linha existente veio com `'evolution'`.

- [ ] **Step 4: Commit**

```bash
git add sql/015_whatsapp_provider.sql
git commit -m "sql: adiciona whatsapp_provider em conta_credenciais"
```

---

### Task 2: `lib/waha.ts` — client do WAHA

**Files:**
- Create: `app/src/lib/waha.ts`
- Create: `app/scripts/check-waha.ts` (self-check standalone)

**Interfaces:**
- Consumes: `process.env.WAHA_API_URL`, `process.env.WAHA_API_KEY`.
- Produces (usado pelas Tasks 3 e 5):
  - `wahaSessionName(contaId: string): string`
  - `type WahaStatus = { status: string; me?: { id: string; pushName?: string } | null }`
  - `getOrCreateSession(sessionName: string): Promise<WahaStatus>`
  - `getQrCode(sessionName: string): Promise<string | null>` — retorna data URI `data:image/png;base64,...` ou `null` se o status não for `SCAN_QR_CODE`.
  - `logoutSession(sessionName: string): Promise<void>`
  - `sendText(sessionName: string, numero: string, texto: string): Promise<boolean>`
  - `checkNumbers(sessionName: string, numeros: string[]): Promise<Record<string, boolean>>`

- [ ] **Step 1: Escrever `lib/waha.ts`**

```typescript
/**
 * Client do WAHA (WhatsApp HTTP API), engine NOWEB. Infra compartilhada do
 * Harvest — WAHA_API_URL/WAHA_API_KEY são env do servidor, nunca por conta.
 * Cada conta ganha uma sessão nomeada deterministicamente a partir do
 * conta_id, nunca gravada em lugar nenhum.
 */

export type WahaStatus = {
  status: string;
  me?: { id: string; pushName?: string } | null;
};

export function wahaSessionName(contaId: string): string {
  return `conta_${contaId.replace(/-/g, '')}`;
}

function base() {
  return (process.env.WAHA_API_URL ?? '').replace(/\/+$/, '');
}

function headers() {
  return { 'Content-Type': 'application/json', 'X-Api-Key': process.env.WAHA_API_KEY ?? '' };
}

async function getStatus(sessionName: string): Promise<WahaStatus | null> {
  const r = await fetch(`${base()}/api/sessions/${sessionName}`, {
    headers: headers(),
    signal: AbortSignal.timeout(20_000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`WAHA respondeu ${r.status}`);
  return r.json();
}

/** Garante que a sessão existe e está iniciada. Cria com engine NOWEB se ainda não existir. */
export async function getOrCreateSession(sessionName: string): Promise<WahaStatus> {
  let atual = await getStatus(sessionName);
  if (!atual) {
    await fetch(`${base()}/api/sessions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: sessionName, config: { engine: { engine: 'NOWEB' } } }),
      signal: AbortSignal.timeout(20_000),
    });
    atual = await getStatus(sessionName);
  }
  if (atual?.status === 'STOPPED' || atual?.status === 'FAILED') {
    await fetch(`${base()}/api/sessions/${sessionName}/start`, {
      method: 'POST',
      headers: headers(),
      signal: AbortSignal.timeout(20_000),
    });
    atual = await getStatus(sessionName);
  }
  return atual ?? { status: 'STOPPED' };
}

/** QR em data URI, ou null se a sessão não estiver esperando pareamento. */
export async function getQrCode(sessionName: string): Promise<string | null> {
  try {
    const r = await fetch(`${base()}/api/${sessionName}/auth/qr`, {
      headers: headers(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Desconecta e apaga a sessão — próxima chamada a getOrCreateSession recria do zero. */
export async function logoutSession(sessionName: string): Promise<void> {
  await fetch(`${base()}/api/${sessionName}/logout`, {
    method: 'POST', headers: headers(), signal: AbortSignal.timeout(20_000),
  }).catch(() => {});
  await fetch(`${base()}/api/sessions/${sessionName}`, {
    method: 'DELETE', headers: headers(), signal: AbortSignal.timeout(20_000),
  }).catch(() => {});
}

function chatId(numero: string) {
  return `${numero.replace(/\D/g, '')}@c.us`;
}

export async function sendText(sessionName: string, numero: string, texto: string): Promise<boolean> {
  try {
    const r = await fetch(`${base()}/api/sendText`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ session: sessionName, chatId: chatId(numero), text: texto }),
      signal: AbortSignal.timeout(30_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function checkNumbers(sessionName: string, numeros: string[]): Promise<Record<string, boolean>> {
  const resultado: Record<string, boolean> = {};
  await Promise.all(numeros.map(async (numero) => {
    try {
      const r = await fetch(
        `${base()}/api/contacts/check-exists?session=${sessionName}&phone=${numero.replace(/\D/g, '')}`,
        { headers: headers(), signal: AbortSignal.timeout(20_000) },
      );
      if (!r.ok) { resultado[numero] = false; return; }
      const d = await r.json();
      resultado[numero] = d?.numberExists === true;
    } catch {
      resultado[numero] = false;
    }
  }));
  return resultado;
}
```

- [ ] **Step 2: Escrever o self-check standalone**

```typescript
// app/scripts/check-waha.ts
// Self-check da parte pura de lib/waha.ts (sem rede). Rodar com:
//   node --experimental-strip-types app/scripts/check-waha.ts
import assert from 'node:assert';
import { wahaSessionName } from '../src/lib/waha.ts';

const nome = wahaSessionName('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
assert.strictEqual(nome, 'conta_a1b2c3d4e5f67890abcdef1234567890');
assert.ok(!nome.includes('-'), 'nome de sessão não pode ter hífen (WAHA rejeita)');
assert.ok(nome.startsWith('conta_'));

console.log('ok: lib/waha.ts');
```

- [ ] **Step 3: Rodar o self-check**

```bash
cd "/Volumes/HD EXTERNO/FIGUEIRA/HARVEST_AI/CODIGO/harvest-ai/app" && node --experimental-strip-types scripts/check-waha.ts
```

Esperado: `ok: lib/waha.ts` impresso, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/waha.ts app/scripts/check-waha.ts
git commit -m "feat: client WAHA (lib/waha.ts) + self-check"
```

---

### Task 3: Rota `app/api/waha/session`

**Files:**
- Create: `app/src/app/api/waha/session/route.ts`

**Interfaces:**
- Consumes: `perfilAtual()`, `supabaseAdmin()` de `@/lib/supabase/server`; `wahaSessionName`, `getOrCreateSession`, `getQrCode`, `logoutSession` de `@/lib/waha`.
- Produces: `GET` → `{ status: string, qr: string | null, numero: string | null }`; `DELETE` → `{ ok: true }`. Consumido pela Task 4 (Configuracoes.tsx).

- [ ] **Step 1: Escrever a rota**

```typescript
import { NextResponse } from 'next/server';
import { perfilAtual } from '@/lib/supabase/server';
import { wahaSessionName, getOrCreateSession, getQrCode, logoutSession } from '@/lib/waha';

/**
 * Chamada via polling pelo front enquanto a tela de conexão WAHA está
 * aberta. Status/QR nunca são cacheados — sempre ao vivo na API do WAHA.
 */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const sessionName = wahaSessionName(perfil.conta_id);
  try {
    const atual = await getOrCreateSession(sessionName);
    const qr = atual.status === 'SCAN_QR_CODE' ? await getQrCode(sessionName) : null;
    return NextResponse.json({ status: atual.status, qr, numero: atual.me?.id ?? null });
  } catch {
    return NextResponse.json({ erro: 'Não consegui falar com o WAHA.' }, { status: 502 });
  }
}

export async function DELETE() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  try {
    await logoutSession(wahaSessionName(perfil.conta_id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: 'Não consegui desconectar do WAHA.' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Testar manualmente com o servidor local**

```bash
cd "/Volumes/HD EXTERNO/FIGUEIRA/HARVEST_AI/CODIGO/harvest-ai/app" && npm run dev
```

Logado numa conta de teste, chamar `GET /api/waha/session` pelo navegador ou `curl` autenticado com o cookie de sessão e conferir que retorna `{ status, qr, numero }` sem erro 500.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/waha/session/route.ts
git commit -m "feat: rota GET/DELETE /api/waha/session"
```

---

### Task 4: UI em `Configuracoes.tsx` — seletor de provedor + conexão WAHA

**Files:**
- Modify: `app/src/componentes/Configuracoes.tsx`
- Modify: `app/src/app/(app)/configuracoes/page.tsx`
- Modify: `app/src/app/api/configuracoes/route.ts`

**Interfaces:**
- Consumes: `GET /api/waha/session` → `{ status, qr, numero }` (Task 3); `DELETE /api/waha/session` → `{ ok: true }`.
- Produces: `Configuracoes` ganha prop `whatsappProvider: string`; `POST /api/configuracoes` aceita `whatsapp_provider: 'evolution' | 'waha'` no body.

- [ ] **Step 1: Aceitar `whatsapp_provider` na rota de configurações**

Em `app/src/app/api/configuracoes/route.ts`, logo após a linha do `evolution_instancia` (linha 38):

```typescript
  if (['evolution', 'waha'].includes(String(b.whatsapp_provider))) cred.whatsapp_provider = b.whatsapp_provider;
```

- [ ] **Step 2: Passar a prop no server component**

Em `app/src/app/(app)/configuracoes/page.tsx`, no bloco de props de `<Configuracoes>` (após `temEvolutionKey`, linha 72):

```typescript
      whatsappProvider={cred?.whatsapp_provider ?? 'evolution'}
```

E no `type Props` de `Configuracoes.tsx` (após `temEvolutionKey: boolean;`, linha 12):

```typescript
  whatsappProvider: string;
```

- [ ] **Step 3: Estado e seletor de provedor**

Em `Configuracoes.tsx`, adicionar estado (após `const [evoKey, ...]`, linha 39):

```typescript
  const [whatsappProvider, setWhatsappProvider] = useState(p.whatsappProvider);
  const [wahaStatus, setWahaStatus] = useState<{ status: string; qr: string | null; numero: string | null } | null>(null);
  const [wahaCarregando, setWahaCarregando] = useState(false);
```

Adicionar ao body de `salvar()` (junto de `evolution_instancia`, linha 101):

```typescript
        whatsapp_provider: whatsappProvider,
```

- [ ] **Step 4: Funções de conectar/desconectar WAHA**

Adicionar logo abaixo de `testar()` (após linha 74):

```typescript
  async function conectarWaha() {
    setWahaCarregando(true);
    const poll = async () => {
      const r = await fetch('/api/waha/session');
      const d = await r.json();
      if (!r.ok) { setWahaCarregando(false); setWahaStatus(null); return; }
      setWahaStatus(d);
      if (d.status !== 'WORKING' && d.status !== 'FAILED') {
        setTimeout(poll, 2000);
      } else {
        setWahaCarregando(false);
      }
    };
    poll();
  }

  async function desconectarWaha() {
    setWahaCarregando(true);
    await fetch('/api/waha/session', { method: 'DELETE' });
    setWahaStatus(null);
    setWahaCarregando(false);
  }
```

- [ ] **Step 5: Substituir a seção "WhatsApp" pela versão com seletor**

Substituir o bloco `<section className="secao">` do WhatsApp (linhas 162-181) por:

```typescript
          <section className="secao">
            <h2>WhatsApp</h2>
            <p className="resumo-secao">Escolha o provedor. Sem ele os números aparecem como não verificados.</p>
            <div className="cartaocfg">
              <div className="grupo">
                <label className="label" htmlFor="wa-provedor">Provedor</label>
                <select id="wa-provedor" value={whatsappProvider}
                        onChange={(e) => { setWhatsappProvider(e.target.value); setWahaStatus(null); }}
                        style={{ width: '100%', height: 46, padding: '0 12px', background: 'var(--sunken)',
                                 border: '1px solid var(--rule)', borderRadius: 2, fontSize: 15 }}>
                  <option value="evolution">Evolution API — instância própria</option>
                  <option value="waha">WAHA — conecta por QR Code aqui mesmo</option>
                </select>
              </div>

              {whatsappProvider === 'evolution' ? (
                <>
                  <div className="grupo">
                    <label className="label" htmlFor="evourl">Endereço da Evolution</label>
                    <input id="evourl" value={evoUrl} onChange={(e) => setEvoUrl(e.target.value)}
                           placeholder="https://evolution.seudominio.com.br" />
                  </div>
                  <div className="grupo">
                    <label className="label" htmlFor="evoinst">Instância</label>
                    <input id="evoinst" value={evoInst} onChange={(e) => setEvoInst(e.target.value)} />
                  </div>
                  <div className="grupo">
                    <label className="label" htmlFor="evokey">Token</label>
                    <input id="evokey" type="password" value={evoKey} onChange={(e) => setEvoKey(e.target.value)}
                           placeholder={p.temEvolutionKey ? '•••••••• já cadastrado' : 'cole o token aqui'} />
                  </div>
                </>
              ) : (
                <div className="grupo">
                  {!wahaStatus && (
                    <button type="button" className="btn-teste" disabled={wahaCarregando} onClick={conectarWaha}>
                      {wahaCarregando ? 'Conectando…' : 'Conectar WhatsApp'}
                    </button>
                  )}
                  {wahaStatus?.status === 'SCAN_QR_CODE' && wahaStatus.qr && (
                    <>
                      <p className="ajuda">Escaneie no WhatsApp do celular: Aparelhos conectados → Conectar um aparelho.</p>
                      <img src={wahaStatus.qr} alt="QR Code do WhatsApp" style={{ maxWidth: 260 }} />
                    </>
                  )}
                  {wahaStatus?.status === 'WORKING' && (
                    <>
                      <p className="ajuda">Conectado{wahaStatus.numero ? ` — ${wahaStatus.numero}` : ''}.</p>
                      <button type="button" className="btn-teste" disabled={wahaCarregando} onClick={desconectarWaha}>
                        Desconectar
                      </button>
                    </>
                  )}
                  {wahaStatus && wahaStatus.status !== 'SCAN_QR_CODE' && wahaStatus.status !== 'WORKING' && (
                    <p className="ajuda">Status: {wahaStatus.status}. Aguarde…</p>
                  )}
                </div>
              )}
            </div>
          </section>
```

- [ ] **Step 6: Testar manualmente**

```bash
cd "/Volumes/HD EXTERNO/FIGUEIRA/HARVEST_AI/CODIGO/harvest-ai/app" && npm run build
```

Esperado: build sem erro de tipo. Depois `npm run dev`, abrir Configurações → Conexões numa conta de teste, trocar para WAHA, clicar "Conectar WhatsApp", confirmar que o QR aparece e que escaneá-lo (ação manual do usuário, não do agente) muda o status para "Conectado".

- [ ] **Step 7: Commit**

```bash
git add app/src/componentes/Configuracoes.tsx app/src/app/\(app\)/configuracoes/page.tsx app/src/app/api/configuracoes/route.ts
git commit -m "feat: seletor de provedor de WhatsApp e conexão WAHA por QR em Configurações"
```

---

### Task 5: Branch WAHA nas rotas de disparo/validação

**Files:**
- Modify: `app/src/app/api/disparo/route.ts`
- Modify: `app/src/app/api/testar/route.ts`
- Modify: `app/src/app/api/validar/route.ts`
- Modify: `app/src/app/api/busca/route.ts`

**Interfaces:**
- Consumes: `wahaSessionName`, `getOrCreateSession`, `sendText`, `checkNumbers` de `@/lib/waha` (Task 2).

- [ ] **Step 1: `disparo/route.ts` — branch de validação e envio**

Import no topo (junto das outras):

```typescript
import { wahaSessionName, getOrCreateSession, sendText as wahaSendText } from '@/lib/waha';
```

Substituir o bloco de validação (linhas 31-36) por:

```typescript
  const usaWaha = cred?.whatsapp_provider === 'waha';
  if (usaWaha) {
    const status = await getOrCreateSession(wahaSessionName(perfil.conta_id));
    if (status.status !== 'WORKING') {
      return NextResponse.json(
        { erro: 'Conecte o WhatsApp (WAHA) em Configurações → Conexões.' },
        { status: 400 },
      );
    }
  } else if (!cred?.evolution_url || !cred?.evolution_instancia || !cred?.evolution_key) {
    return NextResponse.json(
      { erro: 'Falta configurar o WhatsApp em Configurações → Conexões.' },
      { status: 400 },
    );
  }
```

Substituir o bloco de envio (linhas 63-78) por:

```typescript
  let entregue = false;
  let falha: string | null = null;

  if (usaWaha) {
    entregue = await wahaSendText(wahaSessionName(perfil.conta_id), lead.telefone, mensagem);
    if (!entregue) falha = 'Não consegui falar com o WAHA.';
  } else {
    const base = cred.evolution_url.replace(/\/+$/, '');
    try {
      const r = await fetch(`${base}/message/sendText/${cred.evolution_instancia}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cred.evolution_key },
        body: JSON.stringify({ number: lead.telefone, text: mensagem }),
        signal: AbortSignal.timeout(30_000),
      });
      entregue = r.ok;
      if (!r.ok) falha = `Evolution respondeu ${r.status}`;
    } catch {
      falha = 'Não consegui falar com a Evolution.';
    }
  }
```

- [ ] **Step 2: `testar/route.ts` — branch do `qual === 'whatsapp'`**

Import no topo:

```typescript
import { wahaSessionName, getOrCreateSession, checkNumbers } from '@/lib/waha';
```

Substituir o bloco `if (qual === 'whatsapp') { ... }` (linhas 43-64) por:

```typescript
    if (qual === 'whatsapp') {
      if (c?.whatsapp_provider === 'waha') {
        const status = await getOrCreateSession(wahaSessionName(perfil.conta_id));
        if (status.status !== 'WORKING') {
          return NextResponse.json({ erro: `WAHA não está conectado (status: ${status.status}). Conecte pelo QR Code acima.` }, { status: 400 });
        }
        const chk = await checkNumbers(wahaSessionName(perfil.conta_id), ['5511999999999']);
        if (!('5511999999999' in chk)) {
          return NextResponse.json({ erro: 'WAHA não respondeu à consulta.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, recado: 'Conectado. O número está respondendo.' });
      }
      if (!c?.evolution_url || !c?.evolution_instancia || !c?.evolution_key) {
        return NextResponse.json({ erro: 'Preencha endereço, instância e token.' }, { status: 400 });
      }
      const base = c.evolution_url.replace(/\/+$/, '');
      const r = await fetch(`${base}/chat/whatsappNumbers/${c.evolution_instancia}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.evolution_key },
        body: JSON.stringify({ numbers: ['5511999999999'] }),
        signal: AbortSignal.timeout(25_000),
      });
      if (r.status === 401 || r.status === 403) {
        return NextResponse.json({ erro: 'Token recusado pela Evolution.' }, { status: 400 });
      }
      if (r.status === 404) {
        return NextResponse.json({ erro: 'Instância não encontrada nesse endereço.' }, { status: 400 });
      }
      if (!r.ok) return NextResponse.json({ erro: `Evolution respondeu ${r.status}.` }, { status: 400 });
      const d = await r.json();
      if (!Array.isArray(d)) return NextResponse.json({ erro: 'Resposta inesperada da Evolution.' }, { status: 400 });
      return NextResponse.json({ ok: true, recado: 'Conectado. O número está respondendo.' });
    }
```

- [ ] **Step 3: `validar/route.ts` — branch completo**

```typescript
import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { wahaSessionName, checkNumbers } from '@/lib/waha';

/** Valida uma leva de números na Evolution ou no WAHA, conforme o provedor da conta. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const { telefones } = await req.json().catch(() => ({}) as any);
  const lista = [...new Set((telefones ?? []).filter((t: unknown): t is string => typeof t === 'string' && !!t))];
  if (!lista.length) return NextResponse.json({ validacao: {}, validou: false });

  const { data: c } = await supabaseAdmin()
    .from('conta_credenciais')
    .select('whatsapp_provider, evolution_url, evolution_instancia, evolution_key')
    .eq('conta_id', perfil.conta_id).single();

  if (c?.whatsapp_provider === 'waha') {
    try {
      const validacao = await checkNumbers(wahaSessionName(perfil.conta_id), lista as string[]);
      return NextResponse.json({ validacao, validou: true });
    } catch {
      return NextResponse.json({ validacao: {}, validou: false });
    }
  }

  if (!c?.evolution_url || !c?.evolution_instancia || !c?.evolution_key) {
    return NextResponse.json({ validacao: {}, validou: false });
  }

  try {
    const base = c.evolution_url.replace(/\/+$/, '');
    const r = await fetch(`${base}/chat/whatsappNumbers/${c.evolution_instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: c.evolution_key },
      body: JSON.stringify({ numbers: lista }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!r.ok) return NextResponse.json({ validacao: {}, validou: false });
    const d = await r.json();
    if (!Array.isArray(d)) return NextResponse.json({ validacao: {}, validou: false });
    return NextResponse.json({
      validacao: Object.fromEntries(d.map((i: any) => [String(i.number), i.exists === true])),
      validou: true,
    });
  } catch {
    return NextResponse.json({ validacao: {}, validou: false });
  }
}
```

- [ ] **Step 4: `busca/route.ts` — branch em `validarWhatsApp`**

Lido o arquivo completo: `cred` é buscado com `select('serpapi_key, evolution_url, evolution_instancia, evolution_key')` (linha 32) e `validarWhatsApp(cred, numeros)` (linha 182) é chamado com `podeValidar = cred.evolution_url && cred.evolution_instancia && cred.evolution_key` (linha 124) — nenhum dos dois carrega `whatsapp_provider` nem `conta_id` hoje. Ambos precisam mudar.

Import no topo do arquivo (junto de `salvarLeads`):

```typescript
import { wahaSessionName, checkNumbers } from '@/lib/waha';
```

Trocar o `select` (linha 32):

```typescript
    .select('serpapi_key, evolution_url, evolution_instancia, evolution_key, whatsapp_provider')
```

Substituir a função `validarWhatsApp` inteira (linhas 182-204) por:

```typescript
async function validarWhatsApp(
  cred: {
    conta_id: string;
    whatsapp_provider: string | null;
    evolution_url: string | null;
    evolution_instancia: string | null;
    evolution_key: string | null;
  },
  numeros: (string | null)[],
): Promise<Record<string, boolean>> {
  const lista = [...new Set(numeros.filter((n): n is string => !!n))];
  if (!lista.length) return {};

  if (cred.whatsapp_provider === 'waha') {
    try {
      return await checkNumbers(wahaSessionName(cred.conta_id), lista);
    } catch {
      return {};
    }
  }

  try {
    const base = cred.evolution_url!.replace(/\/+$/, '');
    const r = await fetch(`${base}/chat/whatsappNumbers/${cred.evolution_instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cred.evolution_key! },
      body: JSON.stringify({ numbers: lista }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return {};
    const dados = await r.json();
    if (!Array.isArray(dados)) return {};
    return Object.fromEntries(dados.map((i: any) => [String(i.number), i.exists === true]));
  } catch {
    return {}; // validação é opcional: sem ela os leads vêm como "não verificado"
  }
}
```

Ajustar a chamada (linha 124-125): `cred` já vem de `.eq('conta_id', perfil.conta_id)` mas não carrega o próprio `conta_id` de volta no objeto — passar `perfil.conta_id` explicitamente:

```typescript
  const podeValidar = cred.whatsapp_provider === 'waha' || !!(cred.evolution_url && cred.evolution_instancia && cred.evolution_key);
  const zap = podeValidar ? await validarWhatsApp({ ...cred, conta_id: perfil.conta_id }, leads.map((l) => l.telefone)) : {};
```

- [ ] **Step 5: Build de sanidade**

```bash
cd "/Volumes/HD EXTERNO/FIGUEIRA/HARVEST_AI/CODIGO/harvest-ai/app" && npm run build
```

Esperado: build passa sem erros de tipo em nenhuma das quatro rotas.

- [ ] **Step 6: Verificação manual ponta a ponta**

Com uma conta de teste em `whatsapp_provider = 'waha'` e sessão conectada (Task 4): rodar uma busca, validar números, testar WhatsApp em Configurações, e disparar uma mensagem de teste real para um número próprio. Registrar o resultado em `09_TESTES/evidencias`, como já é praxe no projeto.

- [ ] **Step 7: Commit**

```bash
git add app/src/app/api/disparo/route.ts app/src/app/api/testar/route.ts app/src/app/api/validar/route.ts app/src/app/api/busca/route.ts
git commit -m "feat: rotas de disparo/validação passam a suportar WAHA além da Evolution"
```
