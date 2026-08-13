import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

type CookieNovo = { name: string; value: string; options?: CookieOptions };

/** Renova a sessão a cada requisição e barra quem não entrou. */
export async function middleware(req: NextRequest) {
  // Webhooks inbound (Fase 3B) são chamados pelo WAHA/Evolution — não têm
  // (e não podem ter) cookie de sessão do Harvest. Autenticação deles é
  // própria (HMAC/token, ver lib/inboundSeguranca.ts), verificada dentro da
  // própria rota. Sem este bypass, o redirect de "não logado" abaixo
  // interceptava a chamada antes de chegar na rota — webhook nunca seria
  // processado, só redirecionado para /entrar. Descoberto no QA de
  // produção da Fase 3B.
  if (req.nextUrl.pathname.startsWith('/api/webhook/')) {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (novos: CookieNovo[]) => {
          novos.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          novos.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await sb.auth.getUser();
  const ehLogin = req.nextUrl.pathname.startsWith('/entrar');

  if (!user && !ehLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/entrar';
    return NextResponse.redirect(url);
  }
  if (user && ehLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
};
