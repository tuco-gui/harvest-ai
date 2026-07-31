import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

/** Cria uma conta de cliente. Só o super admin. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (perfil?.papel !== 'super_admin') {
    return NextResponse.json({ erro: 'Só o super admin cria contas.' }, { status: 403 });
  }

  const { nome } = await req.json().catch(() => ({}) as any);
  if (typeof nome !== 'string' || nome.trim().length < 2) {
    return NextResponse.json({ erro: 'Informe o nome da empresa.' }, { status: 400 });
  }

  // slug a partir do nome: sem acento, sem símbolo, separado por hífen
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'conta';

  const admin = supabaseAdmin();
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data } = await admin.from('contas').select('id').eq('slug', slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  const { data: conta, error } = await admin
    .from('contas').insert({ nome: nome.trim(), slug }).select('id, nome, slug').single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // já nasce com as linhas de configuração, senão a tela de Configurações
  // abriria vazia e o upsert teria que adivinhar
  await Promise.all([
    admin.from('conta_credenciais').insert({ conta_id: conta.id }),
    admin.from('conta_config_envio').insert({ conta_id: conta.id }),
  ]);

  return NextResponse.json({ conta });
}
