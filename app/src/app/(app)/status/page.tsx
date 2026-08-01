import { redirect } from 'next/navigation';
import { perfilAtual, supabaseAdmin } from '@/lib/supabase/server';

type Item = { nome: string; ok: boolean; detalhe: string };

export default async function Pagina() {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/entrar');

  const admin = supabaseAdmin();
  const inicio = Date.now();
  const { error: erroBanco } = await admin.from('contas').select('id').limit(1);
  const tempoBanco = Date.now() - inicio;

  const { data: smtp } = await admin.from('config_sistema').select('smtp_senha').eq('id', 1).maybeSingle();

  const itens: Item[] = [
    {
      nome: 'Banco de dados',
      ok: !erroBanco,
      detalhe: erroBanco ? erroBanco.message : `respondendo em ${tempoBanco} ms`,
    },
    {
      nome: 'E-mail do sistema (SMTP)',
      ok: !!smtp?.smtp_senha,
      detalhe: smtp?.smtp_senha ? 'configurado' : 'não configurado — convites e senhas aparecem só na tela',
    },
  ];

  if (perfil.conta_id) {
    const { data: cred } = await admin
      .from('conta_credenciais').select('serpapi_key, evolution_url, evolution_key, ia_key')
      .eq('conta_id', perfil.conta_id).maybeSingle();
    itens.push(
      { nome: 'Busca (SerpAPI)', ok: !!cred?.serpapi_key, detalhe: cred?.serpapi_key ? 'chave cadastrada' : 'sem chave — teste em Configurações' },
      { nome: 'WhatsApp (Evolution)', ok: !!(cred?.evolution_url && cred?.evolution_key), detalhe: cred?.evolution_url && cred?.evolution_key ? 'configurado' : 'sem configuração — teste em Configurações' },
      { nome: 'IA', ok: !!cred?.ia_key, detalhe: cred?.ia_key ? 'chave cadastrada' : 'sem chave — só necessária no modo "A IA escreve"' },
    );
  }

  const tudoOk = itens.every((i) => i.ok);

  return (
    <div className="pagina">
      <section className="secao">
        <h2>Status</h2>
        <p className="resumo-secao">
          {tudoOk ? 'Tudo funcionando.' : 'Alguma coisa precisa de atenção — veja abaixo.'}
        </p>

        <table className="tabela">
          <tbody>
            {itens.map((i) => (
              <tr key={i.nome}>
                <td>{i.nome}</td>
                <td>
                  <span className="selo" style={{ borderColor: i.ok ? 'var(--green)' : 'var(--red)', color: i.ok ? 'var(--green)' : 'var(--red)' }}>
                    {i.ok ? 'OK' : 'Atenção'}
                  </span>
                </td>
                <td style={{ color: 'var(--ink-3)' }}>{i.detalhe}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!perfil.conta_id && (
          <p className="ajuda" style={{ marginTop: 14 }}>
            Busca, WhatsApp e IA são configurados por conta de cliente — entre numa conta pra ver o
            status delas.
          </p>
        )}
      </section>
    </div>
  );
}
