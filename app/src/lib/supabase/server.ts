import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';
import {resolverWorkspace} from '../workspaceContexto';
import {carregarDelegacao,COOKIE_DELEGACAO,type Delegacao} from '../servicosWorkspace';

type CookieNovo = { name: string; value: string; options?: CookieOptions };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente com a sessão do usuário. A RLS decide o que ele enxerga. */
export async function supabaseDoUsuario() {
  const jar = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (novos: CookieNovo[]) => {
        try {
          novos.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Component não pode escrever cookie; o middleware renova a sessão.
        }
      },
    },
  });
}

/**
 * Cliente administrativo. Ignora RLS, então NUNCA receba conta_id do navegador —
 * derive sempre da sessão verificada, com contaDoUsuario() abaixo.
 */
export function supabaseAdmin() {
  return createClient(URL, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Perfil = {
  id: string;
  conta_id: string | null;      // conta em que ele está trabalhando agora
  conta_propria: string | null; // primeira conta do usuário (fallback legado)
  nome: string | null;
  email: string | null;
  papel: 'super_admin' | 'admin' | 'operador';
  avatar_url: string | null;
  telefone: string | null;
  senha_provisoria: boolean;
  delegacao?: Delegacao | null;
  delegacao_expirada?: boolean;
};

/** Cookie que guarda em qual conta o usuário está trabalhando. */
export const COOKIE_CONTA = 'harvest_conta';

/**
 * Resolução de workspace com fallback legado.
 *
 * Prioridade:
 * 1. Se perfis.papel = 'super_admin' → acesso global, usa cookie, SEMPRE funciona
 * 2. Se conta_usuarios existe → usa membership
 * 3. Se conta_usuarios NÃO existe → fallback para perfis.conta_id (legado)
 */
export async function perfilAtual(): Promise<Perfil | null> {
  const sb = await supabaseDoUsuario();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // 1. Identidade global (perfis)
  const { data: perfis } = await sb
    .from('perfis')
    .select('id, conta_id, nome, email, papel, avatar_url, telefone, senha_provisoria')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfis) return null;

  const papelGlobal = (perfis as any).papel as string | null;
  const ehSuperAdmin = papelGlobal === 'super_admin';

  const cookieJar = await cookies();
  const escolhida = cookieJar.get(COOKIE_CONTA)?.value;

  const admin = supabaseAdmin();

  const contexto=await resolverWorkspace(admin,{id:perfis.id,papel:papelGlobal??'operador',conta_id:perfis.conta_id},escolhida);
  const resolvido:Perfil={id:perfis.id,conta_id:contexto.contaId,conta_propria:contexto.contaPropria,
    nome:perfis.nome,email:perfis.email,papel:contexto.papel,avatar_url:perfis.avatar_url,
    telefone:perfis.telefone,senha_provisoria:perfis.senha_provisoria};
  resolvido.delegacao=await carregarDelegacao(admin,resolvido,cookieJar.get(COOKIE_DELEGACAO)?.value);
  resolvido.delegacao_expirada=ehSuperAdmin&&!!cookieJar.get(COOKIE_DELEGACAO)?.value&&!resolvido.delegacao;
  if(!ehSuperAdmin&&!escolhida&&resolvido.conta_id){try{cookieJar.set(COOKIE_CONTA,resolvido.conta_id,{httpOnly:true,sameSite:'lax',secure:true,path:'/',maxAge:60*60*12});}catch{/* Server Components usam o mesmo contexto resolvido sem gravar cookie. */}}
  return resolvido;
}
