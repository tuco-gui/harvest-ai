import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';

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

  // 2. SUPER ADMIN: acesso global, SEMPRE funciona
  if (ehSuperAdmin) {
    let contaIdAtiva: string | null = null;

    if (escolhida) {
      // Validar que a conta existe e está ativa
      const { data: existe } = await admin
        .from('contas').select('id').eq('id', escolhida).eq('ativo', true).maybeSingle();
      if (existe) {
        contaIdAtiva = escolhida;
      }
    }

    return {
      id: perfis.id,
      conta_id: contaIdAtiva,
      conta_propria: null,
      nome: perfis.nome,
      email: perfis.email,
      papel: 'super_admin',
      avatar_url: perfis.avatar_url,
      telefone: perfis.telefone,
      senha_provisoria: perfis.senha_provisoria,
    };
  }

  // 3. Usuário comum: tentar conta_usuarios (multi-workspace)
  const { data: memberships, error: memError } = await admin
    .from('conta_usuarios')
    .select('conta_id, papel')
    .eq('user_id', user.id)
    .eq('ativo', true);

  // Se a tabela não existe ou deu erro, fallback para perfis.conta_id (legado)
  if (memError || !memberships) {
    const papel = (papelGlobal ?? 'operador') as 'admin' | 'operador';
    return {
      id: perfis.id,
      conta_id: (perfis as any).conta_id ?? null,
      conta_propria: (perfis as any).conta_id ?? null,
      nome: perfis.nome,
      email: perfis.email,
      papel,
      avatar_url: perfis.avatar_url,
      telefone: perfis.telefone,
      senha_provisoria: perfis.senha_provisoria,
    };
  }

  // 4. Usuário com memberships
  let contaIdAtiva: string | null = null;
  let papelAtivo: 'admin' | 'operador' = 'operador';

  if (escolhida) {
    // Validar membership para a conta escolhida
    const membro = memberships.find(m => m.conta_id === escolhida);
    if (membro) {
      contaIdAtiva = membro.conta_id;
      papelAtivo = membro.papel as 'admin' | 'operador';
    }
  } else if (memberships.length > 0) {
    // Auto-select se só tem 1 membership
    if (memberships.length === 1) {
      contaIdAtiva = memberships[0].conta_id;
      papelAtivo = memberships[0].papel as 'admin' | 'operador';
      cookieJar.set(COOKIE_CONTA, contaIdAtiva!, {
        httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
      });
    }
  }

  const contaPropria = memberships.length > 0 ? memberships[0].conta_id : null;

  return {
    id: perfis.id,
    conta_id: contaIdAtiva,
    conta_propria: contaPropria,
    nome: perfis.nome,
    email: perfis.email,
    papel: papelAtivo,
    avatar_url: perfis.avatar_url,
    telefone: perfis.telefone,
    senha_provisoria: perfis.senha_provisoria,
  };
}
