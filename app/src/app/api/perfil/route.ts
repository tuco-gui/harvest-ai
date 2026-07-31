import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Nome, telefone e e-mail do próprio perfil. O e-mail muda em dois lugares
 *  (auth.users e a cópia em perfis) — feito aqui, no servidor, para não
 *  deixar as duas tabelas divergentes se uma chamada falhar e a outra não. */
export async function PATCH(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const b = await req.json().catch(() => ({}) as any);
  const admin = supabaseAdmin();

  if (typeof b.email === 'string' && b.email.trim() && b.email.trim() !== perfil.email) {
    const email = b.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(perfil.id, { email, email_confirm: true });
    if (error) {
      const jaExiste = /already been registered|already exists/i.test(error.message);
      return NextResponse.json({ erro: jaExiste ? 'Já existe usuário com esse e-mail.' : error.message }, { status: 400 });
    }
  }

  const dados: Record<string, unknown> = {};
  if (typeof b.nome === 'string') dados.nome = b.nome.trim() || null;
  if (typeof b.telefone === 'string') dados.telefone = b.telefone.replace(/\D/g, '') || null;
  if (typeof b.email === 'string' && b.email.trim()) dados.email = b.email.trim().toLowerCase();

  if (Object.keys(dados).length) {
    const { error } = await admin.from('perfis').update(dados).eq('id', perfil.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
