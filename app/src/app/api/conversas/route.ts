import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

const HORAS_SLA = 4;

/** Abre um chamado. Qualquer papel pode — inclusive operador, que é quem
 *  mais esbarra em problema no dia a dia. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil?.conta_id) return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const b = await req.json().catch(() => ({}) as any);
  const assunto = String(b.assunto ?? '').trim();
  const mensagem = String(b.mensagem ?? '').trim();
  if (!assunto || !mensagem) return NextResponse.json({ erro: 'Preencha o assunto e a mensagem.' }, { status: 400 });

  const categoria = ['duvida', 'tecnico', 'financeiro', 'outro'].includes(b.categoria) ? b.categoria : 'duvida';
  const admin = supabaseAdmin();

  const prazoSla = new Date(Date.now() + HORAS_SLA * 3600_000).toISOString();
  const { data: conversa, error } = await admin
    .from('conversas')
    .insert({ conta_id: perfil.conta_id, aberto_por: perfil.id, assunto, categoria, prazo_sla: prazoSla })
    .select('id').single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await admin.from('conversa_mensagens').insert({ conversa_id: conversa.id, autor_id: perfil.id, conteudo: mensagem });

  return NextResponse.json({ id: conversa.id });
}

/** Lista os chamados. Dentro de uma conta, só os dela. Super admin sem
 *  conta ativa vê todos, de todas as contas — a visão "da ferramenta inteira". */
export async function GET() {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const admin = supabaseAdmin();
  let query = admin
    .from('conversas')
    .select('id, conta_id, assunto, categoria, status, criado_em, prazo_sla, respondido_em, contas(nome)')
    .order('criado_em', { ascending: false });

  if (perfil.conta_id) query = query.eq('conta_id', perfil.conta_id);
  else if (perfil.papel !== 'super_admin') return NextResponse.json({ erro: 'Escolha uma conta.' }, { status: 400 });

  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ conversas: data ?? [] });
}
