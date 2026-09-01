import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Guarda de segurança "fail-closed" por conta (ADR-009). Substitui o antigo
 * guard global por env var (WHATSAPP_MODE/WHATSAPP_QA_WHITELIST) — este
 * projeto não tem mais um deploy de staging separado; testes rodam dentro da
 * própria produção, numa conta marcada como contas.ambiente = 'teste'.
 *
 * Regra: se a conta está marcada como 'teste', todo disparo só é permitido
 * se o telefone (E.164, só dígitos) estiver na whitelist da conta
 * (contas.whatsapp_qa_whitelist, lista separada por vírgula). Fora da
 * whitelist → bloqueado, sem exceção.
 *
 * Contas 'producao' (padrão) sempre liberam — não altera comportamento.
 */
export async function envioPermitidoNoAmbiente(
  admin: SupabaseClient,
  contaId: string,
  telefone: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: conta } = await admin
    .from('contas')
    .select('ambiente, whatsapp_qa_whitelist')
    .eq('id', contaId)
    .maybeSingle();
  if (conta?.ambiente !== 'teste') return { ok: true };

  const bruta = conta.whatsapp_qa_whitelist ?? '';
  const whitelist = new Set(
    bruta.split(',').map((n: string) => n.replace(/\D/g, '')).filter(Boolean),
  );
  const digitos = telefone.replace(/\D/g, '');

  if (whitelist.has(digitos)) return { ok: true };
  return {
    ok: false,
    motivo: 'Esta é uma conta de teste: só pode enviar para números da whitelist de QA da conta.',
  };
}
