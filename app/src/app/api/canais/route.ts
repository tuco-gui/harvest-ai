import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import { carregarCanais } from '@/lib/whatsappCanais';

/**
 * Lista os canais WhatsApp da conta ativa (ou todas, se super_admin sem conta
 * escolhida — mas o uso é sempre por conta). Operador pode ler (precisa ver o
 * número de onde saiu), só não cria/edita (vide PATCH/POST).
 */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (!perfil.conta_id) return NextResponse.json({ canais: [] });

  const admin = supabaseAdmin();
  const canais = await carregarCanais(admin, perfil.conta_id);
  return NextResponse.json({ canais });
}

/** Cria um canal de WhatsApp na conta ativa. Só admin da conta ou super_admin. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não cria canais de WhatsApp.' }, { status: 403 });
  }
  if (!perfil.conta_id) {
    return NextResponse.json({ erro: 'Escolha uma conta antes de conectar um número.' }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}) as Record<string, unknown>);
  const admin = supabaseAdmin();
  const conta = perfil.conta_id;

  const nome = typeof b.nome === 'string' && b.nome.trim() ? b.nome.trim() : 'Principal';
  const provider = b.provider === 'evolution' ? 'evolution' : 'waha';
  const numero = typeof b.numero === 'string' && b.numero.trim() ? b.numero.trim() : null;
  const identificador =
    provider === 'evolution' && typeof b.identificador_externo === 'string' && b.identificador_externo.trim()
      ? b.identificador_externo.trim()
      : null;
  const padrao = b.padrao === true;

  // Se marcou como padrão, tira o padrão dos outros da mesma conta (1 só).
  if (padrao) {
    await admin.from('whatsapp_canais').update({ padrao: false }).eq('conta_id', conta);
  }

  const { data, error } = await admin
    .from('whatsapp_canais')
    .insert({
      conta_id: conta,
      nome,
      provider,
      numero,
      identificador_externo: identificador,
      status: 'desconhecido',
      ativo: true,
      padrao,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ canal: data });
}
