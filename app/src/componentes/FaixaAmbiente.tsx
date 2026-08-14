/**
 * Faixa "AMBIENTE DE TESTE" (Entrega 15 / STAGING — Seção 9). Só aparece
 * quando NEXT_PUBLIC_AMBIENTE=staging é definido no build — em produção
 * essa env não existe, então este componente não renderiza nada. Evita que
 * alguém confunda uma tela de staging com produção real.
 */
export default function FaixaAmbiente() {
  if (process.env.NEXT_PUBLIC_AMBIENTE !== 'staging') return null;
  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        background: '#C4191F',
        color: '#fff',
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.04em',
        padding: '4px 8px',
      }}
    >
      AMBIENTE DE TESTE — dados fictícios, nenhum disparo real sai daqui
    </div>
  );
}
