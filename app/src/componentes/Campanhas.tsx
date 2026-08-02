'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

export default function Campanhas({ campanhas, podeConfigurar }: { campanhas: Campanha[]; podeConfigurar: boolean }) {
  const router = useRouter();

  async function editar(c: Campanha) {
    const novo = prompt('Novo nome da campanha:', c.nome);
    if (!novo || !novo.trim() || novo.trim() === c.nome) return;
    const r = await fetch('/api/campanhas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, nome: novo.trim() }),
    });
    if (r.ok) router.refresh();
  }

  async function excluir(c: Campanha) {
    if (!confirm(`Excluir a campanha "${c.nome}"? Os leads continuam existindo, só deixam de pertencer a ela.`)) return;
    const r = await fetch('/api/campanhas', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    });
    if (r.ok) router.refresh();
  }

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
              {podeConfigurar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {campanhas.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/campanhas/${c.id}`} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                    {c.nome}
                  </Link>
                </td>
                <td style={{ color: 'var(--ink-2)' }}>{NOME_ORIGEM[c.origem] ?? c.origem}</td>
                <td style={{ color: 'var(--ink-3)' }}>{new Date(c.criado_em).toLocaleString('pt-BR')}</td>
                <td>{c.encontradas}</td>
                <td>{c.com_whatsapp}</td>
                <td style={{ color: 'var(--green)' }}>{c.enviadas}</td>
                <td style={{ color: c.erros ? 'var(--red)' : 'var(--ink-3)' }}>{c.erros}</td>
                {podeConfigurar && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="ver-detalhes" onClick={() => editar(c)}>editar</button>
                    {' · '}
                    <button type="button" className="ver-detalhes" style={{ color: 'var(--red)' }} onClick={() => excluir(c)}>
                      excluir
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!campanhas.length && (
              <tr><td colSpan={podeConfigurar ? 8 : 7} style={{ color: 'var(--ink-3)' }}>Nenhuma campanha ainda — comece uma busca em Prospecção.</td></tr>
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
