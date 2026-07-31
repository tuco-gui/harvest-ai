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
  conta_propria: string | null; // a conta a que ele pertence de fato
  nome: string | null;
  email: string | null;
  papel: 'super_admin' | 'admin' | 'operador';
};

/** Cookie que guarda em qual conta o super admin está trabalhando. */
export const COOKIE_CONTA = 'harvest_conta';

/** Quem está pedindo, e de qual conta. Base de toda decisão de acesso. */
export async function perfilAtual(): Promise<Perfil | null> {
  const sb = await supabaseDoUsuario();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .from('perfis')
    .select('id, conta_id, nome, email, papel')
    .eq('id', user.id)
    .single();

  if (!data) return null;

  const perfil: Perfil = { ...(data as any), conta_propria: (data as any).conta_id };

  // O super admin não pertence a conta nenhuma, então escolhe uma para
  // trabalhar. Vem de cookie, e é validada contra o banco — cookie forjado
  // com um id inexistente simplesmente não assume conta nenhuma.
  if (perfil.papel === 'super_admin') {
    const escolhida = (await cookies()).get(COOKIE_CONTA)?.value;
    if (escolhida) {
      const { data: existe } = await supabaseAdmin()
        .from('contas').select('id').eq('id', escolhida).maybeSingle();
      perfil.conta_id = existe ? escolhida : null;
    } else {
      perfil.conta_id = null;
    }
  }

  return perfil;
}
