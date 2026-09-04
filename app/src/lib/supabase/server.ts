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
  conta_id: string | null;      // conta em que ele está trabalhando agora (membership)
  conta_propria: string | null; // primeira conta do usuário (fallback legado)
  nome: string | null;
  email: string | null;
  papel: 'super_admin' | 'admin' | 'operador'; // papel NA CONTA ATUAL (membership)
  avatar_url: string | null;
  telefone: string | null;
  senha_provisoria: boolean;
};

/** Cookie que guarda em qual conta o usuário está trabalhando. */
export const COOKIE_CONTA = 'harvest_conta';

/**
 * Quem está pedindo, e de qual conta. Base de toda decisão de acesso.
 *
 * Resolução (pós-migration 027 — multi-workspace):
 * 1. Identidade global → perfis (id, nome, email, avatar, etc.)
 * 2. Workspace ativa → cookie harvest_conta → conta_usuarios
 * 3. Se super_admin sem cookie → null (precisa escolher)
 * 4. Se usuário comum sem cookie → primeira membership ativa (auto-select)
 */
export async function perfilAtual(): Promise<Perfil | null> {
  const sb = await supabaseDoUsuario();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // 1. Identidade global (perfis)
  const { data: perfis } = await sb
    .from('perfis')
    .select('id, nome, email, avatar_url, telefone, senha_provisoria')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfis) return null;

  // 2. Buscar memberships ativas do usuário
  const admin = supabaseAdmin();
  const { data: memberships } = await admin
    .from('conta_usuarios')
    .select('conta_id, papel')
    .eq('user_id', user.id)
    .eq('ativo', true);

  const ehSuperAdmin = (memberships ?? []).some(m => m.papel === 'super_admin');

  // 3. Resolver workspace ativa
  const cookieJar = await cookies();
  const escolhida = cookieJar.get(COOKIE_CONTA)?.value;

  let contaIdAtiva: string | null = null;
  let papelAtivo: 'super_admin' | 'admin' | 'operador' = 'operador';

  if (ehSuperAdmin) {
    // Super admin: usa cookie se fornecido, senão null (precisa escolher)
    if (escolhida) {
      const { data: existe } = await admin
        .from('contas').select('id').eq('id', escolhida).maybeSingle();
      if (existe) {
        contaIdAtiva = escolhida;
        papelAtivo = 'super_admin';
      }
    }
  } else if (escolhida) {
    // Usuário comum com cookie: valida membership
    const membro = (memberships ?? []).find(m => m.conta_id === escolhida);
    if (membro) {
      contaIdAtiva = membro.conta_id;
      papelAtivo = membro.papel as 'admin' | 'operador';
    }
  } else if (memberships && memberships.length > 0) {
    // Sem cookie: auto-select se só tem 1 membership
    if (memberships.length === 1) {
      contaIdAtiva = memberships[0].conta_id;
      papelAtivo = memberships[0].papel as 'admin' | 'operador';
      // Salvar cookie para próximas requests
      cookieJar.set(COOKIE_CONTA, contaIdAtiva!, {
        httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
      });
    }
    // Se tem mais de 1 e nenhum cookie → contaIdAtiva = null (precisa escolher)
  }

  // conta_propria = primeira membership (ou null se super_admin sem memberships)
  const contaPropria = memberships && memberships.length > 0
    ? memberships[0].conta_id
    : null;

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
