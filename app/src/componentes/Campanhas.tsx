'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Modal from './Modal';

type Canal = { id: number; nome: string; provider: string; ativo: boolean; padrao: boolean };

type Campanha = {
  id: number;
  nome: string;
  origem: string;
  criado_em: string;
  encontradas: number;
  com_whatsapp: number;
  enviadas: number;
  erros: number;
  bloqueados: number;
  respondeu: number;
  modo_envio_numero?: string | null;
  canal_ids?: number[] | null;
  tipo?: string;
  status?: string;
  leadsContatados?: number;
};

const NOME_ORIGEM: Record<string, string> = { busca: 'Busca', planilha: 'Planilha', manual: 'Manual' };

export default function Campanhas({
  campanhas, arquivadas = [], listas = [], podeConfigurar, canais,
}: {
  campanhas: Campanha[]; arquivadas?: Campanha[]; listas?: Campanha[]; podeConfigurar: boolean; canais: Canal[];
}) {
  const router = useRouter();
  const [paraArquivar, setParaArquivar] = useState<Campanha | null>(null);
  const [arquivando, setArquivando] = useState(false);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  async function promoverParaCampanha(l: Campanha) {
    const r = await fetch('/api/campanhas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, tipo: 'campanha' }),
    });
    if (r.ok) router.refresh();
  }

  async function confirmarArquivar() {
    if (!paraArquivar) return;
    setArquivando(true);
    try {
      const r = await fetch('/api/campanhas', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: paraArquivar.id }),
      });
      if (r.ok) {
        setParaArquivar(null);
        router.refresh();
      }
    } finally {
      setArquivando(false);
    }
  }

  const temHistorico = (c: Campanha) =>
    (c.enviadas ?? 0) > 0 || (c.respondeu ?? 0) > 0 || (c.bloqueados ?? 0) > 0 || (c.erros ?? 0) > 0;

  return (
    <div className="pagina pagina-larga">
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
              <th>Encontradas</th><th>WhatsApp verificado</th><th>Enviadas</th><th>Erro</th><th>Bloqueado</th><th>Respondeu</th>
              {podeConfigurar && <th style={{ textAlign: 'right' }}>Ações</th>}
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
                <td style={{ color: 'var(--ink-3)' }}>{new Date(c.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td>{c.encontradas}</td>
                <td>{c.com_whatsapp}</td>
                <td style={{ color: 'var(--green)' }}>{c.enviadas}</td>
                <td style={{ color: c.erros ? 'var(--red)' : 'var(--ink-3)' }}>{c.erros}</td>
                <td style={{ color: c.bloqueados ? 'var(--ink-2)' : 'var(--ink-3)' }}>{c.bloqueados}</td>
                <td style={{ color: c.respondeu ? 'var(--ink)' : 'var(--ink-3)' }}>{c.respondeu}</td>
                {podeConfigurar && (
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <Link href={`/campanhas/${c.id}`} title="Visualizar" aria-label="Visualizar" className="acao-icone">
                      👁
                    </Link>
                    {' '}
                    <Link href={`/campanhas/${c.id}/editar`} title="Editar" aria-label="Editar" className="acao-icone">
                      ✎
                    </Link>
                    {' '}
                    <button
                      type="button" title="Arquivar" aria-label="Arquivar"
                      className="acao-icone acao-icone-perigo"
                      onClick={() => setParaArquivar(c)}
                    >
                      🗄
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!campanhas.length && (
              <tr><td colSpan={podeConfigurar ? 10 : 9} style={{ color: 'var(--ink-3)' }}>Nenhuma campanha ativa — comece uma busca em Prospecção.</td></tr>
            )}
          </tbody>
        </table>

        <p className="ajuda" style={{ marginTop: 14 }}>
          "Respondeu" conta quantos leads da campanha mandaram qualquer mensagem de volta (Fase 3C) —
          não precisa de agente de resposta para isso. Quem pede "parar / não perturbe" vira
          opt-out automático (bloqueado) e não recebe mais disparo. O envio usa o número (canal)
          selecionado na campanha — veja em "Número de envio" ao abrir a campanha. Sem canal
          conectado, o disparo avisa antes de falhar.
        </p>
      </section>

      {arquivadas.length > 0 && (
        <section className="secao" style={{ marginTop: 24 }}>
          <button
            type="button" className="ver-detalhes"
            onClick={() => setMostrarArquivadas((v) => !v)}
          >
            {mostrarArquivadas ? '▾' : '▸'} Arquivadas ({arquivadas.length})
          </button>
          {mostrarArquivadas && (
            <table className="tabela" style={{ marginTop: 10 }}>
              <thead>
                <tr><th>Campanha</th><th>Origem</th><th>Quando</th><th>Enviadas</th><th>Respondeu</th><th></th></tr>
              </thead>
              <tbody>
                {arquivadas.map((c) => (
                  <tr key={c.id} style={{ color: 'var(--ink-3)' }}>
                    <td>{c.nome}</td>
                    <td>{NOME_ORIGEM[c.origem] ?? c.origem}</td>
                    <td>{new Date(c.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                    <td>{c.enviadas}</td>
                    <td>{c.respondeu}</td>
                    <td>
                      <Link href={`/campanhas/${c.id}`} className="acao-icone" title="Visualizar" aria-label="Visualizar">
                        👁
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {listas.length > 0 && (
        <section className="secao" style={{ marginTop: 24 }}>
          <h2>Listas salvas</h2>
          <p className="resumo-secao">
            Leads salvos de uma pesquisa sem virar campanha ainda — sem número, mensagem ou cadência
            configurados. Promova uma lista para campanha quando decidir trabalhar esses leads.
          </p>
          <table className="tabela">
            <thead>
              <tr><th>Lista</th><th>Origem</th><th>Quando</th><th>Leads</th>{podeConfigurar && <th></th>}</tr>
            </thead>
            <tbody>
              {listas.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/campanhas/${l.id}`} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                      {l.nome}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--ink-2)' }}>{NOME_ORIGEM[l.origem] ?? l.origem}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{new Date(l.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                  <td>{l.encontradas}</td>
                  {podeConfigurar && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="ver-detalhes" onClick={() => promoverParaCampanha(l)}>
                        criar campanha
                      </button>
                      {' · '}
                      <Link href={`/campanhas/${l.id}/editar`} className="ver-detalhes">editar</Link>
                      {' · '}
                      <button type="button" className="ver-detalhes" style={{ color: 'var(--red)' }} onClick={() => setParaArquivar(l)}>
                        arquivar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Modal
        titulo="Arquivar campanha"
        aberto={!!paraArquivar}
        onFechar={() => setParaArquivar(null)}
      >
        {paraArquivar && (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 10px' }}>
              Arquivar <strong>{paraArquivar.nome}</strong>?
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 14px' }}>
              {temHistorico(paraArquivar)
                ? 'Esta campanha já tem disparos, respostas ou opt-outs registrados. O histórico é preservado — ela só sai da listagem ativa e passa para "Arquivadas".'
                : 'A campanha e seus leads continuam existindo — ela só sai da listagem ativa e passa para "Arquivadas". Nada é excluído.'}
            </p>
            <div className="modal-acoes">
              <button type="button" onClick={() => setParaArquivar(null)} disabled={arquivando}>Cancelar</button>
              <button type="button" className="perigo" onClick={confirmarArquivar} disabled={arquivando}>
                {arquivando ? 'Arquivando…' : 'Arquivar'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
