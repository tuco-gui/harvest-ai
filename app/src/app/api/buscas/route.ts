import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Limpa o histórico de pesquisas da conta. Não mexe nos leads nem nas
 *  campanhas já criadas — só a lista de termos buscados. */
export async function DELETE() {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });
  if (perfil.papel === 'operador') {
    return NextResponse.json({ erro: 'Seu perfil não limpa o histórico.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin().from('prospecta_buscas').delete().eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
