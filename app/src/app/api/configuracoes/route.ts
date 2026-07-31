import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Grava credenciais e regra de envio da conta. Operador não passa daqui. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não altera configurações.' }, { status: 403 });
  }
  if (!perfil.conta_id) {
    return NextResponse.json({ erro: 'Escolha uma conta de cliente antes de configurar.' }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}) as Record<string, unknown>);
  const admin = supabaseAdmin();
  const conta = perfil.conta_id;

  // Chave em branco significa "não mexer". Só grava o que veio preenchido,
  // senão salvar a aba de envios apagaria as chaves sem querer.
  const cred: Record<string, unknown> = { conta_id: conta, atualizado_em: new Date().toISOString() };
  if (typeof b.serpapi_key === 'string' && b.serpapi_key) cred.serpapi_key = b.serpapi_key.trim();
  if (typeof b.evolution_key === 'string' && b.evolution_key) cred.evolution_key = b.evolution_key.trim();
  if (typeof b.evolution_url === 'string') cred.evolution_url = b.evolution_url.trim() || null;
  if (typeof b.evolution_instancia === 'string') cred.evolution_instancia = b.evolution_instancia.trim() || null;

  const min = Number(b.intervalo_min) || 30;
  const max = Number(b.intervalo_max) || 60;
  if (min < 5 || min >= max) {
    return NextResponse.json({ erro: 'Intervalo inválido.' }, { status: 400 });
  }

  const modo = ['fixa', 'rodizio', 'ia'].includes(String(b.modo)) ? String(b.modo) : 'ia';
  const mensagens = Array.isArray(b.mensagens) ? (b.mensagens as unknown[]).filter((m): m is string => typeof m === 'string') : [];
  if (modo !== 'ia' && !mensagens.length) {
    return NextResponse.json({ erro: 'Cadastre pelo menos uma mensagem.' }, { status: 400 });
  }

  const [a, c] = await Promise.all([
    admin.from('conta_credenciais').upsert(cred, { onConflict: 'conta_id' }),
    admin.from('conta_config_envio').upsert({
      conta_id: conta,
      atualizado_em: new Date().toISOString(),
      modo,
      mensagens,
      contexto: typeof b.contexto === 'string' ? b.contexto : null,
      intervalo_min: min,
      intervalo_max: max,
    }, { onConflict: 'conta_id' }),
  ]);

  if (a.error || c.error) {
    return NextResponse.json({ erro: a.error?.message ?? c.error?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
