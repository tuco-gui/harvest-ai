import { timingSafeEqual } from 'node:crypto';

/** Allowlist de workspaces explícita para chamadas servidor-servidor do n8n. */
export function autenticarN8nBDR(authorization: string | null, contaId: unknown): contaId is string {
  const token = process.env.BDR_N8N_TOKEN;
  if (!token || token.length<32 || typeof contaId!=='string' ||
    !/^[0-9a-f-]{36}$/i.test(contaId) ||
    !(process.env.BDR_N8N_WORKSPACES??'').split(',').map(x=>x.trim()).includes(contaId)) return false;
  const a = Buffer.from(authorization??''); const b = Buffer.from(`Bearer ${token}`);
  return a.length===b.length && timingSafeEqual(a,b);
}
