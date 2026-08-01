'use client';

type Campanha = {
  id: number;
  nome: string;
  origem: string;
  criado_em: string;
  encontradas: number;
  com_whatsapp: number;
  enviadas: number;
  erros: number;
};

const NOME_ORIGEM: Record<string, string> = { busca: 'Busca', planilha: 'Planilha', manual: 'Manual' };

export default function Campanhas({ campanhas }: { campanhas: Campanha[] }) {
  return (
    <div className="pagina">
      <section className="secao">
        <h2>Campanhas</h2>
        <p className="resumo-secao">
          Cada busca, planilha importada ou lista manual vira uma campanha — o funil completo dela
          fica registrado aqui, do quanto foi encontrado até quanto foi enviado.
        </p>

        <table className="tabela">
          <thead>
            <tr>
              <th>Campanha</th><th>Origem</th><th>Quando</th>
              <th>Encontradas</th><th>Com WhatsApp</th><th>Enviadas</th><th>Erro</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.map((c) => (
              <tr key={c.id}>
                <td><b style={{ fontWeight: 600 }}>{c.nome}</b></td>
                <td style={{ color: 'var(--ink-2)' }}>{NOME_ORIGEM[c.origem] ?? c.origem}</td>
                <td style={{ color: 'var(--ink-3)' }}>{new Date(c.criado_em).toLocaleString('pt-BR')}</td>
                <td>{c.encontradas}</td>
                <td>{c.com_whatsapp}</td>
                <td style={{ color: 'var(--green)' }}>{c.enviadas}</td>
                <td style={{ color: c.erros ? 'var(--red)' : 'var(--ink-3)' }}>{c.erros}</td>
              </tr>
            ))}
            {!campanhas.length && (
              <tr><td colSpan={7} style={{ color: 'var(--ink-3)' }}>Nenhuma campanha ainda — comece uma busca em Prospecção.</td></tr>
            )}
          </tbody>
        </table>

        <p className="ajuda" style={{ marginTop: 14 }}>
          "Quem respondeu" ainda não existe — depende do agente de resposta, que ainda não escuta
          o que o lead manda de volta.
        </p>
      </section>
    </div>
  );
}
