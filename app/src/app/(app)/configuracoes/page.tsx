import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';
import Configuracoes from '@/componentes/Configuracoes';

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  // Operador não alcança credencial nem regra de envio — é o que impede
  // quem opera no dia a dia de quebrar a configuração sem querer.
  if (perfil.papel === 'operador') {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, letterSpacing: '-.02em' }}>
          Configurações
        </h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
          Só o administrador da conta altera chaves e regras de envio. Fale com ele se algo precisa mudar.
        </p>
      </div>
    );
  }

  if (!perfil.conta_id) {
    return (
      <div className="pagina">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Configurações</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, maxWidth: 460 }}>
          Configurações são por conta de cliente. Escolha uma no seletor ao lado do logo, ou vá em
          Contas para criar a primeira.
        </p>
      </div>
    );
  }

  const admin = supabaseAdmin();
  const [{ data: cred }, { data: envio }] = await Promise.all([
    admin.from('conta_credenciais').select('*').eq('conta_id', perfil.conta_id).single(),
    admin.from('conta_config_envio').select('*').eq('conta_id', perfil.conta_id).single(),
  ]);

  return (
    <Configuracoes
      temSerpapi={!!cred?.serpapi_key}
      evolutionUrl={cred?.evolution_url ?? ''}
      evolutionInstancia={cred?.evolution_instancia ?? ''}
      temEvolutionKey={!!cred?.evolution_key}
      temOpenai={!!cred?.openai_key}
      modo={envio?.modo ?? 'ia'}
      mensagens={(envio?.mensagens as string[]) ?? []}
      contexto={envio?.contexto ?? ''}
      intervaloMin={envio?.intervalo_min ?? 30}
      intervaloMax={envio?.intervalo_max ?? 60}
    />
  );
}
