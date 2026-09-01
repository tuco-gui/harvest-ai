'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Smtp = { host: string; porta: number; usuario: string; remetente: string; replyTo: string; temSenha: boolean };

export default function Sistema({ smtp }: { smtp: Smtp }) {
  const router = useRouter();

  const [smtpHost, setSmtpHost] = useState(smtp.host);
  const [smtpPorta, setSmtpPorta] = useState(smtp.porta);
  const [smtpUsuario, setSmtpUsuario] = useState(smtp.usuario);
  const [smtpSenha, setSmtpSenha] = useState('');
  const [smtpRemetente, setSmtpRemetente] = useState(smtp.remetente);
  const [smtpReplyTo, setSmtpReplyTo] = useState(smtp.replyTo);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  async function salvarSmtp(e: React.FormEvent) {
    e.preventDefault();
    setRecado(null); setSalvando(true);
    const r = await fetch('/api/sistema/smtp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtp_host: smtpHost, smtp_porta: smtpPorta, smtp_usuario: smtpUsuario,
        smtp_senha: smtpSenha || undefined, smtp_remetente: smtpRemetente,
        smtp_reply_to: smtpReplyTo,
      }),
    });
    const d = await r.json();
    setSalvando(false);
    setRecado(r.ok ? 'Configuração salva.' : d.erro);
    if (r.ok) { setSmtpSenha(''); router.refresh(); }
  }

  async function testarSmtp() {
    setRecado(null); setTestando(true);
    const r = await fetch('/api/sistema/smtp', { method: 'PUT' });
    const d = await r.json();
    setTestando(false);
    setRecado(r.ok ? d.recado : d.erro);
  }

  return (
    <div className="pagina">
      <section className="secao">
        <h2>E-mail do sistema (SMTP)</h2>
        <p className="resumo-secao">
          Um servidor de e-mail só, para o Harvest AI inteiro — não é por conta de cliente. Assim
          que estiver salvo e testado, convites e senhas novas passam a sair por e-mail sozinhos.
        </p>
        <form className="cartaocfg" onSubmit={salvarSmtp}>
          <div className="linha-form">
            <div className="grupo">
              <label className="label" htmlFor="sh">Host</label>
              <input id="sh" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)}
                     placeholder="smtp.seudominio.com.br" />
            </div>
            <div className="grupo" style={{ maxWidth: 120 }}>
              <label className="label" htmlFor="sp">Porta</label>
              <input id="sp" type="number" value={smtpPorta}
                     onChange={(e) => setSmtpPorta(Number(e.target.value))} />
            </div>
            <div className="grupo">
              <label className="label" htmlFor="su">Usuário</label>
              <input id="su" value={smtpUsuario} onChange={(e) => setSmtpUsuario(e.target.value)} />
            </div>
          </div>
          <div className="linha-form">
            <div className="grupo">
              <label className="label" htmlFor="ss">Senha</label>
              <input id="ss" type="password" value={smtpSenha} onChange={(e) => setSmtpSenha(e.target.value)}
                     placeholder={smtp.temSenha ? '•••••••• já cadastrada' : 'cole a senha aqui'} />
            </div>
            <div className="grupo">
              <label className="label" htmlFor="sr">Remetente (opcional)</label>
              <input id="sr" value={smtpRemetente} onChange={(e) => setSmtpRemetente(e.target.value)}
                     placeholder="Harvest AI <naoresponda@figueiramarketing.com.br>" />
            </div>
          </div>
          <div className="linha-form">
            <div className="grupo">
              <label className="label" htmlFor="srt">Reply-To (opcional)</label>
              <input id="srt" value={smtpReplyTo} onChange={(e) => setSmtpReplyTo(e.target.value)}
                     placeholder="contato@figueiramarketing.com.br" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="salvar" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar SMTP'}
            </button>
            <button type="button" className="salvar" disabled={testando || !smtp.temSenha}
                    onClick={testarSmtp} style={{ background: 'transparent', border: '1px solid var(--rule-2)', color: 'var(--ink)' }}>
              {testando ? 'Testando…' : 'Enviar teste para mim'}
            </button>
          </div>
          {recado && <p className="ajuda" style={{ marginTop: 10 }}>{recado}</p>}
        </form>
      </section>
    </div>
  );
}
