import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Cria uma campanha — o nome que o cliente dá pra uma leva de prospecção. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const nome = String(b.nome ?? '').trim();
  if (!nome) return NextResponse.json({ erro: 'Falta o nome da campanha.' }, { status: 400 });

  const origem = ['busca', 'planilha', 'manual'].includes(b.origem) ? b.origem : 'busca';
  const encontradas = Number(b.encontradas) || 0;
  const comWhatsapp = Number(b.comWhatsapp) || 0;

  const { data, error } = await supabaseAdmin()
    .from('prospecta_campanhas')
    .insert({
      conta_id: perfil.conta_id, criado_por: perfil.id, nome, origem,
      encontradas, com_whatsapp: comWhatsapp,
    })
    .select('id').single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

/** Atualiza nome e/ou os números de "encontradas"/"com WhatsApp" — chamado
 *  de novo a cada leva adicionada à mesma campanha (busca, planilha, manual). */
export async function PATCH(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  if (!b.id) return NextResponse.json({ erro: 'Falta a campanha.' }, { status: 400 });

  const dados: Record<string, unknown> = {};
  if (typeof b.nome === 'string' && b.nome.trim()) dados.nome = b.nome.trim();
  if (typeof b.encontradas === 'number') dados.encontradas = b.encontradas;
  if (typeof b.comWhatsapp === 'number') dados.com_whatsapp = b.comWhatsapp;
  if (!Object.keys(dados).length) return NextResponse.json({ ok: true });

  const { error } = await supabaseAdmin()
    .from('prospecta_campanhas').update(dados).eq('id', b.id).eq('conta_id', perfil.conta_id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
