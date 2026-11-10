import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import { rotaPublicaSemSessao } from '@/lib/rotasPublicas';
import {resolverWorkspace} from '@/lib/workspaceContexto';
import {autorizarRequisicao} from '@/lib/recursosHttp';
import {COOKIE_DELEGACAO} from '@/lib/servicosWorkspace';
import {requerInspecaoCorpo,rotaSemContrato} from '@/lib/recursosRotas';

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
  if (req.nextUrl.pathname.startsWith('/api/webhook/') ||
      req.nextUrl.pathname === '/api/auth/esqueci-senha') {
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
  const ehLogin = req.nextUrl.pathname === '/entrar';
  const publica = rotaPublicaSemSessao(req.nextUrl.pathname);

  if (!user && !publica) {
    const url = req.nextUrl.clone();
    url.pathname = '/entrar';
    return NextResponse.redirect(url);
  }
  if (user && ehLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  if(user&&!ehLogin&&!rotaSemContrato(req.nextUrl.pathname)){
    try{
      const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data:p,error}=await admin.from('perfis').select('id,papel,conta_id').eq('id',user.id).maybeSingle();
      if(error||!p)return NextResponse.json({erro:'Sessão sem perfil autorizado.'},{status:403});
      const contexto=await resolverWorkspace(admin,p,req.cookies.get('harvest_conta')?.value);
      let body:Record<string,unknown>={};
      if(!['GET','HEAD','OPTIONS'].includes(req.method)&&requerInspecaoCorpo(req.nextUrl.pathname)){
        const clone=req.clone();const reader=clone.body?.getReader();let texto='';let bytes=0;const dec=new TextDecoder();
        if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>65536){void reader.cancel();return NextResponse.json({erro:'Configuração muito grande.'},{status:413});}texto+=dec.decode(chunk.value,{stream:true});}
        try{const b=JSON.parse(texto);if(b&&typeof b==='object'&&!Array.isArray(b))body=b;}catch{}
      }
      const acesso=await autorizarRequisicao(admin,{id:p.id,papel:contexto.papel,conta_id:contexto.contaId},req.nextUrl.pathname,req.method,body,req.cookies.get(COOKIE_DELEGACAO)?.value);
      if(!acesso.ok)return NextResponse.json({erro:acesso.erro},{status:acesso.status??403});
    }catch{return NextResponse.json({erro:'Não foi possível verificar os serviços da workspace.'},{status:503});}
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
};
