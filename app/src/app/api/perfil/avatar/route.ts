import { NextResponse } from 'next/server';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

const TAMANHO_MAX = 3 * 1024 * 1024;

/** Sobe a foto do próprio usuário. Sempre no mesmo caminho (o id dele), então
 *  trocar a foto substitui a anterior — nunca sobra lixo no bucket. */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ erro: 'Sessão expirada.' }, { status: 401 });

  const forma = await req.formData().catch(() => null);
  const arquivo = forma?.get('arquivo');
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 });
  }
  if (!arquivo.type.startsWith('image/')) {
    return NextResponse.json({ erro: 'Envie uma imagem.' }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAX) {
    return NextResponse.json({ erro: 'Imagem maior que 3 MB.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const bytes = Buffer.from(await arquivo.arrayBuffer());

  const { error: erroUpload } = await admin.storage
    .from('avatares')
    .upload(perfil.id, bytes, { contentType: arquivo.type, upsert: true });
  if (erroUpload) return NextResponse.json({ erro: erroUpload.message }, { status: 500 });

  // cache-bust: o navegador não sabe que o conteúdo mudou se a URL for igual
  const url = `${admin.storage.from('avatares').getPublicUrl(perfil.id).data.publicUrl}?v=${Date.now()}`;

  const { error: erroPerfil } = await admin.from('perfis').update({ avatar_url: url }).eq('id', perfil.id);
  if (erroPerfil) return NextResponse.json({ erro: erroPerfil.message }, { status: 500 });

  return NextResponse.json({ avatar_url: url });
}
