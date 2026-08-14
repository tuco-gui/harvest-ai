'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatarDataHora } from '@/lib/data';

type Mensagem = {
  id: number;
  conteudo: string;
  criado_em: string;
  perfis?: { nome: string | null; email: string | null; papel: string } | null;
};

type Conversa = {
  id: number;
  assunto: string;
  categoria: string;
  status: 'aberta' | 'respondida' | 'fechada';
  criado_em: string;
  prazo_sla: string;
  contas?: { nome: string } | null;
};

const NOME_STATUS: Record<string, string> = { aberta: 'Aberto', respondida: 'Respondido', fechada: 'Fechado' };

export default function ChamadoDetalhe({
  conversa, mensagens: iniciais, agoraMs: agoraInicial,
}: { conversa: Conversa; mensagens: Mensagem[]; agoraMs: number }) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState(iniciais);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Hydration-safe: a primeira renderização (SSR e hidratação do cliente)
  // usa o MESMO `agoraInicial` vindo do servidor — nunca `Date.now()` direto
  // no render, que gera valores diferentes em cada lado e quebra a
  // hidratação. Depois de montado, atualiza sozinho a cada 30s para o selo
  // "SLA vencido" não ficar desatualizado numa aba aberta por muito tempo.
  const [agoraMs, setAgoraMs] = useState(agoraInicial);
  useEffect(() => {
    const id = setInterval(() => setAgoraMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const vencido = conversa.status === 'aberta' && new Date(conversa.prazo_sla).getTime() < agoraMs;

  async function responder(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null); setEnviando(true);
    const r = await fetch(`/api/conversas/${conversa.id}/mensagens`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: texto }),
    });
    const d = await r.json();
    setEnviando(false);
    if (!r.ok) { setAviso(d.erro); return; }
    setTexto('');
    router.refresh();
    setMensagens((antes) => [...antes, {
      id: Date.now(), conteudo: texto, criado_em: new Date().toISOString(),
      perfis: { nome: 'Você', email: null, papel: '' },
    }]);
  }

  async function mudarStatus(status: 'aberta' | 'fechada') {
    setMudandoStatus(true);
    await fetch(`/api/conversas/${conversa.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setMudandoStatus(false);
    router.refresh();
  }

  return (
    <div className="pagina">
      <section className="secao">
        <h2>{conversa.assunto}</h2>
        <p className="resumo-secao">
          <span className="selo" style={{
            borderColor: vencido ? 'var(--red)' : conversa.status === 'respondida' ? 'var(--green)' : 'var(--rule-2)',
            color: vencido ? 'var(--red)' : conversa.status === 'respondida' ? 'var(--green)' : 'var(--ink-2)',
          }}>
            {vencido ? 'SLA vencido' : NOME_STATUS[conversa.status]}
          </span>
          {' '}Aberto em {formatarDataHora(conversa.criado_em)}
          {conversa.contas?.nome && <> · {conversa.contas.nome}</>}
        </p>

        <div className="cartaocfg" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 22 }}>
          {mensagens.map((m) => (
            <div key={m.id}>
              <p className="ajuda" style={{ margin: '0 0 4px' }}>
                <b style={{ color: 'var(--ink)' }}>{m.perfis?.nome || m.perfis?.email || 'Alguém'}</b>
                {' · '}{formatarDataHora(m.criado_em)}
              </p>
              <p style={{ margin: 0, fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{m.conteudo}</p>
            </div>
          ))}
        </div>

        {conversa.status !== 'fechada' ? (
          <form className="cartaocfg" onSubmit={responder}>
            <div className="grupo">
              <label className="label" htmlFor="resposta">Responder</label>
              <textarea id="resposta" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="salvar" disabled={enviando || !texto.trim()}>
                {enviando ? 'Enviando…' : 'Responder'}
              </button>
              <button type="button" className="salvar" disabled={mudandoStatus}
                      onClick={() => mudarStatus('fechada')}
                      style={{ background: 'transparent', border: '1px solid var(--rule-2)', color: 'var(--ink)' }}>
                Fechar chamado
              </button>
            </div>
          </form>
        ) : (
          <button className="salvar" disabled={mudandoStatus} onClick={() => mudarStatus('aberta')}>
            Reabrir chamado
          </button>
        )}

        {aviso && <p className="erro" style={{ marginTop: 16 }}>{aviso}</p>}
      </section>
    </div>
  );
}
