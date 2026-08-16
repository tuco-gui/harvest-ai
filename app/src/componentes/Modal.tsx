'use client';

import { useEffect, useRef } from 'react';

/**
 * Modal institucional (Entrega 22) — padrão único para confirmações e ações
 * pequenas em todo o Harvest, em vez de cada tela reinventar seu próprio
 * `confirm()`/`prompt()` nativo do navegador. Fluxos complexos (edição
 * completa de campanha, por exemplo) usam página/painel dedicado, não isto —
 * ver CampanhaEditar.tsx.
 *
 * Respeita Dia/Noite (só usa var(--...) do globals.css, nunca cor fixa),
 * fecha com Escape, devolve o foco ao elemento que abriu o modal, e usa
 * `role="dialog"`/`aria-modal` para leitor de tela.
 */
export default function Modal({
  titulo, aberto, onFechar, children, largura = 420,
}: {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: number;
}) {
  const referenciaAnterior = useRef<HTMLElement | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    referenciaAnterior.current = document.activeElement as HTMLElement | null;
    caixaRef.current?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onFechar(); }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      referenciaAnterior.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div
      className="modal-fundo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        ref={caixaRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        tabIndex={-1}
        style={{ maxWidth: largura }}
      >
        <div className="modal-topo">
          <h3 id="modal-titulo">{titulo}</h3>
          <button type="button" className="modal-fechar" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}
